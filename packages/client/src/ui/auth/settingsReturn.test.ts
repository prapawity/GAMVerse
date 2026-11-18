import assert from "node:assert/strict";
import test from "node:test";
import { parseSettingsReturn } from "./settingsReturn";
import { isKnownAppRoute } from "../workspace/defaultAppRoute";

test("connected return opens settings, shows notice and cleans the URL", () => {
  assert.deepEqual(parseSettingsReturn("/settings", "?google=connected"), { openSettings: true, notice: "Google account connected", error: null, cleanUrl: "/" });
});
test("conflict on the home path shows the error and keeps other params", () => {
  const r = parseSettingsReturn("/", "?a=1&error=google_conflict")!;
  assert.match(r.error!, /already used/);
  assert.equal(r.cleanUrl, "/?a=1");
});
test("unrelated URLs are ignored", () => {
  assert.equal(parseSettingsReturn("/", ""), null);
  assert.equal(parseSettingsReturn("/office/x", "?error=bogus"), null);
});
test("/settings is a known route", () => { assert.equal(isKnownAppRoute("/settings"), true); });
