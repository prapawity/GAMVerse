import assert from "node:assert/strict";
import test from "node:test";
import { completeGoogleSignup } from "./googleSignupRequest";

const reply = (status: number, body: unknown) => (async () => Response.json(body, { status })) as typeof fetch;

test("invalid usernames never reach the network", async () => {
  const fetcher = (async () => { throw new Error("called"); }) as typeof fetch;
  assert.equal((await completeGoogleSignup("e", "t", "a b", fetcher)).kind, "invalid-username");
});

test("sends the normalised username and maps statuses", async () => {
  let sent: unknown;
  const spy = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return Response.json({ user: { username: "bob" } }, { status: 201 }); }) as unknown as typeof fetch;
  assert.equal((await completeGoogleSignup("e", "tok", "  Bob ", spy)).kind, "ok");
  assert.deepEqual(sent, { pendingToken: "tok", username: "bob" });
  assert.equal((await completeGoogleSignup("e", "t", "bob", reply(409, { error: "taken" }))).kind, "username-taken");
  assert.equal((await completeGoogleSignup("e", "t", "bob", reply(400, { error: "This sign-up link is invalid or expired. Start again." }))).kind, "expired");
  assert.equal((await completeGoogleSignup("e", "t", "bob", reply(400, { error: "Username must be 3–24 characters." }))).kind, "invalid-username");
  assert.equal((await completeGoogleSignup("e", "t", "bob", reply(503, {}))).kind, "error");
});
