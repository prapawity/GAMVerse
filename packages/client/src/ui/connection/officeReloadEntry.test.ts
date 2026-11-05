import assert from "node:assert/strict";
import test from "node:test";
import { clearOfficeForReload, rememberOfficeForReload, shouldResumeOfficeAfterReload } from "./officeReloadEntry";

test("only a reload of the same authenticated office resumes entry", () => {
  const entries = new Map<string, string>();
  const storage = {
    setItem: (key: string, value: string) => { entries.set(key, value); },
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => { entries.delete(key); },
  } as Storage;
  rememberOfficeForReload(storage, "alice", "office-a");
  assert.equal(shouldResumeOfficeAfterReload(storage, "alice", "office-a", "reload"), true);
  assert.equal(shouldResumeOfficeAfterReload(storage, "alice", "office-a", "navigate"), false);
  assert.equal(shouldResumeOfficeAfterReload(storage, "bob", "office-a", "reload"), false);
  assert.equal(shouldResumeOfficeAfterReload(storage, "alice", "office-b", "reload"), false);
  clearOfficeForReload(storage);
  assert.equal(shouldResumeOfficeAfterReload(storage, "alice", "office-a", "reload"), false);
});
