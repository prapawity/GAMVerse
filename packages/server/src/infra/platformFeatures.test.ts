import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PLATFORM_FEATURES } from "./platformFeatures.js";

test("googleSignIn defaults off while editing flags default on", () => {
  assert.deepEqual(DEFAULT_PLATFORM_FEATURES, { mapEditing: true, propEditing: true, googleSignIn: false });
});
