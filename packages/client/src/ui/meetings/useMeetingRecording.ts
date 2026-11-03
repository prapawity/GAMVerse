import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { OfficeState } from "@gammyverse/shared";
import { BoundedRecordingBuffer, canStartRecording, MAX_LOCAL_RECORDING_BYTES, RecordingCaptureEpoch, recordingCompletion, type RecordingLimitReason } from "./boundedRecordingBuffer";

type OfficeRoom = Pick<Room<OfficeState>, "sessionId" | "send" | "onMessage"> | null;
type RecordingState = "idle" | "awaiting-consent" | "consent-progress" | "recording" | "finalizing";
type ConsentRequest = { requestId: string; zoneId: string; requesterName: string };
type ServerMessage = { zoneId?: unknown; requestId?: unknown; status?: unknown; requesterSessionId?: unknown; requesterName?: unknown; participantCount?: unknown; acceptedCount?: unknown; declinedBy?: unknown; message?: unknown };
const MAX_LOCAL_RECORDING_DURATION_MS = 60 * 60 * 1000;
const MAX_LOCAL_RECORDING_MB = MAX_LOCAL_RECORDING_BYTES / (1024 * 1024);
const MAX_LOCAL_RECORDING_DURATION_MINUTES = MAX_LOCAL_RECORDING_DURATION_MS / 60_000;

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

