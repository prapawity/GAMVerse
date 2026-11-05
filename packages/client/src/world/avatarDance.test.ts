import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_DANCE_DURATION_S, sampleAvatarDance } from "./avatarDance";

test("dance loops through alternating steps, a full turn, and a lifted backflip", () => {
  const pose = (seconds: number) => sampleAvatarDance(seconds, 0.8);
  assert.deepEqual(pose(0), pose(AVATAR_DANCE_DURATION_S));
  assert.ok(pose(1.125).legSweepRad * pose(1.375).legSweepRad < 0);
  assert.equal(pose(5).yawRad, Math.PI);
  assert.ok(Math.abs(pose(6.6).pitchRad + Math.PI) < 1e-12);
  assert.ok(pose(6.6).liftM > 0.5 && pose(6.6).tuckRad > 0.8);
  assert.equal(pose(7.5).liftM, 0);
});

test("ending a 3D dance restores the full-body transform and resets the clock", async () => {
  const { Group } = await import("three");
  const { applyAvatarDance, restoreAvatarDance } = await import("./avatarDanceVisual");
  const model = new Group();
  const body = new Group();
  body.add(model);
  body.position.set(0.1, 0.2, 0.3);
  body.rotation.y = 0.2;
  const restPosition = body.position.clone();
  const restRotation = body.quaternion.clone();
  const animation = { model, danceModel: body, proceduralMotion: true, rotationOffset: 0, phase: 0, danceElapsedS: 6.6 };
  applyAvatarDance(animation, 0.016);
  assert.ok(body.position.y > restPosition.y);
  assert.ok(body.quaternion.angleTo(restRotation) > 3);
  restoreAvatarDance(animation, false);
  assert.ok(body.position.equals(restPosition));
  assert.ok(body.quaternion.equals(restRotation));
  assert.equal(animation.danceElapsedS, undefined);
});
