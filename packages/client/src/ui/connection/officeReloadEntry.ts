const ACTIVE_OFFICE_KEY = "gammyverse.reloadOffice";

export function rememberOfficeForReload(storage: Storage | null, username: string, officeId: string): void {
  try { storage?.setItem(ACTIVE_OFFICE_KEY, JSON.stringify({ username, officeId })); } catch { /* Storage may be unavailable. */ }
}

export function clearOfficeForReload(storage: Storage | null): void {
  try { storage?.removeItem(ACTIVE_OFFICE_KEY); } catch { /* Storage may be unavailable. */ }
}

export function shouldResumeOfficeAfterReload(storage: Storage | null, username: string, officeId: string, navigationType: string | undefined): boolean {
  if (navigationType !== "reload") return false;
  try {
    const value = storage?.getItem(ACTIVE_OFFICE_KEY);
    if (!value) return false;
    const saved: unknown = JSON.parse(value);
    return typeof saved === "object" && saved !== null && "username" in saved && saved.username === username
      && "officeId" in saved && saved.officeId === officeId;
  } catch { return false; }
}

export function officeReloadStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}
