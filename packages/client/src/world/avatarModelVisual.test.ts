import assert from "node:assert/strict";
import test from "node:test";
import { advanceDeferredAvatarPosition, jumpHasExpired, shouldCreateAvatarRoot, shouldLoadAvatarModel } from "./avatarModelVisual";

test("3D avatar assets stay deferred in 2D, then load once when 3D returns", () => {
  assert.equal(shouldLoadAvatarModel(true, false, false, false), false);
  assert.equal(shouldLoadAvatarModel(false, false, false, false), true);
  assert.equal(shouldLoadAvatarModel(false, true, false, false), false);
  assert.equal(shouldLoadAvatarModel(false, false, true, false), false);
  assert.equal(shouldLoadAvatarModel(false, false, false, true), false);
});

test("main-scene avatar roots are deferred in 2D and created when 3D needs them", () => {
  assert.equal(shouldCreateAvatarRoot(false, false), false);
  assert.equal(shouldCreateAvatarRoot(true, false), true);
  assert.equal(shouldCreateAvatarRoot(true, true), false);
});

test("deferred avatar bookkeeping preserves movement state without accumulating idle drift", () => {
  const position = { x: 0, z: 0 };
  assert.equal(advanceDeferredAvatarPosition(position, { x: 1, z: 0 }, 1 / 60, true), true);
  assert.ok(position.x > 0 && position.x < 1);
  const nearlySettled = { x: position.x + 0.001, z: 0 };
  assert.equal(advanceDeferredAvatarPosition(position, nearlySettled, 1 / 60, true), false);
  assert.equal(position.x, nearlySettled.x);
});

test("deferred jump state expires at the normal animation deadline", () => {
  assert.equal(jumpHasExpired(100, 199, 100), false);
  assert.equal(jumpHasExpired(100, 200, 100), true);
});