export function useMeetingRecording({ room, zoneId, active, connected, officeName }: { room: OfficeRoom; zoneId: string | null; active: boolean; connected: boolean; officeName: string }) {
  const [state, setState] = useState<RecordingState>("idle");
  const [pendingConsent, setPendingConsent] = useState<ConsentRequest | null>(null);
  const [requesterName, setRequesterName] = useState("");
  const [consentCounts, setConsentCounts] = useState<{ accepted: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const captureEpochRef = useRef(new RecordingCaptureEpoch());
  const limitReachedRef = useRef(false);
  const rejectedChunkRef = useRef(false);
  const limitReasonRef = useRef<RecordingLimitReason>(null);
  const durationTimerRef = useRef<number | null>(null);
  const requesterRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const permissionRequestEpochRef = useRef<number | null>(null);
  const recordingScopeRef = useRef({ room, zoneId });
  const latestRecordingContextRef = useRef({ room, zoneId, active, connected });
  latestRecordingContextRef.current = { room, zoneId, active, connected };

  const clearCapture = useCallback(() => {
    captureEpochRef.current.invalidate();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    const stream = streamRef.current;
    streamRef.current = null;
    stopTracks(stream);
    if (durationTimerRef.current !== null) window.clearTimeout(durationTimerRef.current);
    durationTimerRef.current = null;
  }, []);

  useEffect(() => {
    const previous = recordingScopeRef.current;
    if (previous.room !== room || previous.zoneId !== zoneId) {
      const requestId = requestIdRef.current;
      if (requestId && requesterRef.current && previous.room && previous.zoneId) {
        previous.room.send("meeting-recording-control", { action: "stop", zoneId: previous.zoneId, requestId });
      }
      permissionRequestEpochRef.current = null;
      requestIdRef.current = null;
      requesterRef.current = false;
      clearCapture();
      setState("idle");
      setPendingConsent(null);
      setConsentCounts(null);
      setRequesterName("");
      setError(null);
      setNotice(null);
      stopRequestedRef.current = false;
    }
    recordingScopeRef.current = { room, zoneId };
  }, [clearCapture, room, zoneId]);

  useEffect(() => () => {
    const requestId = requestIdRef.current;
    const { room: activeRoom, zoneId: activeZoneId } = recordingScopeRef.current;
    if (requestId && requesterRef.current && activeRoom && activeZoneId) {
      activeRoom.send("meeting-recording-control", { action: "stop", zoneId: activeZoneId, requestId });
    }
    permissionRequestEpochRef.current = null;
    requestIdRef.current = null;
    requesterRef.current = false;
    clearCapture();
  }, [clearCapture]);

  const startRecorder = useCallback((requestId: string) => {
    const stream = streamRef.current;
    if (!stream || !window.MediaRecorder) {
      setError("This browser can’t record the selected screen.");
      room?.send("meeting-recording-control", { action: "stop", zoneId, requestId });
      clearCapture();
      setState("idle");
      return;
    }
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      setError("This browser doesn’t support a downloadable meeting recording format.");
      room?.send("meeting-recording-control", { action: "stop", zoneId, requestId });
      clearCapture();
      setState("idle");
      return;
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      const captureEpoch = captureEpochRef.current.begin();
      const captureStream = stream;
      const recordingBuffer = new BoundedRecordingBuffer();
      let captureDurationTimer: number | null = null;
      limitReachedRef.current = false;
      rejectedChunkRef.current = false;
      limitReasonRef.current = null;
      const stopForLimit = (reason: Exclude<RecordingLimitReason, null>) => {
        if (limitReachedRef.current) return;
        limitReachedRef.current = true;
        limitReasonRef.current = reason;
        room?.send("meeting-recording-control", { action: "stop", zoneId, requestId });
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.ondataavailable = event => {
        if (!captureEpochRef.current.isCurrent(captureEpoch) || recorderRef.current !== recorder) return;
        if (!event.data.size) return;
        const result = recordingBuffer.append(event.data);
        if (!result.accepted) rejectedChunkRef.current = true;
        if (!result.accepted || result.shouldStop) stopForLimit("bytes");
      };
      recorder.onerror = () => {
        if (!captureEpochRef.current.isCurrent(captureEpoch) || recorderRef.current !== recorder) return;
        setError("Recording stopped because the browser couldn’t continue capturing.");
        room?.send("meeting-recording-control", { action: "stop", zoneId, requestId });
        clearCapture();
        setState("idle");
      };
      recorder.onstop = () => {
        if (captureDurationTimer !== null) window.clearTimeout(captureDurationTimer);
        if (durationTimerRef.current === captureDurationTimer) durationTimerRef.current = null;
        const currentCapture = captureEpochRef.current.isCurrent(captureEpoch) && recorderRef.current === recorder;
        if (!currentCapture) {
          recordingBuffer.clear();
          stopTracks(captureStream);
          return;
        }
        const blob = recordingBuffer.toBlob(mimeType);
        const completion = recordingCompletion(rejectedChunkRef.current, blob.size, limitReasonRef.current);
        recordingBuffer.clear();
        rejectedChunkRef.current = false;
        limitReasonRef.current = null;
        if (completion.kind === "failed") {
          setError(`Recording could not be finalized within the ${MAX_LOCAL_RECORDING_MB} MB size limit. No file was downloaded.`);
        } else if (completion.kind === "download") {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          const slug = officeName.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "meeting";
          const extension = mimeType.includes("mp4") ? "mp4" : "webm";
          link.href = url;
          link.download = `gamverse-meeting-${slug}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          const limitNotice = completion.reason === "duration"
            ? `Recording reached the ${MAX_LOCAL_RECORDING_DURATION_MINUTES}-minute limit and was downloaded.`
            : completion.reason === "bytes" ? `Recording reached the ${MAX_LOCAL_RECORDING_MB} MB limit and was downloaded.` : null;
          setNotice(limitNotice ?? "Recording downloaded to this device.");
        }
        stopTracks(captureStream);
        if (streamRef.current === captureStream) streamRef.current = null;
        recorderRef.current = null;
        if (requestIdRef.current === requestId) requestIdRef.current = null;
        requesterRef.current = false;
        setState("idle");
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      captureDurationTimer = window.setTimeout(() => {
        if (!captureEpochRef.current.isCurrent(captureEpoch) || recorderRef.current !== recorder || recorder.state === "inactive") return;
        stopForLimit("duration");
      }, MAX_LOCAL_RECORDING_DURATION_MS);
      durationTimerRef.current = captureDurationTimer;
      room?.send("meeting-recording-control", { action: "started", zoneId, requestId });
      setState("recording");
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = () => {
        if (captureEpochRef.current.isCurrent(captureEpoch) && recorderRef.current === recorder && !stopRequestedRef.current) {
          stopRequestedRef.current = true;
          room?.send("meeting-recording-control", { action: "stop", zoneId, requestId });
          setState("finalizing");
          // The browser may still deliver a final dataavailable event after
          // the user stops sharing. Keep this capture epoch alive until onstop.
          if (recorder.state !== "inactive") recorder.stop();
        }
      };
    } catch {
      setError("Recording couldn’t start. Try selecting a browser tab and including its audio.");
      room?.send("meeting-recording-control", { action: "stop", zoneId, requestId });
      clearCapture();
      setState("idle");
    }
  }, [clearCapture, officeName, room, zoneId]);

  const requestRecording = useCallback(async () => {
    if (!room || !zoneId || !active || !connected ||
      !canStartRecording(state === "idle", recorderRef.current !== null, permissionRequestEpochRef.current !== null)) return;
    setError(null); setNotice(null);
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      setError("Local screen recording isn’t supported by this browser.");
      return;
    }
    const permissionEpoch = captureEpochRef.current.begin();
    permissionRequestEpochRef.current = permissionEpoch;
    const contextIsCurrent = () => {
      const latest = latestRecordingContextRef.current;
      return latest.room === room && latest.zoneId === zoneId && latest.active && latest.connected;
    };
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); }
    catch (cause) {
      if (captureEpochRef.current.isCurrent(permissionEpoch) && contextIsCurrent()) {
        permissionRequestEpochRef.current = null;
        if (cause instanceof DOMException && cause.name === "NotAllowedError") setError("Screen capture was cancelled.");
        else setError("Couldn’t capture this screen. Try a browser tab and enable tab audio.");
      } else if (permissionRequestEpochRef.current === permissionEpoch) {
        permissionRequestEpochRef.current = null;
        captureEpochRef.current.invalidate();
      }
      return;
    }
    if (!captureEpochRef.current.isCurrent(permissionEpoch) || !contextIsCurrent()) {
      stopTracks(stream);
      if (permissionRequestEpochRef.current === permissionEpoch) {
        permissionRequestEpochRef.current = null;
        captureEpochRef.current.invalidate();
      }
      return;
    }
    permissionRequestEpochRef.current = null;
    if (!stream.getAudioTracks().length || !stream.getVideoTracks().length) {
      stopTracks(stream);
      setError("Choose a screen or browser tab and enable its audio to record the meeting.");
      return;
    }
    streamRef.current = stream;
    requesterRef.current = true;
    stopRequestedRef.current = false;
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setRequesterName("You");
    setState("awaiting-consent");
    room.send("meeting-recording-control", { action: "request", zoneId, requestId });
    stream.getVideoTracks()[0]!.onended = () => {
      if (requestIdRef.current === requestId) {
        room.send("meeting-recording-control", { action: "stop", zoneId, requestId });
        if (recorderRef.current) {
          stopRequestedRef.current = true;
          if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
          setState("finalizing");
        } else {
          clearCapture();
          setState("idle");
        }
      }
    };
  }, [active, clearCapture, connected, room, state, zoneId]);

  const respondToConsent = useCallback((accepted: boolean) => {
    if (!room || !pendingConsent) return;
    room.send("meeting-recording-control", { action: "consent", zoneId: pendingConsent.zoneId, requestId: pendingConsent.requestId, accepted });
    setPendingConsent(null);
  }, [pendingConsent, room]);

  const stopRecording = useCallback(() => {
    const requestId = requestIdRef.current;
    if (!room || !zoneId || !requestId) return;
    stopRequestedRef.current = true;
    room.send("meeting-recording-control", { action: "stop", zoneId, requestId });
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") { recorder.stop(); setState("finalizing"); }
    else { clearCapture(); setState("idle"); }
  }, [clearCapture, room, zoneId]);

  useEffect(() => {
    if (!room || !zoneId) return;
    const removeConsent = room.onMessage("meeting-recording-consent-request", (raw: unknown) => {
      if (!active || !raw || typeof raw !== "object") return;
      const data = raw as Partial<ConsentRequest>;
      if (data.zoneId === zoneId && typeof data.requestId === "string" && typeof data.requesterName === "string") {
        setPendingConsent({ requestId: data.requestId, zoneId, requesterName: data.requesterName });
        setError(null);
      }
    });
    const removeState = room.onMessage("meeting-recording-state", (raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const data = raw as ServerMessage;
      if (data.zoneId !== zoneId || typeof data.requestId !== "string") return;
      const isCurrent = data.requestId === requestIdRef.current;
      if (data.status === "error") {
        if (isCurrent) { clearCapture(); requestIdRef.current = null; setState("idle"); }
        setError(typeof data.message === "string" ? data.message : "Recording request failed.");
      } else if (data.status === "awaiting-consent" && isCurrent) {
        if (typeof data.participantCount === "number") setConsentCounts({ accepted: 1, total: data.participantCount });
      } else if (data.status === "consent-progress" && isCurrent) {
        if (typeof data.acceptedCount === "number" && typeof data.participantCount === "number") setConsentCounts({ accepted: data.acceptedCount, total: data.participantCount });
        setState("consent-progress");
      } else if (data.status === "approved") {
        setPendingConsent(null);
        if (isCurrent && requesterRef.current) startRecorder(data.requestId);
      } else if (data.status === "recording") {
        setPendingConsent(null);
        setRequesterName(typeof data.requesterName === "string" ? data.requesterName : "A participant");
        setState("recording");
      } else if (["declined", "expired", "cancelled", "stopped"].includes(String(data.status))) {
        const message = data.status === "declined"
          ? `${typeof data.declinedBy === "string" ? data.declinedBy : "A participant"} declined the recording request.`
          : data.status === "expired" ? "The recording request expired."
            : data.status === "cancelled" ? (typeof data.message === "string" ? data.message : "Recording was cancelled.") : null;
        let finalizing = false;
        if (isCurrent) {
          if (data.status === "stopped" && requesterRef.current && recorderRef.current) {
            finalizing = true;
            stopRequestedRef.current = true;
            if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
          } else {
            requestIdRef.current = null;
            requesterRef.current = false;
            if (data.status !== "stopped") clearCapture();
          }
        }
        setState(finalizing ? "finalizing" : "idle"); setConsentCounts(null);
        if (message) setError(message);
        setPendingConsent(null);
        if (data.status === "cancelled") setRequesterName("");
        if (data.status === "stopped" && !finalizing) setNotice("The local recording ended.");
      }
    });
    return () => { removeConsent(); removeState(); };
  }, [active, clearCapture, room, startRecorder, zoneId]);

  useEffect(() => {
    if (active) return;
    permissionRequestEpochRef.current = null;
    const requestId = requestIdRef.current;
    if (requestId && requesterRef.current && room && zoneId) room.send("meeting-recording-control", { action: "stop", zoneId, requestId });
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      stopRequestedRef.current = true;
      recorderRef.current.stop();
    } else clearCapture();
    requestIdRef.current = null;
    requesterRef.current = false;
    setState("idle"); setPendingConsent(null); setConsentCounts(null);
  }, [active, clearCapture, room, zoneId]);

  useEffect(() => {
    const permissionPending = permissionRequestEpochRef.current !== null;
    if (connected || (!permissionPending && (state === "idle" || !requesterRef.current))) return;
    const requestId = requestIdRef.current;
    if (requestId && requesterRef.current && room && zoneId) room.send("meeting-recording-control", { action: "stop", zoneId, requestId });
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    else clearCapture();
    permissionRequestEpochRef.current = null;
    requestIdRef.current = null; requesterRef.current = false;
    setState("idle"); setPendingConsent(null); setConsentCounts(null);
    setError("Recording ended because the meeting audio disconnected.");
  }, [clearCapture, connected, room, state, zoneId]);

  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => { setError(null); setNotice(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const cancelRequest = useCallback(() => {
    if (state === "recording") { stopRecording(); return; }
    const requestId = requestIdRef.current;
    if (requestId && room && zoneId) room.send("meeting-recording-control", { action: "stop", zoneId, requestId });
    requestIdRef.current = null; requesterRef.current = false;
    clearCapture(); setState("idle"); setConsentCounts(null);
  }, [clearCapture, room, state, stopRecording, zoneId]);

  return { state, isRequester: requesterRef.current, connected, pendingConsent, requesterName, consentCounts, error, notice, requestRecording, respondToConsent, stopRecording, cancelRequest };
}
