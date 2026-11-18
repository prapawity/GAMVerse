import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { buildGoogleAuthUrl, exchangeGoogleCode, verifyGoogleIdToken } from "./googleTokens.js";

const CLIENT_ID = "client-123.apps.googleusercontent.com";
const NONCE = "nonce-abc";
const NOW = new Date("2026-01-01T12:00:00Z");
const nowS = Math.floor(NOW.getTime() / 1000);
const good = keyPair();
const other = keyPair();

async function keyPair() { return generateKeyPair("RS256"); }
async function keys() {
  const jwk: JWK = { ...(await exportJWK((await good).publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  return createLocalJWKSet({ keys: [jwk] });
}
async function token(claims: Record<string, unknown> = {}, options: { iss?: string; aud?: string; exp?: number; signer?: Promise<Awaited<ReturnType<typeof generateKeyPair>>> } = {}) {
  return new SignJWT({ nonce: NONCE, email: "Person@Example.com", email_verified: true, name: "Pat Person", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject("sub-1").setIssuer(options.iss ?? "https://accounts.google.com").setAudience(options.aud ?? CLIENT_ID)
    .setIssuedAt(nowS - 60).setExpirationTime(options.exp ?? nowS + 3600)
    .sign((await (options.signer ?? good)).privateKey);
}
const verify = async (jwt: string, nonce = NONCE) => verifyGoogleIdToken(jwt, { clientId: CLIENT_ID, nonce }, { keys: await keys(), now: NOW });

test("accepts a valid ID token and normalizes the profile", async () => {
  assert.deepEqual(await verify(await token()), { subject: "sub-1", email: "person@example.com", displayName: "Pat Person" });
  assert.equal((await verify(await token({}, { iss: "accounts.google.com" }))).subject, "sub-1");
});

test("rejects wrong audience, nonce, issuer, expiry, signing key and unverified email", async () => {
  await assert.rejects(verify(await token({}, { aud: "someone-else" })));
  await assert.rejects(verify(await token(), "different-nonce"));
  await assert.rejects(verify(await token({ nonce: undefined })));
  await assert.rejects(verify(await token({}, { iss: "https://evil.example" })));
  await assert.rejects(verify(await token({}, { exp: nowS - 3600 })));
  await assert.rejects(verify(await token({}, { signer: other })));
  await assert.rejects(verify(await token({ email_verified: false })));
  await assert.rejects(verify(await token({ email_verified: "true" })));
  await assert.rejects(verify(await token({ email: undefined })));
});

test("auth URL carries PKCE, state and nonce; code exchange sends the verifier and returns the ID token", async () => {
  const config = { clientId: CLIENT_ID, clientSecret: "secret", redirectUri: "https://app.test/auth/google/callback" };
  const url = new URL(buildGoogleAuthUrl(config, { state: "s", nonce: "n", challenge: "c" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), "s");
  assert.equal(url.searchParams.get("nonce"), "n");
  let sent = "";
  const fetchStub = (async (_url: unknown, init: { body: URLSearchParams }) => { sent = init.body.toString(); return new Response(JSON.stringify({ id_token: "jwt" })); }) as unknown as typeof fetch;
  assert.equal(await exchangeGoogleCode(config, "code-1", "verifier-1", fetchStub), "jwt");
  assert.match(sent, /code_verifier=verifier-1/);
  const failing = (async () => new Response("no", { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(exchangeGoogleCode(config, "c", "v", failing));
});
