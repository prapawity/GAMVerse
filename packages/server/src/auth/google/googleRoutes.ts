import { normalizeAccountUsername } from "@gammyverse/shared";
import { database } from "../../infra/db.js";
import { createWriteRateLimiter } from "../../http/writeRateLimit.js";
import { logServerError } from "../../infra/logger.js";
import type { HttpRequest, HttpResponse } from "../../http/middleware.js";
import { issueSession as defaultIssueSession, setInitialAccountPassword } from "../service.js";
import { isGoogleLoginEnabled, readGoogleConfig, readStateSecret } from "./googleConfig.js";
import { readPlatformFeatureFlags } from "../../infra/platformFeatures.js";
import { completePendingSignup, readGoogleAccountStatus, createPendingSignup, emailHeldByIdentity, findUserByIdentity, linkIdentity, touchIdentity, unlinkIdentity } from "./identityRepository.js";
import { createOAuthState, OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_MS, readOAuthStateCookie, verifyOAuthState } from "./oauthState.js";
import { buildGoogleAuthUrl, exchangeGoogleCode, verifyGoogleIdToken } from "./googleTokens.js";
import type { PlatformRole } from "../service.js";

const AUTH_RATE_LIMIT = 20;
const AUTH_RATE_WINDOW_MS = 60_000;
const COOKIE_PATH = "/auth/google";
const PENDING_TOKEN_FORMAT = /^[A-Za-z0-9_-]{30,100}$/;

// Redirect targets are fixed paths on the configured client origin. Nothing from the request ever becomes a redirect target.
const REDIRECT_HOME = "/";
const REDIRECT_SETTINGS_CONNECTED = "/settings?google=connected";
const REDIRECT_SIGNUP = "/signup/google";
const redirectError = (code: "google_denied" | "google_failed" | "google_conflict" | "google_rate_limited" | "google_disabled") => `/?error=${code}`;

/** The API and the web client can sit on different origins, so every redirect is a fixed path on the first CLIENT_ORIGIN. */
export function clientUrl(path: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = (env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",")[0]!.trim().replace(/\/+$/, "");
  return `${base}${path}`;
}

type GoogleResponse = HttpResponse & { redirect(status: number, url: string): void };
type Session = { username: string; role: PlatformRole } | null;
type App = { get(path: string, handler: Handler): void; post(path: string, handler: Handler): void; delete(path: string, handler: Handler): void };
type Handler = (request: HttpRequest, response: GoogleResponse) => Promise<void> | void;
export type GoogleRouteDependencies = {
  requestSession(request: HttpRequest): Promise<Session>;
  setSessionCookie(response: HttpResponse, token: string): void;
  /** Overridable for tests. */
  overrides?: Partial<GoogleRouteInternals>;
};
export type GoogleRouteInternals = {
  hasDatabase(): boolean;
  exchangeCode: typeof exchangeGoogleCode;
  verifyIdToken: typeof verifyGoogleIdToken;
  findUserByIdentity: typeof findUserByIdentity;
  touchIdentity: typeof touchIdentity;
  emailHeldByIdentity: typeof emailHeldByIdentity;
  createPendingSignup: typeof createPendingSignup;
  completePendingSignup: typeof completePendingSignup;
  linkIdentity: typeof linkIdentity;
  unlinkIdentity: typeof unlinkIdentity;
  issueSession: typeof defaultIssueSession;
  /** The maintainer "googleSignIn" platform flag. Read per request, so a toggle applies immediately. */
  readFlag(): Promise<boolean>;
  readStatus: typeof readGoogleAccountStatus;
  setInitialPassword: typeof setInitialAccountPassword;
};
const defaults: GoogleRouteInternals = {
  hasDatabase: () => Boolean(database),
  exchangeCode: exchangeGoogleCode, verifyIdToken: verifyGoogleIdToken,
  findUserByIdentity, touchIdentity, emailHeldByIdentity, createPendingSignup, completePendingSignup, linkIdentity, unlinkIdentity,
  issueSession: defaultIssueSession,
  readFlag: async () => (await readPlatformFeatureFlags()).googleSignIn,
  readStatus: readGoogleAccountStatus,
  setInitialPassword: setInitialAccountPassword,
};

const limiter = createWriteRateLimiter(AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS);

/**
 * Rate-limit key. The socket address is used unless TRUST_PROXY_HEADERS=1, because X-Forwarded-For is
 * client-controlled when the API is reached directly. Behind Caddy, which rewrites X-Forwarded-For for
 * untrusted clients, set TRUST_PROXY_HEADERS=1 so every user does not share the proxy's address.
 */
