import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_MAX_HEIGHT_M, CHARACTER_MAX_WIDTH_M } from "../characterModelFit";
import { AVATAR_SPRITE_FRAME_HEIGHT_M, AVATAR_SPRITE_ABOVE_ANCHOR_PX, AVATAR_SPRITE_TARGET_HEIGHT_M, AVATAR_SPRITE_TILE_WIDTH_PX, AVATAR_SPRITE_TILE_HEIGHT_PX, avatarSpriteDirectionIndex, avatarSpritePoseIndex, avatarSpriteSourceRect, avatarSpriteScreenRect } from "./avatarSpriteGeometry";

test("server yaw selects south, east, north and west sprites with wrapped angles", () => {
  assert.equal(avatarSpriteDirectionIndex(0), 0);
  assert.equal(avatarSpriteDirectionIndex(Math.PI / 2), 2);
  assert.equal(avatarSpriteDirectionIndex(Math.PI), 4);
  assert.equal(avatarSpriteDirectionIndex(-Math.PI / 2), 6);
  assert.equal(avatarSpriteDirectionIndex(Math.PI * 2), 0);
});
test("idle and sitting are distinct from the eight distance-driven walking poses", () => {
  assert.equal(avatarSpritePoseIndex({ motion: "idle", stridePhaseRad: 3 }), 0);
  assert.equal(avatarSpritePoseIndex({ motion: "seated", stridePhaseRad: 3 }), 9);
  const poses = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4).map(stridePhaseRad => avatarSpritePoseIndex({ motion: "walking", stridePhaseRad }));
  assert.deepEqual(poses, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(avatarSpriteSourceRect(Math.PI, { motion: "walking", stridePhaseRad: Math.PI / 2 }),
    { x: 192, y: 320, width: 64, height: 80 });
});
test("character frame occupies the full model envelope at every zoom, anchored at its feet", () => {
  for (const pxPerM of [2, 12, 80]) {
    const rect = avatarSpriteScreenRect(400, 300, pxPerM);
    assert.ok(Math.abs(rect.height / pxPerM - AVATAR_SPRITE_FRAME_HEIGHT_M) < 1e-12);
    assert.ok(Math.abs(rect.width / rect.height - 44 / 56) < 1e-12);
    assert.ok(Math.abs(rect.y - (300 - rect.height * AVATAR_SPRITE_ABOVE_ANCHOR_PX / 56)) < 1e-12);
    assert.ok(Math.abs(rect.y + rect.height * (0.5 + AVATAR_SPRITE_TARGET_HEIGHT_M / AVATAR_SPRITE_FRAME_HEIGHT_M) - 300) < 1e-12);
  }
});

test("maximum-height lying characters fit the snapshot at every facing angle", () => {
  const frameWidthM = AVATAR_SPRITE_FRAME_HEIGHT_M * AVATAR_SPRITE_TILE_WIDTH_PX / AVATAR_SPRITE_TILE_HEIGHT_PX;
  for (let angleDeg = 0; angleDeg < 360; angleDeg++) {
    const angleRad = angleDeg * Math.PI / 180;
    const widthM = Math.abs(Math.cos(angleRad)) * CHARACTER_MAX_WIDTH_M + Math.abs(Math.sin(angleRad)) * CHARACTER_MAX_HEIGHT_M;
    const depthM = Math.abs(Math.sin(angleRad)) * CHARACTER_MAX_WIDTH_M + Math.abs(Math.cos(angleRad)) * CHARACTER_MAX_HEIGHT_M;
    assert.ok(widthM < frameWidthM);
    assert.ok(depthM < AVATAR_SPRITE_FRAME_HEIGHT_M);
  }
});
