import type { CSSProperties } from "react";

export type VoiceRosterStatus = "available" | "do-not-disturb" | "in-meeting" | "toilet" | "lunch" | "coffee-break";
export type VoiceRosterPerson = {
  sessionId: string;
  displayName: string;
  username: string;
  status: VoiceRosterStatus;
  local: boolean;
  nearby: boolean;
};
export type VoiceRosterActivity = { microphone: boolean; camera: boolean; screenShare: boolean };
export type VoiceRosterMediaSource = "camera" | "screen";

const STATUS_LABELS: Record<VoiceRosterStatus, string> = {
  available: "Available",
  "do-not-disturb": "Do not disturb",
  "in-meeting": "In meeting",
  toilet: "Toilet",
  lunch: "Lunch",
  "coffee-break": "Coffee break",
};

const STATUS_COLORS: Record<VoiceRosterStatus, string> = {
  available: "#2f9e62",
  "do-not-disturb": "#dc3545",
  "in-meeting": "#7950c7",
  toilet: "#168aad",
  lunch: "#e08b22",
  "coffee-break": "#8a5a35",
};

function MediaGlyph({ source }: { source: "microphone" | VoiceRosterMediaSource }) {
  if (source === "microphone") return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3m-3 0h6"/></svg>;
  if (source === "camera") return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4.5" width="11" height="11" rx="2"/><path d="m13 8 5-3v10l-5-3"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="16" height="11" rx="1.7"/><path d="M7 17h6m-3-3v3m-4-7 2-2 2 2 3-3"/></svg>;
}

export function VoiceParticipantRoster({
  people,
  activities,
  audioLevels,
  canAdjustAudio,
  canMuteAll,
  canOpenVideo,
  onOpenVideo,
  onAdjustAudio,
  onModeratePerson,
  onMuteAll,
}: {
  people: VoiceRosterPerson[];
  activities: ReadonlyMap<string, VoiceRosterActivity>;
  audioLevels: ReadonlyMap<string, number>;
  canAdjustAudio: (username: string) => boolean;
  canMuteAll: boolean;
  canOpenVideo: (username: string, source: VoiceRosterMediaSource) => boolean;
  onOpenVideo: (username: string, source: VoiceRosterMediaSource) => void;
  onAdjustAudio: (username: string, change: "down" | "mute" | "up") => void;
  onModeratePerson: (username: string, source: "microphone" | "camera" | "screen_share") => void;
  onMuteAll: (source: "microphone" | "camera" | "screen_share") => void;
}) {
  if (!people.length) return null;

  return <section className="voice-participant-roster" aria-label="People you can talk to" aria-live="polite">
    <div className="voice-participant-roster-header">
      <span className="voice-participant-roster-heading">{people.length === 1 ? "VOICE · 1 PERSON" : `VOICE · ${people.length} PEOPLE`}</span>
      {canMuteAll && <span className="voice-participant-mute-all" role="group" aria-label="Mute all participants in this voice zone">
        <button type="button" title="Mute all microphones in this zone" aria-label="Mute all microphones in this voice zone" onClick={() => onMuteAll("microphone")}><MediaGlyph source="microphone" /><span>All mic</span></button>
        <button type="button" title="Mute all cameras in this zone" aria-label="Mute all cameras in this voice zone" onClick={() => onMuteAll("camera")}><MediaGlyph source="camera" /><span>All camera</span></button>
        <button type="button" title="Stop all screen shares in this zone" aria-label="Stop all screen shares in this voice zone" onClick={() => onMuteAll("screen_share")}><MediaGlyph source="screen" /><span>All share</span></button>
      </span>}
    </div>
    <ul>
      {people.map((person) => {
        const activity = activities.get(person.username.toLocaleLowerCase()) ?? { microphone: false, camera: false, screenShare: false };
        const audioLevel = audioLevels.get(person.username.toLocaleLowerCase()) ?? 1;
        const color = STATUS_COLORS[person.status];
        const style = { "--participant-status-color": color } as CSSProperties;
        return <li key={person.sessionId} style={style}>
          <span className="voice-participant-status-dot" aria-hidden="true" />
          <span className="voice-participant-copy">
            <strong>{person.local ? "You" : person.displayName}</strong>
            <small>{STATUS_LABELS[person.status]}</small>
          </span>
          <span className="voice-participant-activity" aria-label="Media activity">
            {activity.microphone && (person.local
              ? <span className="voice-participant-media is-on" title="Your microphone is on" aria-label="Your microphone is on"><MediaGlyph source="microphone" /></span>
              : <button type="button" className="voice-participant-media is-on" title={`Mute ${person.displayName}'s microphone in this zone`} aria-label={`Mute ${person.displayName}'s microphone`} onClick={() => onModeratePerson(person.username, "microphone")}><MediaGlyph source="microphone" /></button>)}
            {activity.camera && <span className="voice-participant-source-actions"><button type="button" className="voice-participant-media is-on" disabled={!canOpenVideo(person.username, "camera")} title="Open camera full screen" aria-label={`Open ${person.displayName}'s camera full screen`} onClick={() => onOpenVideo(person.username, "camera")}><MediaGlyph source="camera" /></button>{!person.local && <button type="button" className="voice-participant-mute-media" title={`Stop ${person.displayName}'s camera in this zone`} aria-label={`Stop ${person.displayName}'s camera`} onClick={() => onModeratePerson(person.username, "camera")}>×</button>}</span>}
            {activity.screenShare && <span className="voice-participant-source-actions"><button type="button" className="voice-participant-media is-on" disabled={!canOpenVideo(person.username, "screen")} title="Open screen share full screen" aria-label={`Open ${person.displayName}'s screen share full screen`} onClick={() => onOpenVideo(person.username, "screen")}><MediaGlyph source="screen" /></button>{!person.local && <button type="button" className="voice-participant-mute-media" title={`Stop ${person.displayName}'s screen share in this zone`} aria-label={`Stop ${person.displayName}'s screen share`} onClick={() => onModeratePerson(person.username, "screen_share")}>×</button>}</span>}
          </span>
          <span className="voice-participant-volume" role="group" aria-label={`Audio controls for ${person.local ? "you" : person.displayName}`}>
            <button type="button" aria-label={`Lower ${person.local ? "your" : `${person.displayName}'s`} volume`} title="Lower volume" disabled={!canAdjustAudio(person.username) || audioLevel <= 0} onClick={() => onAdjustAudio(person.username, "down")}>−</button>
            <button type="button" aria-label={`${audioLevel === 0 ? "Unmute" : "Mute"} ${person.local ? "your" : `${person.displayName}'s`} audio on this device`} title={audioLevel === 0 ? "Unmute this person on your device" : "Mute this person on your device"} aria-pressed={audioLevel === 0} disabled={!canAdjustAudio(person.username)} onClick={() => onAdjustAudio(person.username, "mute")}>{audioLevel === 0 ? "×" : "♪"}</button>
            <button type="button" aria-label={`Raise ${person.local ? "your" : `${person.displayName}'s`} volume`} title="Raise volume" disabled={!canAdjustAudio(person.username) || audioLevel >= 1} onClick={() => onAdjustAudio(person.username, "up")}>+</button>
          </span>
        </li>;
      })}
    </ul>
  </section>;
}
