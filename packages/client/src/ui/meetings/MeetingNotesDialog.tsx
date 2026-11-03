import { useEffect, useRef, useState, type FormEvent } from "react";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";
import { MEETING_NOTES_MAX_CHARS, readMeetingActionItems, readMeetingNotes, writeMeetingActionItems, writeMeetingNotes, type MeetingActionItem } from "./meetingNotes";

function getBrowserStorage() {
  try { return window.localStorage; }
  catch { return null; }
}

export function MeetingNotesDialog({ officeId, officeName, onClose }: { officeId: string; officeName: string; onClose(): void }) {
  const [notes, setNotes] = useState(() => { const storage = getBrowserStorage(); return storage ? readMeetingNotes(storage, officeId) : ""; });
  const [saved, setSaved] = useState(() => Boolean(getBrowserStorage()));
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>(() => { const storage = getBrowserStorage(); return storage ? readMeetingActionItems(storage, officeId) : []; });
  const [actionItemsSaved, setActionItemsSaved] = useState(() => Boolean(getBrowserStorage()));
  const [actionDraft, setActionDraft] = useState("");
  const [actionAssigneeDraft, setActionAssigneeDraft] = useState("");
  const [actionDueDraft, setActionDueDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const storage = getBrowserStorage();
    setNotes(storage ? readMeetingNotes(storage, officeId) : "");
    setActionItems(storage ? readMeetingActionItems(storage, officeId) : []);
    setSaved(Boolean(storage));
    setActionItemsSaved(Boolean(storage));
    setActionDraft("");
    setActionAssigneeDraft("");
    setActionDueDraft("");
  }, [officeId]);
  const updateNotes = (value: string) => {
    const bounded = value.slice(0, MEETING_NOTES_MAX_CHARS);
    setNotes(bounded);
    const storage = getBrowserStorage();
    setSaved(storage ? writeMeetingNotes(storage, officeId, bounded) : false);
  };
  const updateActionItems = (next: MeetingActionItem[]) => {
    setActionItems(next);
    const storage = getBrowserStorage();
    setActionItemsSaved(storage ? writeMeetingActionItems(storage, officeId, next) : false);
  };
  const addActionItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = actionDraft.trim();
    if (!text) return;
    updateActionItems([...actionItems, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, text, done: false, ...(actionAssigneeDraft.trim() ? { assignee: actionAssigneeDraft.trim() } : {}), ...(actionDueDraft ? { dueAt: actionDueDraft } : {}) }]);
    setActionDraft("");
    setActionAssigneeDraft("");
    setActionDueDraft("");
  };
  const exportNotes = () => {
    if (!notes.trim() && actionItems.length === 0) return;
    const actionSection = actionItems.length ? `\n\nAction items\n${actionItems.map(item => `${item.done ? "[x]" : "[ ]"} ${item.text}${item.assignee ? ` · Owner: ${item.assignee}` : ""}${item.dueAt ? ` · Due: ${item.dueAt}` : ""}`).join("\n")}` : "";
    const blob = new Blob([`${officeName}\nPersonal meeting notes\n\n${notes}${actionSection}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gamverse-meeting-notes-${officeName.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "office"}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <WorkspaceDialog labelledBy="meeting-notes-title" onClose={onClose} className="meeting-notes-dialog" initialFocusRef={textareaRef}>
    <header className="meeting-notes-header"><div><span className="eyebrow">PRIVATE TO YOU · {officeName}</span><h2 id="meeting-notes-title">Meeting notes</h2><p>Saved in this browser for this office. Other participants cannot see these notes.</p></div><button type="button" className="workspace-dialog-close" aria-label="Close meeting notes" onClick={onClose}>×</button></header>
    <label className="meeting-notes-field"><span className="sr-only">Personal meeting notes</span><textarea ref={textareaRef} value={notes} maxLength={MEETING_NOTES_MAX_CHARS} onChange={event => updateNotes(event.target.value)} placeholder="Add decisions, follow-ups, or anything you want to remember…" /></label>
    <section className="meeting-action-items" aria-labelledby="meeting-action-items-title">
      <div className="meeting-action-items-heading"><h3 id="meeting-action-items-title">Action items</h3><span>{actionItems.filter(item => !item.done).length} open</span></div>
      <form className="meeting-action-add" onSubmit={addActionItem}><label className="sr-only" htmlFor="meeting-action-draft">Add an action item</label><input id="meeting-action-draft" value={actionDraft} maxLength={160} onChange={event => setActionDraft(event.target.value)} placeholder="Write a follow-up…" /><label className="sr-only" htmlFor="meeting-action-assignee">Owner</label><input id="meeting-action-assignee" value={actionAssigneeDraft} maxLength={48} onChange={event => setActionAssigneeDraft(event.target.value)} placeholder="Owner" /><label className="sr-only" htmlFor="meeting-action-due">Due date</label><input id="meeting-action-due" type="date" value={actionDueDraft} onChange={event => setActionDueDraft(event.target.value)} aria-label="Action item due date" /><button type="submit" disabled={!actionDraft.trim() || actionItems.length >= 40}>Add</button></form>
      {actionItems.length > 0 && <ul className="meeting-action-list">{actionItems.map(item => <li key={item.id} className={item.done ? "is-done" : undefined}><label><input type="checkbox" checked={item.done} onChange={event => updateActionItems(actionItems.map(action => action.id === item.id ? { ...action, done: event.target.checked } : action))} /><span>{item.text}{(item.assignee || item.dueAt) && <small>{[item.assignee && `Owner: ${item.assignee}`, item.dueAt && `Due: ${item.dueAt}`].filter(Boolean).join(" · ")}</small>}</span></label><button type="button" aria-label={`Remove ${item.text}`} onClick={() => updateActionItems(actionItems.filter(action => action.id !== item.id))}>×</button></li>)}</ul>}
      <span className="sr-only" role="status">{actionItemsSaved ? "Action items saved on this device" : "Action items could not be saved"}</span>
    </section>
    <footer className="meeting-notes-footer"><span role="status">{saved && actionItemsSaved ? "Saved on this device" : "Could not save · browser storage is unavailable"} · {notes.length.toLocaleString()}/{MEETING_NOTES_MAX_CHARS.toLocaleString()}</span><div><button type="button" className="workspace-button" onClick={exportNotes} disabled={!notes.trim() && actionItems.length === 0}>Download notes</button><button type="button" className="workspace-button primary" onClick={onClose}>Done</button></div></footer>
  </WorkspaceDialog>;
}
