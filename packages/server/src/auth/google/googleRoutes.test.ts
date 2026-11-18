import assert from "node:assert/strict";
import test from "node:test";
import type { HttpRequest, HttpResponse } from "../../http/middleware.js";
import { maintainerClearEmail, maintainerUnlinkGoogle } from "./googleMaintainer.js";
import { clientKey, registerGoogleRoutes, type GoogleRouteInternals } from "./googleRoutes.js";
import { createOAuthState, OAUTH_STATE_COOKIE } from "./oauthState.js";
import { readStateSecret } from "./googleConfig.js";

process.env.GOOGLE_CLIENT_ID = "cid";
process.env.GOOGLE_CLIENT_SECRET = "csecret";
process.env.GOOGLE_REDIRECT_URI = "https://localhost:2567/auth/google/callback";
process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token-long-enough-for-state";
process.env.CLIENT_ORIGIN = "https://client.test";
const CLIENT = "https://client.test";
const SECRET = readStateSecret()!;
const profile = { subject: "sub-1", email: "p@example.com", displayName: null };
type Session = { username: string; role: "maintainer" | "user" } | null;
type Existing = { username: string; suspended: boolean; isMaintainer: boolean; nickname: string | null; characterId: string | null } | null;

let counter = 0;
function harness(options: { session?: Session; existing?: Existing; identityEmailHeld?: boolean; link?: { ok: boolean; reason?: string }; verify?: () => Promise<typeof profile> } = {}) {
  const handlers = new Map<string, (request: HttpRequest, response: any) => Promise<void> | void>();
  const app = { get: (p: string, h: any) => handlers.set(`GET ${p}`, h), post: (p: string, h: any) => handlers.set(`POST ${p}`, h), delete: (p: string, h: any) => handlers.set(`DELETE ${p}`, h) };
  const issued: unknown[][] = [];
  const overrides: Partial<GoogleRouteInternals> = {
    hasDatabase: () => true,
    exchangeCode: async () => "id-token",
    verifyIdToken: options.verify ?? (async () => profile),
    findUserByIdentity: async () => options.existing ?? null,
    touchIdentity: async () => {},
    emailHeldByIdentity: async () => options.identityEmailHeld ?? false,
    createPendingSignup: async () => "pending-token-value-0123456789abcdef",
    linkIdentity: async () => (options.link ?? { ok: true }) as never,
    unlinkIdentity: async () => ({ ok: true }),
    issueSession: (async (...args: unknown[]) => { issued.push(args); return { sessionToken: "tok", user: {} }; }) as never,
  };
  registerGoogleRoutes(app, { requestSession: async () => options.session ?? null, setSessionCookie: () => {}, overrides });
  async function call(key: string, init: { query?: Record<string, string>; cookie?: string; body?: Record<string, unknown> } = {}) {
    const address = `10.0.0.${++counter}`;
    const request = { headers: {}, method: key.split(" ")[0], path: key.split(" ")[1], query: init.query ?? {}, body: init.body, params: {}, socket: { remoteAddress: address }, header: (n: string) => (n.toLowerCase() === "cookie" ? init.cookie : undefined), on() {}, destroy() {} } as unknown as HttpRequest;
    const out = { status: 200, json: undefined as unknown, redirects: [] as string[], cleared: [] as string[], cookies: [] as string[] };
    const response = {
      status(code: number) { out.status = code; return this; }, json(body: unknown) { out.json = body; }, sendStatus(code: number) { out.status = code; },
      setHeader() {}, cookie(name: string) { out.cookies.push(name); return this; }, clearCookie(name: string) { out.cleared.push(name); return this; },
      redirect(code: number, url: string) { out.status = code; out.redirects.push(url); }, send() {},
    } as unknown as HttpResponse;
    await handlers.get(key)!(request, response);
    return out;
  }
  return { call, issued };
}
const stateFor = (intent: "login" | "link", username: string | null = null) => {
  const created = createOAuthState(intent, username, SECRET);
  return { cookie: `${OAUTH_STATE_COOKIE}=${created.cookieValue}`, state: created.payload.state };
};
const callback = (h: ReturnType<typeof harness>, intent: "login" | "link" = "login", username: string | null = null) => {
  const s = stateFor(intent, username);
  return h.call("GET /auth/google/callback", { query: { code: "c", state: s.state }, cookie: s.cookie });
};
const user = (overrides: Partial<NonNullable<Existing>> = {}) => ({ username: "alice", suspended: false, isMaintainer: false, nickname: null, characterId: null, ...overrides });

