import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { GoogleConfig } from "./googleConfig.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;
const CLOCK_TOLERANCE_S = 30;
const MAX_EMAIL_CHARS = 254;
const MAX_DISPLAY_NAME_CHARS = 100;

export type GoogleProfile = { subject: string; email: string; displayName: string | null };

let remoteKeys: JWTVerifyGetKey | undefined;
const googleKeys = (): JWTVerifyGetKey => (remoteKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)));

export function buildGoogleAuthUrl(config: GoogleConfig, params: { state: string; nonce: string; challenge: string }): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Exchanges the authorization code (with the PKCE verifier) and returns the raw ID token. */
export async function exchangeGoogleCode(config: GoogleConfig, code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status}).`);
  const body = await response.json() as { id_token?: unknown };
  if (typeof body.id_token !== "string" || !body.id_token) throw new Error("Google did not return an ID token.");
  return body.id_token;
}

/** Verifies signature, issuer, audience, expiry, nonce and a verified email. Throws on any failure. */
export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
  options: { keys?: JWTVerifyGetKey; now?: Date } = {},
): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, options.keys ?? googleKeys(), {
    issuer: GOOGLE_ISSUERS,
    audience: expected.clientId,
    algorithms: ["RS256"],
    clockTolerance: CLOCK_TOLERANCE_S,
    ...(options.now ? { currentDate: options.now } : {}),
  });
  if (payload.nonce !== expected.nonce) throw new errors.JWTClaimValidationFailed("nonce mismatch", payload, "nonce", "check_failed");
  if (payload.email_verified !== true) throw new errors.JWTClaimValidationFailed("email not verified", payload, "email_verified", "check_failed");
  const { sub, email, name } = payload as { sub?: unknown; email?: unknown; name?: unknown };
  if (typeof sub !== "string" || !sub || typeof email !== "string" || !email || email.length > MAX_EMAIL_CHARS) {
    throw new errors.JWTClaimValidationFailed("missing subject or email", payload, "email", "check_failed");
  }
  return {
    subject: sub,
    email: email.trim().toLowerCase(),
    displayName: typeof name === "string" && name.trim() ? name.trim().slice(0, MAX_DISPLAY_NAME_CHARS) : null,
  };
}
