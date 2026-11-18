import assert from "node:assert/strict";
import test from "node:test";
import { mapSetPasswordResponse, errorFromBody, parseGoogleStatus, parseLinkUrl, signInMethodsView, validateNewPassword } from "./signInMethodsView";

const s = (o: Partial<{ enabled: boolean; linked: boolean; email: string | null; hasPassword: boolean }>) => ({ enabled: false, linked: false, email: null, hasPassword: true, ...o });

test("section hidden unless enabled or linked", () => {
  assert.equal(signInMethodsView(null).visible, false);
  assert.equal(signInMethodsView(s({})).visible, false);
  assert.equal(signInMethodsView(s({ enabled: true })).visible, true);
  assert.equal(signInMethodsView(s({ linked: true, email: "a@b.c" })).visible, true);
});

test("connect only when enabled and not linked", () => {
  assert.equal(signInMethodsView(s({ enabled: true })).canConnect, true);
  assert.equal(signInMethodsView(s({ enabled: true, linked: true })).canConnect, false);
  assert.equal(signInMethodsView(s({ linked: true })).canConnect, false);
});

test("disconnect needs a password; Google-only gets hint and set-password form", () => {
  const v = signInMethodsView(s({ enabled: true, linked: true, email: "a@b.c", hasPassword: false }));
  assert.equal(v.canDisconnect, false);
  assert.equal(v.disconnectHint, "Set a password first");
  assert.equal(v.showSetPassword, true);
  assert.equal(v.email, "a@b.c");
  const w = signInMethodsView(s({ linked: true, hasPassword: true }));
  assert.equal(w.canDisconnect, true);
  assert.equal(w.showSetPassword, false);
});

test("password validation", () => {
  assert.ok(validateNewPassword("short", "short"));
  assert.ok(validateNewPassword("x".repeat(129), "x".repeat(129)));
  assert.match(validateNewPassword("longenough", "different")!, /match/);
  assert.equal(validateNewPassword("longenough", "longenough"), null);
});

test("response mapping fails closed", () => {
  assert.equal(parseGoogleStatus({ enabled: "yes" }), null);
  assert.deepEqual(parseGoogleStatus({ enabled: true, linked: false, email: "", hasPassword: true }), { enabled: true, linked: false, email: null, hasPassword: true });
  assert.equal(errorFromBody({ error: "Nope" }, "f"), "Nope");
  assert.equal(errorFromBody(null, "f"), "f");
  assert.equal(parseLinkUrl({ url: "https://accounts.google.com/x" }), "https://accounts.google.com/x");
  assert.equal(parseLinkUrl({ url: "javascript:alert(1)" }), null);
});

test("set-password response mapping", () => {
  assert.deepEqual(mapSetPasswordResponse(200, { user: { username: "a" } }), { kind: "ok" });
  assert.deepEqual(mapSetPasswordResponse(200, { user: null, reauth: true, message: "Password set. Sign in again." }), { kind: "reauth", message: "Password set. Sign in again." });
  assert.deepEqual(mapSetPasswordResponse(200, { user: null, reauth: true }), { kind: "reauth", message: "Password set. Sign in again." });
  assert.deepEqual(mapSetPasswordResponse(403, { error: "This account is suspended. Contact a maintainer." }), { kind: "error", message: "This account is suspended. Contact a maintainer." });
  assert.deepEqual(mapSetPasswordResponse(409, null), { kind: "error", message: "Could not set the password." });
});
