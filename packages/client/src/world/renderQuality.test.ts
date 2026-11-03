import assert from "node:assert/strict";
import test from "node:test";
import { renderQualitySettings } from "./renderQuality";

test("power saver caps render resolution and disables real-time shadows", () => {
  assert.deepEqual(renderQualitySettings(2, true), { pixelRatio: 1, shadows: false });
});

test("balanced rendering retains the normal resolution cap and shadows", () => {
  assert.deepEqual(renderQualitySettings(2, false), { pixelRatio: 1.75, shadows: true });
});

test("invalid device resolution uses a safe 1x fallback", () => {
  assert.deepEqual(renderQualitySettings(Number.NaN, false), { pixelRatio: 1, shadows: true });
});
