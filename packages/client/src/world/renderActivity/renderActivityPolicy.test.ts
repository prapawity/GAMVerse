import assert from "node:assert/strict";
import { test } from "node:test";
import { BLURRED_FRAME_INTERVAL_MS, decideRenderActivity, RENDER_IDLE_TIMEOUT_MS, shouldSkipFrame } from "./renderActivityPolicy";

const active = { visible: true, focused: true, lastInputAtMs: 0 };

test("focused visible tab with recent input renders every frame", () => {
  assert.deepEqual(decideRenderActivity(active, 1000), { mode: "full", pauseReason: null, minFrameIntervalMs: 0 });
});

test("hidden tab pauses rendering even with recent input", () => {
  assert.equal(decideRenderActivity({ ...active, visible: false }, 10).pauseReason, "hidden");
});

test("visible but unfocused window is throttled", () => {
  const decision = decideRenderActivity({ ...active, focused: false }, 1000);
  assert.equal(decision.mode, "throttled");
  assert.equal(decision.minFrameIntervalMs, BLURRED_FRAME_INTERVAL_MS);
});

test("ten minutes without input pauses with idle reason, focused or not", () => {
  assert.equal(decideRenderActivity(active, RENDER_IDLE_TIMEOUT_MS - 1).mode, "full");
  assert.equal(decideRenderActivity(active, RENDER_IDLE_TIMEOUT_MS).pauseReason, "idle");
  assert.equal(decideRenderActivity({ ...active, focused: false }, RENDER_IDLE_TIMEOUT_MS).pauseReason, "idle");
});

test("throttled loop skips frames inside the interval", () => {
  const decision = decideRenderActivity({ ...active, focused: false }, 0);
  assert.equal(shouldSkipFrame(decision, 100, 0), true);
  assert.equal(shouldSkipFrame(decision, BLURRED_FRAME_INTERVAL_MS, 0), false);
  assert.equal(shouldSkipFrame(decideRenderActivity(active, 0), 1, 0), false);
});