test("callback: state cookie is cleared and every redirect targets the client origin", async () => {
  const h = harness({ existing: user() });
  for (const result of [
    await callback(h),
    await h.call("GET /auth/google/callback", { query: { error: "access_denied" } }),
    await h.call("GET /auth/google/callback", { query: { code: "c", state: "x" } }),
  ]) {
    assert.deepEqual(result.cleared, [OAUTH_STATE_COOKIE]);
    assert.ok(result.redirects.length === 1 && result.redirects[0]!.startsWith(`${CLIENT}/`));
  }
});

test("callback: denied, missing state, missing code", async () => {
  const h = harness();
  assert.equal((await h.call("GET /auth/google/callback", { query: { error: "access_denied" } })).redirects[0], `${CLIENT}/?error=google_denied`);
  assert.equal((await h.call("GET /auth/google/callback", { query: { code: "c" } })).redirects[0], `${CLIENT}/?error=google_failed`);
  const s = stateFor("login");
  assert.equal((await h.call("GET /auth/google/callback", { query: { state: s.state }, cookie: s.cookie })).redirects[0], `${CLIENT}/?error=google_failed`);
  assert.equal(h.issued.length, 0);
});

test("callback: token verification failure is google_failed", async () => {
  const h = harness({ verify: async () => { throw new Error("bad token"); } });
  assert.equal((await callback(h)).redirects[0], `${CLIENT}/?error=google_failed`);
});

test("login: known user gets a session, maintainer keeps the maintainer role, suspended is refused", async () => {
  const regular = harness({ existing: user() });
  assert.equal((await callback(regular)).redirects[0], `${CLIENT}/`);
  assert.equal(regular.issued[0]![1], "user");
  const maintainer = harness({ existing: user({ isMaintainer: true }) });
  assert.equal((await callback(maintainer)).redirects[0], `${CLIENT}/`);
  assert.equal(maintainer.issued[0]![1], "maintainer");
  const suspended = harness({ existing: user({ suspended: true, isMaintainer: true }) });
  assert.equal((await callback(suspended)).redirects[0], `${CLIENT}/?error=google_failed`);
  assert.equal(suspended.issued.length, 0);
});

