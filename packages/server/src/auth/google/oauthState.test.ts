import assert from "node:assert/strict";
import test from "node:test";
import { createOAuthState, OAUTH_STATE_TTL_MS, pkceChallenge, readOAuthStateCookie, verifyOAuthState } from "./oauthState.js";
import { readGoogleConfig, readStateSecret } from "./googleConfig.js";

const SECRET = "test-secret-with-enough-length";
const NOW = 1_700_000_000_000;

test("state cookie round-trips with matching returned state", () => {
  const { payload, cookieValue, challenge } = createOAuthState("link", "alice", SECRET, NOW);
  const verified = verifyOAuthState(cookieValue, payload.state, SECRET, NOW + 1_000);
  assert.deepEqual(verified, payload);
  assert.equal(verified?.username, "alice");
  assert.equal(challenge, pkceChallenge(payload.verifier));
});

test("state cookie rejects wrong state, tampering, wrong secret, expiry and malformed input", () => {
  const { payload, cookieValue } = createOAuthState("login", null, SECRET, NOW);
  assert.equal(verifyOAuthState(cookieValue, "other-state", SECRET, NOW), null);
  assert.equal(verifyOAuthState(cookieValue, payload.state, "another-secret-long-enough", NOW), null);
  assert.equal(verifyOAuthState(cookieValue, payload.state, SECRET, NOW + OAUTH_STATE_TTL_MS), null);
  const [body, signature] = cookieValue.split(".");
  const forged = Buffer.from(JSON.stringify({ ...payload, intent: "link", username: "victim" })).toString("base64url");
  assert.equal(verifyOAuthState(`${forged}.${signature}`, payload.state, SECRET, NOW), null);
  assert.equal(verifyOAuthState(`${body}.`, payload.state, SECRET, NOW), null);
  for (const bad of [undefined, 5, "", "a.b.c", "nodot"]) assert.equal(verifyOAuthState(bad, payload.state, SECRET, NOW), null);
  assert.equal(verifyOAuthState(cookieValue, undefined, SECRET, NOW), null);
});

test("each state is unique", () => {
  const a = createOAuthState("login", null, SECRET, NOW).payload;
  const b = createOAuthState("login", null, SECRET, NOW).payload;
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.verifier, b.verifier);
});

test("cookie header parsing finds the state cookie", () => {
  assert.equal(readOAuthStateCookie("a=1; gv_google_oauth=abc.def; gv_session=x"), "abc.def");
  assert.equal(readOAuthStateCookie("gv_session=x"), undefined);
});

test("Google is disabled unless client id, secret and redirect are all set", () => {
  assert.equal(readGoogleConfig({}), null);
  assert.equal(readGoogleConfig({ GOOGLE_CLIENT_SECRET: "s", GOOGLE_REDIRECT_URI: "https://x/cb" }), null);
  assert.equal(readGoogleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }), null);
  assert.deepEqual(readGoogleConfig({ GOOGLE_CLIENT_ID: " id ", GOOGLE_CLIENT_SECRET: "s", GOOGLE_REDIRECT_URI: "https://x/cb" }), { clientId: "id", clientSecret: "s", redirectUri: "https://x/cb" });
});

test("state secret prefers GOOGLE_STATE_SECRET and derives from the internal token otherwise", () => {
  assert.equal(readStateSecret({}), null);
  assert.equal(readStateSecret({ INTERNAL_SERVICE_TOKEN: "short" }), null);
  assert.equal(readStateSecret({ GOOGLE_STATE_SECRET: "explicit-secret-long-enough" }), "explicit-secret-long-enough");
  const internal = "internal-service-token-long-enough";
  const derived = readStateSecret({ INTERNAL_SERVICE_TOKEN: internal });
  assert.ok(derived && derived !== internal);
  assert.equal(derived, readStateSecret({ INTERNAL_SERVICE_TOKEN: internal }));
});

test("post-callback redirects go to a fixed path on the first CLIENT_ORIGIN", async () => {
  const { clientUrl } = await import("./googleRoutes.js");
  assert.equal(clientUrl("/", { CLIENT_ORIGIN: "https://localhost:5173/, https://other" }), "https://localhost:5173/");
  assert.equal(clientUrl("/?error=google_failed", {}), "http://localhost:5173/?error=google_failed");
});
