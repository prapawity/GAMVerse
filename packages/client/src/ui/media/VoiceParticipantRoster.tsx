import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type VoiceRosterStatus = "available" | "do-not-disturb" | "in-meeting" | "toilet" | "lunch" | "coffee-break";
export type VoiceRosterPerson = {
  sessionId: string;
  displayName: string;
  username: string;
  status: VoiceRosterStatus;
  presence: "online" | "away";
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

function MoreGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>;
}

function ExpandGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M3 7l5-5m9 5-5-5M3 13l5 5m9-5-5 5"/></svg>;
}

export function VoiceParticipantRoster({
  people,
  activities,
  localActivity,
  audioLevels,
  canMuteAll,
  canOpenVideo,
  onOpenVideo,
  onSetAudioLevel,
  onModeratePerson,
  onMuteAll,
}: {
  people: VoiceRosterPerson[];
  activities: ReadonlyMap<string, VoiceRosterActivity>;
  localActivity: VoiceRosterActivity;
  audioLevels: ReadonlyMap<string, number>;
  canMuteAll: boolean;
  canOpenVideo: (username: string, source: VoiceRosterMediaSource) => boolean;
  onOpenVideo: (username: string, source: VoiceRosterMediaSource) => void;
  onSetAudioLevel: (username: string, level: number) => void;
  onModeratePerson: (username: string, source: "microphone" | "camera" | "screen_share") => void;
  onMuteAll: (source: "microphone" | "camera" | "screen_share") => void;
}) {
  const [settingsPersonId, setSettingsPersonId] = useState<string | null>(null);
  const [settingsPosition, setSettingsPosition] = useState<{ top: number; left: number } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsPersonId) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (settingsRef.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest(".voice-participant-settings-trigger")) return;
      setSettingsPersonId(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsPersonId(null); };
    document.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", escape);
    };
  }, [settingsPersonId]);

  if (!people.length) return null;

  return <section className="voice-participant-roster" aria-label="People you can talk to" aria-live="polite">
    <div className="voice-participant-roster-header">
      <span className="voice-participant-roster-heading">VOICE · {people.length} {people.length === 1 ? "PERSON" : "PEOPLE"}</span>
      {canMuteAll && <span className="voice-participant-mute-all" role="group" aria-label="Mute all participants in this voice zone">
        <button type="button" title="Mute all microphones in this zone" aria-label="Mute all microphones in this voice zone" onClick={() => onMuteAll("microphone")}><MediaGlyph source="microphone" /><span>All mic</span></button>
        <button type="button" title="Mute all cameras in this zone" aria-label="Mute all cameras in this voice zone" onClick={() => onMuteAll("camera")}><MediaGlyph source="camera" /><span>All camera</span></button>
        <button type="button" title="Stop all screen shares in this zone" aria-label="Stop all screen shares in this voice zone" onClick={() => onMuteAll("screen_share")}><MediaGlyph source="screen" /><span>All share</span></button>
      </span>}
    </div>
    <ul>
      {people.map((person) => {
        const activityKnown = person.local || activities.has(person.username.toLocaleLowerCase());
        const activity = person.local ? localActivity : activities.get(person.username.toLocaleLowerCase()) ?? { microphone: false, camera: false, screenShare: false };
        const audioLevel = audioLevels.get(person.username.toLocaleLowerCase()) ?? 1;
        const color = STATUS_COLORS[person.status];
        const style = { "--participant-status-color": color } as CSSProperties;
        const isOpen = settingsPersonId === person.sessionId;
        return <li key={person.sessionId} style={style}>
          <span className="voice-participant-status-dot" aria-hidden="true" />
          <span className="voice-participant-copy">
            <strong>{person.local ? "You" : person.displayName}</strong>
            <small>{person.presence === "away" ? "Away" : STATUS_LABELS[person.status]}</small>
          </span>
          <span className="voice-participant-activity" aria-label="Media activity">
            <button type="button" className={`voice-participant-media ${!activityKnown ? "is-unknown" : activity.microphone ? "is-on" : "is-off"}`} aria-pressed={activityKnown && activity.microphone} disabled={person.local || !activityKnown || !activity.microphone} title={!activityKnown ? "Microphone status unavailable while voice is disconnected" : activity.microphone ? `Turn off ${person.displayName}'s microphone` : `${person.displayName}'s microphone is off; they can turn it on themselves`} aria-label={`${person.displayName}'s microphone ${!activityKnown ? "status unavailable" : activity.microphone ? "on, click to turn off" : "off"}`} onClick={() => { if (!person.local && activityKnown && activity.microphone) onModeratePerson(person.username, "microphone"); }}><MediaGlyph source="microphone" /></button>
            <span className="voice-participant-source-actions">
              <button type="button" className={`voice-participant-media ${!activityKnown ? "is-unknown" : activity.camera ? "is-on" : "is-off"}`} aria-pressed={activityKnown && activity.camera} disabled={person.local || !activityKnown || !activity.camera} title={!activityKnown ? "Camera status unavailable while voice is disconnected" : activity.camera ? `Turn off ${person.displayName}'s camera` : `${person.displayName}'s camera is off; they can turn it on themselves`} aria-label={`${person.displayName}'s camera ${!activityKnown ? "status unavailable" : activity.camera ? "on, click to turn off" : "off"}`} onClick={() => { if (!person.local && activityKnown && activity.camera) onModeratePerson(person.username, "camera"); }}><MediaGlyph source="camera" /></button>
              {activity.camera && <button type="button" className="voice-participant-media voice-participant-expand" disabled={!canOpenVideo(person.username, "camera")} title={`Open ${person.displayName}'s camera full screen`} aria-label={`Open ${person.displayName}'s camera full screen`} onClick={() => onOpenVideo(person.username, "camera")}><ExpandGlyph /></button>}
            </span>
            <span className="voice-participant-source-actions">
              <button type="button" className={`voice-participant-media ${!activityKnown ? "is-unknown" : activity.screenShare ? "is-on" : "is-off"}`} aria-pressed={activityKnown && activity.screenShare} disabled={person.local || !activityKnown || !activity.screenShare} title={!activityKnown ? "Screen share status unavailable while voice is disconnected" : activity.screenShare ? `Stop ${person.displayName}'s screen share` : `${person.displayName} is not sharing a screen`} aria-label={`${person.displayName}'s screen share ${!activityKnown ? "status unavailable" : activity.screenShare ? "on, click to stop" : "off"}`} onClick={() => { if (!person.local && activityKnown && activity.screenShare) onModeratePerson(person.username, "screen_share"); }}><MediaGlyph source="screen" /></button>
              {activity.screenShare && <button type="button" className="voice-participant-media voice-participant-expand" disabled={!canOpenVideo(person.username, "screen")} title={`Open ${person.displayName}'s screen share full screen`} aria-label={`Open ${person.displayName}'s screen share full screen`} onClick={() => onOpenVideo(person.username, "screen")}><ExpandGlyph /></button>}
            </span>
          </span>
          {!person.local && <button type="button" className={`voice-participant-settings-trigger${isOpen ? " is-open" : ""}`} aria-label={`Settings for ${person.displayName}`} title="Participant settings" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={isOpen ? `voice-participant-settings-${person.sessionId}` : undefined} onClick={(event) => {
            if (isOpen) { setSettingsPersonId(null); setSettingsPosition(null); return; }
            const rect = event.currentTarget.getBoundingClientRect();
            setSettingsPosition({ top: Math.min(rect.bottom + 6, window.innerHeight - 170), left: Math.max(8, Math.min(rect.right - 232, window.innerWidth - 240)) });
            setSettingsPersonId(person.sessionId);
          }}><MoreGlyph /></button>}
          {isOpen && settingsPosition && createPortal(<div ref={settingsRef} id={`voice-participant-settings-${person.sessionId}`} className="voice-participant-settings" role="dialog" aria-label={`Local audio settings for ${person.local ? "you" : person.displayName}`} style={settingsPosition}>
            <strong>Configuration</strong>
            <label><span>Volume <output>{Math.round(audioLevel * 100)}%</output></span><input type="range" min="0" max="150" step="5" value={Math.round(audioLevel * 100)} onChange={(event) => onSetAudioLevel(person.username, Number(event.target.value) / 100)} /></label>
          </div>, document.body)}
        </li>;
      })}
    </ul>
  </section>;
}
