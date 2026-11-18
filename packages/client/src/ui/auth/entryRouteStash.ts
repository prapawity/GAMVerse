import { getInviteRouteToken, getOfficeShareRouteToken } from "../workspace/officeEntryLink";

const STASH_KEY = "gamverse.googleEntryRoute";
const STASH_TTL_MS = 15 * 60_000;

type StashStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Only invite and office-share routes are ever stashed or restored. */
export function isEntryRoute(path: unknown): path is string {
  return typeof path === "string" && (getInviteRouteToken(path) !== null || getOfficeShareRouteToken(path) !== null);
}

/** Remembers an invite/share route across the full-page trip to Google. */
export function stashEntryRoute(path: string, storage: StashStorage | null, now = Date.now()): boolean {
  if (!storage || !isEntryRoute(path)) return false;
  try { storage.setItem(STASH_KEY, JSON.stringify({ path, at: now })); return true; } catch { return false; }
}

/** Reads the stash without clearing it. Expired or tampered values are ignored. */
export function peekEntryRoute(storage: StashStorage | null, now = Date.now()): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STASH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof value.at !== "number" || now - value.at > STASH_TTL_MS || now < value.at) return null;
    return isEntryRoute(value.path) ? value.path : null;
  } catch { return null; }
}

export function clearEntryRoute(storage: StashStorage | null) {
  try { storage?.removeItem(STASH_KEY); } catch { /* storage unavailable */ }
}

export function takeEntryRoute(storage: StashStorage | null, now = Date.now()): string | null {
  const path = peekEntryRoute(storage, now);
  clearEntryRoute(storage);
  return path;
}

export function browserSessionStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}
