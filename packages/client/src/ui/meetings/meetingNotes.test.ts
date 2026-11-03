import assert from "node:assert/strict";
import test from "node:test";
import { MEETING_ACTION_ITEM_MAX_COUNT, MEETING_ACTION_ITEM_MAX_CHARS, MEETING_NOTES_MAX_CHARS, meetingActionItemsStorageKey, meetingNotesStorageKey, readMeetingActionItems, readMeetingNotes, writeMeetingActionItems, writeMeetingNotes } from "./meetingNotes";

test("meeting notes are isolated by office and save locally", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(writeMeetingNotes(storage, "office-a", "Decide launch date"), true);
  assert.equal(readMeetingNotes(storage, "office-a"), "Decide launch date");
  assert.equal(readMeetingNotes(storage, "office-b"), "");
  assert.equal(meetingNotesStorageKey("office-a"), "gammyverse.meetingNotes:office-a");
});

test("meeting action items are room-scoped and invalid saved entries are ignored", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const actions = [{ id: "one", text: "Send the follow-up", done: false }];
  assert.equal(writeMeetingActionItems(storage, "office-a", actions), true);
  assert.deepEqual(readMeetingActionItems(storage, "office-a"), actions);
  assert.deepEqual(readMeetingActionItems(storage, "office-b"), []);
  values.set(meetingActionItemsStorageKey("office-a"), JSON.stringify([{ id: "bad", text: " ", done: false }, { id: "ok", text: "Keep", done: true }]));
  assert.deepEqual(readMeetingActionItems(storage, "office-a"), [{ id: "ok", text: "Keep", done: true }]);
  assert.equal(meetingNotesStorageKey("office-a"), "gammyverse.meetingNotes:office-a");
});

test("meeting action items preserve optional owners and due dates while rejecting malformed metadata", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(writeMeetingActionItems(storage, "office", [{ id: "task", text: "Share notes", done: false, assignee: "  Mira  ", dueAt: "2026-11-10" }] ), true);
  assert.deepEqual(readMeetingActionItems(storage, "office"), [{ id: "task", text: "Share notes", done: false, assignee: "Mira", dueAt: "2026-11-10" }]);
  values.set(meetingActionItemsStorageKey("office"), JSON.stringify([{ id: "task", text: "Send recap", done: false, assignee: "Owner", dueAt: "2026-99-99" }]));
  assert.deepEqual(readMeetingActionItems(storage, "office"), [{ id: "task", text: "Send recap", done: false, assignee: "Owner" }]);
});

test("meeting action items have bounded count and text length", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const many = Array.from({ length: MEETING_ACTION_ITEM_MAX_COUNT + 4 }, (_, index) => ({ id: String(index), text: "x".repeat(MEETING_ACTION_ITEM_MAX_CHARS + 8), done: false }));
  assert.equal(writeMeetingActionItems(storage, "office", many), true);
  const saved = readMeetingActionItems(storage, "office");
  assert.equal(saved.length, MEETING_ACTION_ITEM_MAX_COUNT);
  assert.equal(saved[0]?.text.length, MEETING_ACTION_ITEM_MAX_CHARS);
  assert.deepEqual(readMeetingActionItems({ getItem: () => "not json" }, "office"), []);
});

test("meeting notes stay bounded and storage failures do not crash", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(writeMeetingNotes(storage, "office", "n".repeat(MEETING_NOTES_MAX_CHARS + 50)), true);
  assert.equal(readMeetingNotes(storage, "office").length, MEETING_NOTES_MAX_CHARS);
  assert.equal(readMeetingNotes({ getItem: () => { throw new Error("blocked"); } }, "office"), "");
  assert.equal(writeMeetingNotes({ setItem: () => { throw new Error("full"); } }, "office", "notes"), false);
});
