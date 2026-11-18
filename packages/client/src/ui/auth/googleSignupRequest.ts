import { normalizeAccountUsername } from "@gammyverse/shared";

export type CompleteSignupResult =
  | { kind: "ok"; user: unknown }
  | { kind: "invalid-username"; message: string }
  | { kind: "username-taken"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "error"; message: string };

const USERNAME_HELP = "Username must be 3–24 characters: letters, numbers, dot, dash or underscore.";
const EXPIRED = "This sign-up link is invalid or expired. Start again from sign-in.";
/** The server answers 400 for both a bad token and a bad username; only the token message ends the flow. */
const SERVER_EXPIRED_PATTERN = /invalid or expired/i;

/** Validates the username with the shared normaliser, then maps the server reply to a UI outcome. */
export async function completeGoogleSignup(endpoint: string, pendingToken: string, rawUsername: string, fetcher: typeof fetch = fetch): Promise<CompleteSignupResult> {
  const username = normalizeAccountUsername(rawUsername);
  if (!username) return { kind: "invalid-username", message: USERNAME_HELP };
  let response: Response;
  try {
    response = await fetcher(`${endpoint}/auth/google/complete`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingToken, username }) });
  } catch {
    return { kind: "error", message: "Could not reach the sign-in service. Try again." };
  }
  const body = await response.json().catch(() => ({})) as { user?: unknown; error?: string };
  if (response.ok && body.user) return { kind: "ok", user: body.user };
  if (response.status === 409) return { kind: "username-taken", message: body.error ?? "That username is already taken." };
  if (response.status === 400) {
    if (typeof body.error === "string" && !SERVER_EXPIRED_PATTERN.test(body.error)) return { kind: "invalid-username", message: body.error };
    return { kind: "expired", message: body.error ?? EXPIRED };
  }
  return { kind: "error", message: body.error ?? "Could not finish sign-up. Try again." };
}
