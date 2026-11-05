import assert from "node:assert/strict";
import test from "node:test";
import { isKnownAppRoute } from "./defaultAppRoute";

test("maintainer workspace links survive direct entry and refresh", () => {
  for (const path of ["/maintainer", "/maintainer/offices", "/maintainer/platform", "/maintainer/diagnostics"]) {
    assert.equal(isKnownAppRoute(path), true, path);
    assert.equal(isKnownAppRoute(`${path}/`), true, path);
  }
  assert.equal(isKnownAppRoute("/maintainer/unknown"), false);
});
