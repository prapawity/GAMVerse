import assert from "node:assert/strict";
import test from "node:test";
import {
  PET_SPRITE_ANIMATION_REDRAW_INTERVAL_MS, PET_SPRITE_POSE_COUNT, PET_SPRITE_TILE_SIZE_PX, PET_SPRITE_WALK_FRAME_COUNT,
  petSpriteAnimationRedrawDue, petSpritePoseIndex, petSpriteSourceRect, petSpriteWalkRootPose,
} from "./petSpriteGeometry";

test("pet sprite uses the idle frame while standing and cycles walking frames by stride phase", () => {
  assert.equal(PET_SPRITE_POSE_COUNT, 5);
  assert.equal(petSpritePoseIndex({ motion: "idle", stridePhaseRad: 3 }), 0);
  assert.equal(petSpritePoseIndex({ motion: "walking", stridePhaseRad: 0 }), 1);
  assert.equal(petSpritePoseIndex({ motion: "walking", stridePhaseRad: Math.PI }), 3);
  assert.equal(petSpritePoseIndex({ motion: "walking", stridePhaseRad: Math.PI * 2 }), 1);
});

test("pet atlas source rectangle combines the selected animation frame and facing row", () => {
  assert.deepEqual(petSpriteSourceRect(-Math.PI / 2, { motion: "walking", stridePhaseRad: Math.PI }), {
    x: 3 * PET_SPRITE_TILE_SIZE_PX,
    y: 6 * PET_SPRITE_TILE_SIZE_PX,
    width: PET_SPRITE_TILE_SIZE_PX,
    height: PET_SPRITE_TILE_SIZE_PX,
  });
});

test("a moving pet advances its walk cycle on a steady animation clock", () => {
  const walking = { motion: "walking" as const, stridePhaseRad: 0 };
  assert.notEqual(petSpritePoseIndex(walking, 0), petSpritePoseIndex(walking, 700));
  assert.equal(petSpritePoseIndex({ motion: "idle", stridePhaseRad: 0 }, 700), 0);
});

test("all baked walk poses visibly change body height, lean, or compression", () => {
  const poses = Array.from({ length: PET_SPRITE_WALK_FRAME_COUNT }, (_, index) => petSpriteWalkRootPose(index));
  assert.equal(new Set(poses.map(pose => `${pose.liftM}:${pose.leanRad}:${pose.verticalScale}`)).size, PET_SPRITE_WALK_FRAME_COUNT);
  assert.ok(poses.some(pose => pose.liftM > 0));
  assert.ok(poses.some(pose => pose.leanRad < 0));
  assert.ok(poses.some(pose => pose.leanRad > 0));
});

test("2D pet renderer schedules animation redraws only while a pet walks", () => {
  assert.equal(petSpriteAnimationRedrawDue(false, 200, 0), false);
  assert.equal(petSpriteAnimationRedrawDue(true, PET_SPRITE_ANIMATION_REDRAW_INTERVAL_MS - 1, 0), false);
  assert.equal(petSpriteAnimationRedrawDue(true, PET_SPRITE_ANIMATION_REDRAW_INTERVAL_MS, 0), true);
});
