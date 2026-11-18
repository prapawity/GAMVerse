import { createHmac } from "node:crypto";

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };

const STATE_KEY_CONTEXT = "gammyverse:google-oauth-state:v1";
const MIN_STATE_SECRET_CHARS = 16;

/** Google sign-in is on only when the client id, secret and redirect URI are all set. */
export function readGoogleConfig(env: NodeJS.ProcessEnv = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readGoogleConfig(env) !== null;
}

/**
 * HMAC key for the OAuth state cookie. GOOGLE_STATE_SECRET wins when set; otherwise the key is derived
 * from INTERNAL_SERVICE_TOKEN with a context label, so the raw token is never used as the key directly.
 */
export function readStateSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.GOOGLE_STATE_SECRET?.trim();
  if (explicit) return explicit.length >= MIN_STATE_SECRET_CHARS ? explicit : null;
  const internal = env.INTERNAL_SERVICE_TOKEN?.trim();
  if (!internal || internal.length < MIN_STATE_SECRET_CHARS) return null;
  return createHmac("sha256", internal).update(STATE_KEY_CONTEXT).digest("hex");
}
