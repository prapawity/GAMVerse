import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Single use: there is no server-side store of used states. Replaying a captured state cookie is useless because
// Google's authorization code is single use and bound to the PKCE verifier. The cookie is also cleared on every callback.
export const OAUTH_STATE_COOKIE = "gv_google_oauth";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export type OAuthIntent = "login" | "link";

export type OAuthStatePayload = {
  state: string;
  nonce: string;
  verifier: string;
  intent: OAuthIntent;
  /** Set for intent=link: the account that started the flow. */
  username: string | null;
  expiresAt: number;
};

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");
const token = () => randomBytes(32).toString("base64url");

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createOAuthState(intent: OAuthIntent, username: string | null, secret: string, now = Date.now()) {
  const payload: OAuthStatePayload = { state: token(), nonce: token(), verifier: token(), intent, username, expiresAt: now + OAUTH_STATE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { payload, challenge: pkceChallenge(payload.verifier), cookieValue: `${body}.${sign(body, secret)}` };
}

/** Returns the payload only when the signature, expiry and the state echoed by Google all match. */
export function verifyOAuthState(cookieValue: unknown, returnedState: unknown, secret: string, now = Date.now()): OAuthStatePayload | null {
  if (typeof cookieValue !== "string" || typeof returnedState !== "string") return null;
  const [body, signature, ...rest] = cookieValue.split(".");
  if (!body || !signature || rest.length) return null;
  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  let payload: Partial<OAuthStatePayload>;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (typeof payload.state !== "string" || typeof payload.nonce !== "string" || typeof payload.verifier !== "string") return null;
  if (payload.intent !== "login" && payload.intent !== "link") return null;
  if (payload.username !== null && typeof payload.username !== "string") return null;
  if (typeof payload.expiresAt !== "number" || payload.expiresAt <= now) return null;
  const stateA = Buffer.from(payload.state);
  const stateB = Buffer.from(returnedState);
  if (stateA.length !== stateB.length || !timingSafeEqual(stateA, stateB)) return null;
  return payload as OAuthStatePayload;
}

export function readOAuthStateCookie(header: string | undefined): string | undefined {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`))?.slice(OAUTH_STATE_COOKIE.length + 1);
}
