import assert from "node:assert/strict";
import test from "node:test";
import { capturePendingToken, parsePendingTokenHash, resetCapturedPendingToken } from "./pendingSignupToken";

const TOKEN = "A".repeat(43);

test("parses a well-formed token and rejects malformed ones", () => {
  assert.equal(parsePendingTokenHash(`#token=${TOKEN}`), TOKEN);
  assert.equal(parsePendingTokenHash(""), null);
  assert.equal(parsePendingTokenHash("#token=bogus"), null);
  assert.equal(parsePendingTokenHash(`#other=${TOKEN}`), null);
  assert.equal(parsePendingTokenHash(`#token=${TOKEN}!`), null);
});

test("capture strips the fragment once and keeps returning the token", () => {
  resetCapturedPendingToken();
  const calls: string[] = [];
  const history = { state: null, replaceState: (_s: unknown, _t: string, url: string) => { calls.push(url); } };
  const location = { hash: `#token=${TOKEN}`, pathname: "/signup/google", search: "" };
  assert.equal(capturePendingToken(location, history), TOKEN);
  assert.equal(capturePendingToken({ ...location, hash: "" }, history), TOKEN);
  assert.deepEqual(calls, ["/signup/google"]);
  resetCapturedPendingToken();
});

test("an invalid fragment is still stripped", () => {
  resetCapturedPendingToken();
  const calls: string[] = [];
  const history = { state: null, replaceState: (_s: unknown, _t: string, url: string) => { calls.push(url); } };
  assert.equal(capturePendingToken({ hash: "#token=bogus", pathname: "/signup/google", search: "" }, history), null);
  assert.equal(calls.length, 1);
  resetCapturedPendingToken();
});
