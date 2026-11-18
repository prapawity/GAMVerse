import assert from "node:assert/strict";
import test from "node:test";
import { googleErrorMessage, readGoogleErrorFromSearch } from "./googleAuthErrors";

test("every server error code has a message and unknown codes have none", () => {
  for (const code of ["google_denied", "google_failed", "google_conflict", "google_rate_limited", "google_disabled"]) assert.ok(googleErrorMessage(code));
  assert.equal(googleErrorMessage("toString"), null);
  assert.equal(googleErrorMessage("nope"), null);
  assert.equal(googleErrorMessage(null), null);
});

test("conflict message points to password sign-in, settings and maintainers", () => {
  const text = googleErrorMessage("google_conflict")!;
  assert.match(text, /already used by another account/);
  assert.match(text, /settings/);
  assert.match(text, /maintainer/);
});

test("the error parameter is removed while other parameters survive", () => {
  assert.deepEqual(readGoogleErrorFromSearch("?error=google_denied"), { message: googleErrorMessage("google_denied"), cleanedSearch: "" });
  assert.equal(readGoogleErrorFromSearch("?a=1&error=google_failed").cleanedSearch, "?a=1");
  assert.deepEqual(readGoogleErrorFromSearch("?error=bogus"), { message: null, cleanedSearch: "?error=bogus" });
});

test("disabled code explains Google is off", () => {
  assert.equal(googleErrorMessage("google_disabled"), "Google sign-in is currently turned off. Sign in with your username and password.");
});
