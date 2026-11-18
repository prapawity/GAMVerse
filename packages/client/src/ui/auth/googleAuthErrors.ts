export const GOOGLE_ERROR_PARAM = "error";

const MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled. You can try again or sign in with your username and password.",
  google_failed: "We could not sign you in with Google. Please try again.",
  google_conflict: "That Google account or its email is already used by another account. Sign in with your username and password and connect Google from settings, or contact a maintainer.",
  google_rate_limited: "Too many sign-in attempts. Please wait a moment and try again.",
};

/** Plain-English message for a `?error=` code from the Google callback, or null when the code is not ours. */
export function googleErrorMessage(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(MESSAGES, code) ? MESSAGES[code]! : null;
}

/** Reads the Google error code from a query string and returns the message plus the URL with that parameter removed. */
export function readGoogleErrorFromSearch(search: string): { message: string | null; cleanedSearch: string } {
  const params = new URLSearchParams(search);
  const message = googleErrorMessage(params.get(GOOGLE_ERROR_PARAM));
  if (message === null) return { message: null, cleanedSearch: search };
  params.delete(GOOGLE_ERROR_PARAM);
  const rest = params.toString();
  return { message, cleanedSearch: rest ? `?${rest}` : "" };
}
