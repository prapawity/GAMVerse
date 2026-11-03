export type MeetingAudioStatus = "connecting" | "connected" | "reconnecting" | "unavailable";

export function meetingAudioStatus(input: { connected: boolean; retryExhausted: boolean; error: boolean }): MeetingAudioStatus {
  if (input.connected) return "connected";
  if (input.retryExhausted) return "unavailable";
  if (input.error) return "reconnecting";
  return "connecting";
}

export function meetingAudioStatusLabel(status: MeetingAudioStatus) {
  switch (status) {
    case "connected": return "Audio connected";
    case "reconnecting": return "Reconnecting audio";
    case "unavailable": return "Audio unavailable";
    case "connecting": return "Connecting audio";
  }
}
