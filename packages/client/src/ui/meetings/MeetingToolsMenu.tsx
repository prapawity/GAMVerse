import { useRef, useState } from "react";
import type { useMeetingRecording } from "./useMeetingRecording";
import type { MeetingAudioStatus } from "./meetingAudioStatus";
import "./MeetingToolsMenu.css";

type Recording = ReturnType<typeof useMeetingRecording>;
type Props = {
  worldStatus: string;
  audioStatus: MeetingAudioStatus;
  onReconnect(): void;
  canReconnect: boolean;
  onOpenDevices(): void;
  skipOfficePrejoin: boolean;
  onSkipOfficePrejoinChange(enabled: boolean): void;
  powerSaverEnabled: boolean;
  onPowerSaverChange(enabled: boolean): void;
  onOpenNotes(): void;
  meetingUrl: string;
  recording: Recording;
};

const WORLD_STATUS_LABELS: Record<string, string> = {
  connecting: "Joining the office",
  connected: "Office connected",
  reconnecting: "Reconnecting to office",
  disconnected: "Office disconnected",
  error: "Office connection failed",
};

const AUDIO_STATUS_LABELS: Record<MeetingAudioStatus, string> = {
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  unavailable: "Unavailable",
};

export function MeetingToolsMenu({ worldStatus, audioStatus, onReconnect, canReconnect, onOpenDevices,
  skipOfficePrejoin, onSkipOfficePrejoinChange, powerSaverEnabled, onPowerSaverChange, onOpenNotes, meetingUrl, recording }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const closeMenu = () => detailsRef.current?.removeAttribute("open");
  const copyMeetingLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopyStatus("Meeting link copied");
    } catch {
      setCopyStatus("Clipboard access is unavailable in this browser");
    }
  };

  return <details ref={detailsRef} className="meeting-tools-menu">
    <summary className="dock-button meeting-tools-trigger" aria-label="Meeting tools" title="Meeting tools">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
      <span className="meeting-tools-trigger-label">Meeting tools</span>
    </summary>
    <section className="meeting-tools-panel" aria-label="Meeting tools">
      <header><strong>Meeting tools</strong><span>Shortcuts and meeting status</span></header>
      <div className="meeting-tools-status-list" aria-label="Connection status">
        <div><span>World</span><strong className={`is-${worldStatus}`}>{WORLD_STATUS_LABELS[worldStatus] ?? worldStatus}</strong></div>
        <div><span>Audio</span><strong className={`is-${audioStatus}`}>{AUDIO_STATUS_LABELS[audioStatus]}</strong></div>
      </div>
      {canReconnect && <button className="meeting-tools-action is-primary" type="button" onClick={() => { onReconnect(); closeMenu(); }}>Reconnect audio</button>}
      <button className="meeting-tools-action" type="button" onClick={() => { onOpenDevices(); closeMenu(); }}>Camera and audio devices</button>
      <button className="meeting-tools-action" type="button" onClick={() => void copyMeetingLink()}>{copyStatus || "Copy meeting link"}</button>
      <label className="meeting-tools-toggle"><span><strong>Skip setup before entering offices</strong><small>Use saved device settings</small></span><input type="checkbox" role="switch" checked={skipOfficePrejoin} onChange={event => onSkipOfficePrejoinChange(event.target.checked)} /></label>
      <label className="meeting-tools-toggle"><span><strong>Low-resource mode</strong><small>Lower 3D rendering detail</small></span><input type="checkbox" role="switch" checked={powerSaverEnabled} onChange={event => onPowerSaverChange(event.target.checked)} /></label>
      <button className="meeting-tools-action" type="button" onClick={() => { onOpenNotes(); closeMenu(); }}>Meeting notes and tasks</button>
      <div className="meeting-tools-recording">
        <div><strong>Recording</strong><small>{recording.state === "recording" ? recording.isRequester ? "Recording to your device" : `Recording started by ${recording.requesterName}` : recording.state === "awaiting-consent" || recording.state === "consent-progress" ? "Waiting for participant consent" : "Local file · participant consent required"}</small></div>
        {recording.state === "recording" && recording.isRequester
          ? <button type="button" onClick={recording.stopRecording}>Stop</button>
          : recording.state === "awaiting-consent" || recording.state === "consent-progress"
            ? <button type="button" onClick={recording.cancelRequest}>Cancel</button>
            : <button type="button" disabled={!recording.connected || recording.state !== "idle"} onClick={() => void recording.requestRecording()}>Record</button>}
      </div>
      <div className="meeting-tools-unavailable"><span>Host controls</span><small>Presenter and end-for-everyone controls are not available yet.</small></div>
      <div className="meeting-tools-unavailable"><span>Live captions</span><small>Speech captions are not available yet.</small></div>
      <div className="meeting-tools-unavailable"><span>AI meeting summary</span><small>Transcription and AI summaries are not available yet.</small></div>
      <p className="meeting-tools-footnote" role="status" aria-live="polite">{copyStatus && copyStatus !== "Meeting link copied" ? copyStatus : "Recordings are downloaded to the requester’s device and are not stored by GAMVerse."}</p>
    </section>
  </details>;
}