test("login: new identity goes to sign-up with the token in the fragment; identity-email conflict is refused", async () => {
  const fresh = await callback(harness());
  assert.match(fresh.redirects[0]!, /^https:\/\/client\.test\/signup\/google#token=/);
  const conflict = harness({ identityEmailHeld: true });
  assert.equal((await callback(conflict)).redirects[0], `${CLIENT}/?error=google_conflict`);
});

test("link: session user must match the user recorded in the state", async () => {
  const mismatch = harness({ session: { username: "mallory", role: "user" } });
  assert.equal((await callback(mismatch, "link", "alice")).redirects[0], `${CLIENT}/?error=google_failed`);
  const noSession = harness();
  assert.equal((await callback(noSession, "link", "alice")).redirects[0], `${CLIENT}/?error=google_failed`);
  const ok = harness({ session: { username: "alice", role: "user" } });
  assert.equal((await callback(ok, "link", "alice")).redirects[0], `${CLIENT}/settings?google=connected`);
  const taken = harness({ session: { username: "alice", role: "user" }, existing: user({ username: "bob" }) });
  assert.equal((await callback(taken, "link", "alice")).redirects[0], `${CLIENT}/?error=google_conflict`);
  const dup = harness({ session: { username: "alice", role: "user" }, link: { ok: false, reason: "conflict" } });
  assert.equal((await callback(dup, "link", "alice")).redirects[0], `${CLIENT}/?error=google_conflict`);
});

test("start: link is POST-only and needs a session; GET start only accepts login", async () => {
  const anonymous = harness();
  assert.equal((await anonymous.call("POST /auth/google/link")).status, 401);
  assert.equal((await anonymous.call("GET /auth/google/start", { query: { intent: "link" } })).status, 400);
  const signedIn = harness({ session: { username: "alice", role: "user" } });
  const link = await signedIn.call("POST /auth/google/link");
  assert.equal(link.status, 200);
  assert.match((link.json as { url: string }).url, /^https:\/\/accounts\.google\.com\//);
  assert.deepEqual(link.cookies, [OAUTH_STATE_COOKIE]);
  const login = await signedIn.call("GET /auth/google/start", { query: { intent: "login" } });
  assert.match(login.redirects[0]!, /^https:\/\/accounts\.google\.com\//);
});

test("DELETE /auth/google and complete require valid input; config is reported", async () => {
  const h = harness();
  assert.equal((await h.call("DELETE /auth/google")).status, 401);
  assert.equal((await h.call("POST /auth/google/complete", { body: { pendingToken: "short", username: "alice" } })).status, 400);
  assert.deepEqual((await h.call("GET /auth/config")).json, { google: true });
});

test("rate-limit key ignores X-Forwarded-For unless proxy headers are trusted", () => {
  const request = { header: () => "1.2.3.4, 5.6.7.8", socket: { remoteAddress: "9.9.9.9" } } as unknown as HttpRequest;
  assert.equal(clientKey(request, {}), "9.9.9.9");
  assert.equal(clientKey(request, { TRUST_PROXY_HEADERS: "1" }), "1.2.3.4");
});

test("maintainer Google endpoints refuse anyone who is not a maintainer", async () => {
  const calls: string[] = [];
  const dependencies = { unlink: async () => { calls.push("unlink"); return { ok: true as const }; }, clearEmail: async () => { calls.push("clear"); return { ok: true as const }; }, disconnectAccount: async (username: string) => { calls.push(`kick:${username}`); } };
  for (const session of [null, { username: "alice", role: "user" as const }]) {
    assert.equal((await maintainerUnlinkGoogle(session, "bob", dependencies)).status, 403);
    assert.equal((await maintainerClearEmail(session, "bob", dependencies)).status, 403);
  }
  assert.deepEqual(calls, []);
  const maintainer = { username: "root", role: "maintainer" as const };
  assert.equal((await maintainerUnlinkGoogle(maintainer, "bob", dependencies)).status, 200);
  assert.equal((await maintainerClearEmail(maintainer, "!!", dependencies)).status, 400);
  assert.deepEqual(calls, ["unlink", "kick:bob"]);
  const refused = await maintainerUnlinkGoogle(maintainer, "bob", { ...dependencies, unlink: async () => ({ ok: false as const, reason: "password_required" as const }) });
  assert.equal(refused.status, 409);
});

test("maintainer unlink of another user kicks them; self-unlink and failures behave", async () => {
  const calls: string[] = [];
  const base = { unlink: async () => ({ ok: true as const }), clearEmail: async () => ({ ok: true as const }), disconnectAccount: async (u: string) => { calls.push(u); } };
  const maintainer = { username: "root", role: "maintainer" as const };
  await maintainerUnlinkGoogle(maintainer, "root", base);
  assert.deepEqual(calls, []);
  const failing = await maintainerUnlinkGoogle(maintainer, "bob", { ...base, disconnectAccount: async () => { throw new Error("down"); } });
  assert.equal(failing.status, 503);
  const notFound = await maintainerUnlinkGoogle(maintainer, "bob", { ...base, unlink: async () => ({ ok: false as const, reason: "not_found" as const }) });
  assert.equal(notFound.status, 404);
  assert.deepEqual(calls, []);
});

test("maintainerClearEmail reports success, conflict and not found", async () => {
  const maintainer = { username: "root", role: "maintainer" as const };
  const make = (result: { ok: true } | { ok: false; reason: "conflict" | "not_found" }) => ({ unlink: async () => ({ ok: true as const }), clearEmail: async () => result, disconnectAccount: async () => {} });
  assert.equal((await maintainerClearEmail(maintainer, "bob", make({ ok: true }))).status, 200);
  assert.equal((await maintainerClearEmail(maintainer, "bob", make({ ok: false, reason: "conflict" }))).status, 409);
  assert.equal((await maintainerClearEmail(maintainer, "bob", make({ ok: false, reason: "not_found" }))).status, 404);
});

test("callback: rate limited requests redirect to the client with google_rate_limited", async () => {
  const h = harness({ existing: user() });
  const s = stateFor("login");
  let last: Awaited<ReturnType<typeof h.call>> | undefined;
  // Same socket address for every request: reuse the harness but pin the address.
  for (let i = 0; i < 25; i += 1) { counter -= 1; last = await h.call("GET /auth/google/callback", { query: { code: "c", state: s.state }, cookie: s.cookie }); }
  assert.equal(last!.redirects[0], `${CLIENT}/?error=google_rate_limited`);
  assert.deepEqual(last!.cleared, [OAUTH_STATE_COOKIE]);
});
