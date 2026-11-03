export const MEETING_NOTES_MAX_CHARS = 12_000;
export const MEETING_ACTION_ITEM_MAX_COUNT = 40;
export const MEETING_ACTION_ITEM_MAX_CHARS = 160;
export const MEETING_ACTION_ITEM_MAX_ASSIGNEE_CHARS = 48;

export type MeetingActionItem = { id: string; text: string; done: boolean; assignee?: string; dueAt?: string };

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function meetingNotesStorageKey(officeId: string) {
  return `gammyverse.meetingNotes:${officeId}`;
}

export function readMeetingNotes(storage: Pick<Storage, "getItem">, officeId: string) {
  try { return (storage.getItem(meetingNotesStorageKey(officeId)) ?? "").slice(0, MEETING_NOTES_MAX_CHARS); }
  catch { return ""; }
}

export function writeMeetingNotes(storage: Pick<Storage, "setItem">, officeId: string, notes: string) {
  try {
    storage.setItem(meetingNotesStorageKey(officeId), notes.slice(0, MEETING_NOTES_MAX_CHARS));
    return true;
  } catch { return false; }
}

export function meetingActionItemsStorageKey(officeId: string) {
  return `${meetingNotesStorageKey(officeId)}:actions`;
}

export function readMeetingActionItems(storage: Pick<Storage, "getItem">, officeId: string): MeetingActionItem[] {
  try {
    const raw = storage.getItem(meetingActionItemsStorageKey(officeId));
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is MeetingActionItem => typeof item === "object" && item !== null
      && "id" in item && typeof item.id === "string" && item.id.length <= 80
      && "text" in item && typeof item.text === "string" && item.text.trim().length > 0
      && "done" in item && typeof item.done === "boolean")
      .slice(0, MEETING_ACTION_ITEM_MAX_COUNT)
      .map(item => {
        const candidate = item as MeetingActionItem;
        const assignee = typeof candidate.assignee === "string" ? candidate.assignee.trim().slice(0, MEETING_ACTION_ITEM_MAX_ASSIGNEE_CHARS) : "";
        const dueAt = typeof candidate.dueAt === "string" && isDateOnly(candidate.dueAt) ? candidate.dueAt : "";
        return { id: candidate.id, text: candidate.text.slice(0, MEETING_ACTION_ITEM_MAX_CHARS), done: candidate.done,
          ...(assignee ? { assignee } : {}), ...(dueAt ? { dueAt } : {}) };
      });
  } catch { return []; }
}

export function writeMeetingActionItems(storage: Pick<Storage, "setItem">, officeId: string, items: readonly MeetingActionItem[]) {
  try {
    const safeItems = items.slice(0, MEETING_ACTION_ITEM_MAX_COUNT).map(item => ({
      id: item.id.slice(0, 80), text: item.text.trim().slice(0, MEETING_ACTION_ITEM_MAX_CHARS), done: item.done,
      assignee: item.assignee?.trim().slice(0, MEETING_ACTION_ITEM_MAX_ASSIGNEE_CHARS),
      dueAt: item.dueAt && isDateOnly(item.dueAt) ? item.dueAt : undefined,
    })).filter(item => item.id && item.text);
    storage.setItem(meetingActionItemsStorageKey(officeId), JSON.stringify(safeItems));
    return true;
  } catch { return false; }
}
