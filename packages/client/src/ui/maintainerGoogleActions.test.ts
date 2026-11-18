import assert from "node:assert/strict";
import test from "node:test";
import { maintainerGoogleActionPath, maintainerGoogleAvailability, maintainerGoogleConfirmText } from "./maintainerGoogleActions";

test("paths encode the username", () => {
  assert.equal(maintainerGoogleActionPath("a b", "google"), "/api/maintainer/users/a%20b/google");
  assert.equal(maintainerGoogleActionPath("x", "email"), "/api/maintainer/users/x/email");
});
test("availability", () => {
  assert.deepEqual(maintainerGoogleAvailability({ googleLinked: true, email: "a@b.c" }), { canDisconnectGoogle: true, canClearEmail: false });
  assert.deepEqual(maintainerGoogleAvailability({ email: "a@b.c" }), { canDisconnectGoogle: false, canClearEmail: true });
  assert.deepEqual(maintainerGoogleAvailability({ email: null }), { canDisconnectGoogle: false, canClearEmail: false });
});
test("confirm text names the user", () => { assert.match(maintainerGoogleConfirmText("bob", "google"), /bob/); });
