type MeetingParticipant = { sessionId: string; displayName: string };
type RecordingRequest = {
  requestId: string;
  zoneId: string;
  requesterSessionId: string;
  requesterName: string;
  participants: Map<string, string>;
  accepted: Set<string>;
  started: boolean;
  timer: ReturnType<typeof setTimeout>;
};
type Send = (sessionId: string, event: string, payload: unknown) => void;

const CONSENT_TIMEOUT_MS = 60_000;
const REQUEST_COOLDOWN_MS = 3_000;

export function isMeetingRecordingMessage(value: unknown): value is { action: "request" | "consent" | "started" | "stop"; zoneId: string; requestId: string; accepted?: boolean } {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (typeof data.zoneId !== "string" || data.zoneId.length > 128 || /[\u0000-\u001f\u007f]/.test(data.zoneId)
    || typeof data.requestId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(data.requestId)) return false;
  if (!["request", "consent", "started", "stop"].includes(String(data.action))) return false;
  if (data.action === "consent" && typeof data.accepted !== "boolean") return false;
  return Object.keys(data).every(key => ["action", "zoneId", "requestId", ...(data.action === "consent" ? ["accepted"] : [])].includes(key));
}

/** Ephemeral, all-participant consent gate for local-only meeting captures. */
export class MeetingRecordingConsent {
  private readonly requests = new Map<string, RecordingRequest>();
  private readonly lastRequestAt = new Map<string, number>();

  constructor(private readonly participants: (zoneId: string) => readonly MeetingParticipant[], private readonly send: Send) {}

  request(sessionId: string, zoneId: string, requestId: string, now = Date.now()) {
    if (now - (this.lastRequestAt.get(sessionId) ?? -Infinity) < REQUEST_COOLDOWN_MS) return false;
    this.lastRequestAt.set(sessionId, now);
    if (this.requests.has(zoneId)) return false;
    const members = this.participants(zoneId);
    const requester = members.find(member => member.sessionId === sessionId);
    if (!requester || members.length === 0) return false;
    const participants = new Map(members.map(member => [member.sessionId, member.displayName]));
    const request: RecordingRequest = {
      requestId, zoneId, requesterSessionId: sessionId, requesterName: requester.displayName, participants,
      accepted: new Set([sessionId]), started: false,
      timer: setTimeout(() => this.finish(zoneId, "expired"), CONSENT_TIMEOUT_MS),
    };
    this.requests.set(zoneId, request);
    for (const member of members) {
      if (member.sessionId === sessionId) continue;
      this.send(member.sessionId, "meeting-recording-consent-request", { zoneId, requestId, requesterName: requester.displayName });
    }
    this.send(sessionId, "meeting-recording-state", { zoneId, requestId, status: members.length === 1 ? "approved" : "awaiting-consent", requesterName: requester.displayName, participantCount: members.length });
    if (members.length === 1) clearTimeout(request.timer);
    return true;
  }

  consent(sessionId: string, zoneId: string, requestId: string, accepted: boolean) {
    const request = this.requests.get(zoneId);
    if (!request || request.requestId !== requestId || request.started || !request.participants.has(sessionId) || request.accepted.has(sessionId)) return false;
    if (!accepted) {
      this.finish(zoneId, "declined", request.participants.get(sessionId));
      return true;
    }
    request.accepted.add(sessionId);
    const remaining = [...request.participants.keys()].filter(id => !request.accepted.has(id));
    if (remaining.length === 0) {
      clearTimeout(request.timer);
      this.broadcast(request, { status: "approved", requesterName: request.requesterName, participantCount: request.participants.size });
    } else {
      this.send(request.requesterSessionId, "meeting-recording-state", { zoneId, requestId, status: "consent-progress", acceptedCount: request.accepted.size, participantCount: request.participants.size });
    }
    return true;
  }

  started(sessionId: string, zoneId: string, requestId: string) {
    const request = this.requests.get(zoneId);
    if (!request || request.requestId !== requestId || request.requesterSessionId !== sessionId || request.started || request.accepted.size !== request.participants.size) return false;
    request.started = true;
    clearTimeout(request.timer);
    this.broadcast(request, { status: "recording", requesterName: request.requesterName, participantCount: request.participants.size });
    return true;
  }

  stop(sessionId: string, zoneId: string, requestId: string) {
    const request = this.requests.get(zoneId);
    if (!request || request.requestId !== requestId || request.requesterSessionId !== sessionId) return false;
    this.finish(zoneId, "stopped");
    return true;
  }

  membershipChanged(zoneId: string) {
    const request = this.requests.get(zoneId);
    if (request) this.finish(zoneId, "cancelled", undefined, "The meeting roster changed. Request consent again to record.");
  }

  disconnect(sessionId: string) {
    for (const [zoneId, request] of this.requests) {
      if (request.participants.has(sessionId)) this.finish(zoneId, "cancelled", undefined, "A participant left. Request consent again to record.");
    }
    this.lastRequestAt.delete(sessionId);
  }

  dispose() {
    for (const request of this.requests.values()) clearTimeout(request.timer);
    this.requests.clear();
    this.lastRequestAt.clear();
  }

  private broadcast(request: RecordingRequest, extra: Record<string, unknown>) {
    const payload = { zoneId: request.zoneId, requestId: request.requestId, requesterSessionId: request.requesterSessionId, ...extra };
    for (const sessionId of request.participants.keys()) this.send(sessionId, "meeting-recording-state", payload);
  }

  private finish(zoneId: string, status: "declined" | "expired" | "stopped" | "cancelled", declinedBy?: string, message?: string) {
    const request = this.requests.get(zoneId);
    if (!request) return;
    clearTimeout(request.timer);
    this.requests.delete(zoneId);
    this.broadcast(request, { status, ...(declinedBy ? { declinedBy } : {}), ...(message ? { message } : {}) });
  }
}