export function clientKey(request: HttpRequest, env: NodeJS.ProcessEnv = process.env) {
  if (env.TRUST_PROXY_HEADERS === "1") {
    const forwarded = request.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return (request as HttpRequest & { socket?: { remoteAddress?: string } }).socket?.remoteAddress ?? "unknown";
}

function stateCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: COOKIE_PATH, maxAge: OAUTH_STATE_TTL_MS };
}

function clearStateCookie(response: HttpResponse) {
  response.clearCookie(OAUTH_STATE_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: COOKIE_PATH });
}

export function registerGoogleRoutes(app: App, dependencies: GoogleRouteDependencies) {
  const d: GoogleRouteInternals = { ...defaults, ...dependencies.overrides };
  const redirectTo = (response: GoogleResponse, path: string) => response.redirect(302, clientUrl(path));
  const configured = () => d.hasDatabase() && isGoogleLoginEnabled();
  /** Fails closed: a flag read error counts as disabled. */
  const flagOn = async () => { try { return await d.readFlag(); } catch (error) { logServerError("api", "google.flag.read.failed", error, {}); return false; } };
  const enabled = async () => configured() && await flagOn();
  const limited = (request: HttpRequest, response: GoogleResponse) => {
    const wait = limiter.check(clientKey(request));
    if (wait === 0) return false;
    response.setHeader("Retry-After", String(wait));
    response.status(429).json({ error: "Too many sign-in attempts. Try again shortly." });
    return true;
  };

  app.get("/auth/config", async (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({ google: await enabled() });
  });

  const startFlow = (response: GoogleResponse, intent: "login" | "link", username: string | null) => {
    const config = readGoogleConfig();
    const secret = readStateSecret();
    if (!config || !secret) return null;
    const { payload, challenge, cookieValue } = createOAuthState(intent, username, secret);
    response.cookie(OAUTH_STATE_COOKIE, cookieValue, stateCookieOptions());
    response.setHeader("Cache-Control", "no-store");
    return buildGoogleAuthUrl(config, { state: payload.state, nonce: payload.nonce, challenge });
  };

  app.get("/auth/google/start", async (request, response) => {
    if (!await enabled() || !readStateSecret()) { response.sendStatus(404); return; }
    if (limited(request, response)) return;
    // Link is POST-only (origin-guarded) so a cross-site page cannot start it with a plain navigation.
    if (request.query?.intent !== "login") { response.status(400).json({ error: "Unknown sign-in intent." }); return; }
    const url = startFlow(response, "login", null);
    if (!url) { response.sendStatus(404); return; }
    response.redirect(302, url);
  });

  app.post("/auth/google/link", async (request, response) => {
    if (!await enabled() || !readStateSecret()) { response.sendStatus(404); return; }
    if (limited(request, response)) return;
    const session = await dependencies.requestSession(request);
    if (!session) { response.status(401).json({ error: "Authentication required." }); return; }
    const url = startFlow(response, "link", session.username);
    if (!url) { response.sendStatus(404); return; }
    response.json({ url });
  });

  app.get("/auth/google/callback", async (request, response) => {
    const config = readGoogleConfig();
    const secret = readStateSecret();
    if (!configured() || !config || !secret) { response.sendStatus(404); return; }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    // The state cookie is single use: clear it whatever happens next.
    const cookie = readOAuthStateCookie(request.header("cookie"));
    clearStateCookie(response);
    // Switched off by a maintainer while a flow was in flight: nothing is exchanged, linked or signed in.
    if (!await flagOn()) { redirectTo(response, redirectError("google_disabled")); return; }
    if (limiter.check(clientKey(request)) !== 0) { redirectTo(response, redirectError("google_rate_limited")); return; }
    if (typeof request.query?.error === "string") { redirectTo(response, redirectError("google_denied")); return; }
    const state = verifyOAuthState(cookie, request.query?.state, secret);
    const code = request.query?.code;
    if (!state || typeof code !== "string" || !code) { redirectTo(response, redirectError("google_failed")); return; }
    try {
      const idToken = await d.exchangeCode(config, code, state.verifier);
      const profile = await d.verifyIdToken(idToken, { clientId: config.clientId, nonce: state.nonce });
      const existing = await d.findUserByIdentity(profile.subject);

      if (state.intent === "link") {
        const session = await dependencies.requestSession(request);
        if (!session || session.username !== state.username) { redirectTo(response, redirectError("google_failed")); return; }
        if (existing) { redirectTo(response, existing.username === session.username ? REDIRECT_SETTINGS_CONNECTED : redirectError("google_conflict")); return; }
        const linked = await d.linkIdentity(session.username, profile);
        redirectTo(response, linked.ok ? REDIRECT_SETTINGS_CONNECTED : redirectError(linked.reason === "conflict" ? "google_conflict" : "google_failed"));
        return;
      }

      if (existing) {
        // Suspended accounts never get a session. Maintainers keep their platform role.
        if (existing.suspended) { redirectTo(response, redirectError("google_failed")); return; }
        const session = await d.issueSession(existing.username, existing.isMaintainer ? "maintainer" : "user", existing.characterId, existing.nickname);
        await d.touchIdentity(profile.subject);
        dependencies.setSessionCookie(response, session.sessionToken);
        redirectTo(response, REDIRECT_HOME);
        return;
      }
      if (await d.emailHeldByIdentity(profile.email)) { redirectTo(response, redirectError("google_conflict")); return; }
      const token = await d.createPendingSignup(profile);
      // The token travels in the URL fragment so it never reaches server logs or Referer headers.
      redirectTo(response, `${REDIRECT_SIGNUP}#token=${encodeURIComponent(token)}`);
    } catch (error) {
      logServerError("api", "google.callback.failed", error, {});
      redirectTo(response, redirectError("google_failed"));
    }
  });

  app.post("/auth/google/complete", async (request, response) => {
    if (!await enabled()) { response.sendStatus(404); return; }
    if (limited(request, response)) return;
    const token = request.body?.pendingToken;
    const username = normalizeAccountUsername(request.body?.username);
    if (typeof token !== "string" || !PENDING_TOKEN_FORMAT.test(token)) { response.status(400).json({ error: "This sign-up link is invalid or expired. Start again." }); return; }
    if (!username) { response.status(400).json({ error: "Username must be 3–24 characters: letters, numbers, dot, dash or underscore." }); return; }
    try {
      const result = await d.completePendingSignup(token, username);
      if (!result.ok) {
        if (result.reason === "conflict") {
          response.status(409).json({ error: result.usernameTaken ? "That username is already taken." : "That Google account cannot be used for a new account." });
        } else response.status(400).json({ error: "This sign-up link is invalid or expired. Start again." });
        return;
      }
      const session = await d.issueSession(username, "user", null, null);
      dependencies.setSessionCookie(response, session.sessionToken);
      response.status(201).json({ user: session.user });
    } catch (error) {
      logServerError("api", "google.complete.failed", error, {});
      response.status(503).json({ error: "Could not finish sign-up. Try again." });
    }
  });

  // Unlink deliberately ignores the maintainer flag so people can clean up while Google sign-in is off.
  app.delete("/auth/google", async (request, response) => {
    if (!d.hasDatabase()) { response.sendStatus(404); return; }
    const session = await dependencies.requestSession(request);
    if (!session) { response.status(401).json({ error: "Authentication required." }); return; }
    try {
      const result = await d.unlinkIdentity(session.username);
      if (result.ok) response.json({ ok: true });
      else if (result.reason === "password_required") response.status(409).json({ error: "Set a password before disconnecting Google." });
      else response.status(404).json({ error: "No Google account is connected." });
    } catch (error) {
      logServerError("api", "google.unlink.failed", error, {});
      response.status(503).json({ error: "Could not disconnect Google. Try again." });
    }
  });

  /** Own-account Google/password state for the settings page. Never takes a username from the request. */
  app.get("/auth/google/status", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const session = await dependencies.requestSession(request);
    if (!session) { response.status(401).json({ error: "Authentication required." }); return; }
    try {
      const status = await d.readStatus(session.username);
      if (!status) { response.status(404).json({ error: "Account not found." }); return; }
      response.json({ enabled: await enabled(), linked: status.linked, email: status.email, hasPassword: status.hasPassword });
    } catch (error) {
      logServerError("api", "google.status.failed", error, {});
      response.status(503).json({ error: "Could not load Google status. Try again." });
    }
  });

  /** First password for a passwordless account. Rejects accounts that already have one (use /auth/password/change). */
  app.post("/auth/password/set", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (limited(request, response)) return;
    const session = await dependencies.requestSession(request);
    if (!session) { response.status(401).json({ error: "Authentication required." }); return; }
    try {
      const result = await d.setInitialPassword(session.username, request.body?.newPassword);
      if ("error" in result) {
        const code = "code" in result ? result.code : undefined;
        response.status(code === "has_password" ? 409 : code === "suspended" ? 403 : 400).json({ error: result.error });
        return;
      }
      // Password saved but the new session could not be issued: tell the client to sign in again.
      if ("reauth" in result) { response.json({ user: null, reauth: true, message: "Password set. Sign in again." }); return; }
      dependencies.setSessionCookie(response, result.sessionToken);
      response.json({ user: result.user });
    } catch (error) {
      logServerError("api", "password.set.failed", error, {});
      response.status(503).json({ error: "Could not set the password. Try again." });
    }
  });
}
