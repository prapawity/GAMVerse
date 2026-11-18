import { readGoogleErrorFromSearch } from "./googleAuthErrors";

export const SETTINGS_RETURN_PATH = "/settings";
export const GOOGLE_CONNECTED_NOTICE = "Google account connected";

export type SettingsReturn = { openSettings: boolean; notice: string | null; error: string | null; cleanUrl: string };

/** Interprets the landing URL after the Google link flow. Signed-in users with a Google error stay on their page. */
export function parseSettingsReturn(pathname: string, search: string): SettingsReturn | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);
  if (path === SETTINGS_RETURN_PATH) {
    const connected = params.get("google") === "connected";
    const { message } = readGoogleErrorFromSearch(search);
    return { openSettings: true, notice: connected ? GOOGLE_CONNECTED_NOTICE : null, error: message, cleanUrl: "/" };
  }
  const { message, cleanedSearch } = readGoogleErrorFromSearch(search);
  if (message === null) return null;
  return { openSettings: true, notice: null, error: message, cleanUrl: `${pathname}${cleanedSearch}` };
}
