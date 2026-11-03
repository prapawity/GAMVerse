export interface PrejoinPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREJOIN_SKIP_KEY_PREFIX = "gammyverse.meetingPrejoinSkip.v1.";

export function browserPrejoinStorage(): PrejoinPreferenceStorage | null {
  try { return globalThis.localStorage; }
  catch { return null; }
}

export function prejoinSkipStorageKey(username: string) {
  return `${PREJOIN_SKIP_KEY_PREFIX}${encodeURIComponent(username.trim().toLowerCase())}`;
}

export function readPrejoinSkipPreference(storage: PrejoinPreferenceStorage | null, username: string | null | undefined) {
  if (!storage || !username?.trim()) return false;
  try { return storage.getItem(prejoinSkipStorageKey(username)) === "true"; }
  catch { return false; }
}

export function writePrejoinSkipPreference(storage: PrejoinPreferenceStorage | null, username: string | null | undefined, skip: boolean) {
  if (!storage || !username?.trim()) return false;
  try {
    storage.setItem(prejoinSkipStorageKey(username), String(skip));
    return true;
  } catch { return false; }
}
