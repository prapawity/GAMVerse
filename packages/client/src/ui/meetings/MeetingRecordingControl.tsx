import { WorkspaceDialog } from "../workspace/WorkspaceDialog";
import type { useMeetingRecording } from "./useMeetingRecording";
import "./MeetingRecording.css";

type Recording = ReturnType<typeof useMeetingRecording>;

export function MeetingRecordingControl({ recording }: { recording: Recording }) {
  const { state, isRequester, connected, pendingConsent, requesterName, consentCounts, error, notice } = recording;
  return <div className="meeting-recording-control">
    {state === "recording"
      ? isRequester
        ? <button type="button" className="meeting-recording-button is-recording" onClick={recording.stopRecording} aria-label="Stop recording and download to this device" title="Stop recording & download"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/></svg></button>
        : <span className="meeting-recording-live" role="status" title={`Recording locally · ${requesterName}`}><i aria-hidden="true" />REC</span>
      : state === "finalizing"
        ? <span className="meeting-recording-live is-waiting" role="status" title="Finalizing and downloading the recording"><i aria-hidden="true" />SAVING</span>
        : state === "awaiting-consent" || state === "consent-progress"
        ? <><span className="meeting-recording-live is-waiting" role="status" title={consentCounts ? `Waiting for consent · ${consentCounts.accepted}/${consentCounts.total}` : "Waiting for consent"}><i aria-hidden="true" />WAIT</span><button type="button" className="meeting-recording-button" onClick={recording.cancelRequest} aria-label="Cancel recording request" title="Cancel recording request"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button></>
        : <button type="button" className="meeting-recording-button" disabled={!connected} onClick={() => void recording.requestRecording()} title={connected ? "Record locally after consent · maximum 256 MB or 60 minutes" : "Connect to meeting audio before recording"} aria-label="Record this meeting locally after all participants agree; maximum 256 megabytes or 60 minutes"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.8" fill="currentColor" stroke="none"/></svg><i aria-hidden="true" /></button>}
    {error && <span className="meeting-recording-message is-error" role="status">{error}</span>}
    {notice && <span className="meeting-recording-message" role="status">{notice}</span>}
    {pendingConsent && <WorkspaceDialog labelledBy="meeting-recording-consent-title" onClose={() => recording.respondToConsent(false)} className="meeting-recording-dialog">
      <header><span className="eyebrow">LOCAL RECORDING REQUEST</span><h2 id="meeting-recording-consent-title">Allow this meeting to be recorded?</h2><p>{pendingConsent.requesterName} wants to record this meeting.</p></header>
      <div className="meeting-recording-disclosure"><strong>What will be captured</strong><p>The screen or browser tab chosen by the requester, including its audio. Everyone in this meeting must agree before recording starts.</p><strong>Recording limit</strong><p>Local recording stops at 256 MB or 60 minutes and downloads to the requester’s device.</p><strong>Where it goes</strong><p>GAMVerse does not upload or store the recording.</p></div>
      <footer><button type="button" className="workspace-button" onClick={() => recording.respondToConsent(false)}>Decline</button><button type="button" className="workspace-button primary" onClick={() => recording.respondToConsent(true)}>Allow recording</button></footer>
    </WorkspaceDialog>}
  </div>;
}
