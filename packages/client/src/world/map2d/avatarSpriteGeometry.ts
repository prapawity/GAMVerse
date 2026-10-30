import type { Map2dAvatarVisual } from "./map2dAvatarVisual";
import { CHARACTER_MAX_HEIGHT_M, CHARACTER_MAX_WIDTH_M } from "../characterModelFit";

export const AVATAR_SPRITE_TILE_WIDTH_PX = 64;
export const AVATAR_SPRITE_TILE_HEIGHT_PX = 80;
export const AVATAR_SPRITE_WIDTH_PX = 44;
export const AVATAR_SPRITE_HEIGHT_PX = 56;
const AVATAR_SPRITE_FRAME_MARGIN_M = 0.5;
export const AVATAR_SPRITE_TARGET_HEIGHT_M = CHARACTER_MAX_HEIGHT_M / 2;
export const AVATAR_SPRITE_FRAME_HEIGHT_M = Math.hypot(CHARACTER_MAX_HEIGHT_M, CHARACTER_MAX_WIDTH_M)
  * AVATAR_SPRITE_TILE_HEIGHT_PX / AVATAR_SPRITE_TILE_WIDTH_PX + AVATAR_SPRITE_FRAME_MARGIN_M;
export const AVATAR_SPRITE_ABOVE_ANCHOR_PX = AVATAR_SPRITE_HEIGHT_PX * (0.5 + AVATAR_SPRITE_TARGET_HEIGHT_M / AVATAR_SPRITE_FRAME_HEIGHT_M);
export function avatarSpriteScale(pxPerM: number): number {
  return AVATAR_SPRITE_FRAME_HEIGHT_M * pxPerM / AVATAR_SPRITE_HEIGHT_PX;
}
export function avatarSpriteAboveAnchorPx(pxPerM: number): number {
  return AVATAR_SPRITE_ABOVE_ANCHOR_PX * avatarSpriteScale(pxPerM);
}

export const AVATAR_SPRITE_DIRECTION_COUNT = 8;
export const AVATAR_SPRITE_WALK_FRAME_COUNT = 8;
const AVATAR_SPRITE_STATIONARY_POSE_COUNT = 3;
export const AVATAR_SPRITE_POSE_COUNT = AVATAR_SPRITE_WALK_FRAME_COUNT + AVATAR_SPRITE_STATIONARY_POSE_COUNT;
export const AVATAR_SPRITE_SEATED_POSE_INDEX = AVATAR_SPRITE_POSE_COUNT - 2;
export const AVATAR_SPRITE_LYING_POSE_INDEX = AVATAR_SPRITE_POSE_COUNT - 1;
export const AVATAR_SPRITE_FULL_CIRCLE_RAD = Math.PI * 2;

function wrappedSpriteAngleRad(angleRad: number): number {
  const remainderRad = angleRad % AVATAR_SPRITE_FULL_CIRCLE_RAD;
  return remainderRad < 0 ? remainderRad + AVATAR_SPRITE_FULL_CIRCLE_RAD : remainderRad;
}

/** Rotation zero faces south (+world z), matching the authoritative movement yaw. */
export function avatarSpriteDirectionIndex(rotationRad: number): number {
  const turn = wrappedSpriteAngleRad(rotationRad);
  return Math.round(turn / AVATAR_SPRITE_FULL_CIRCLE_RAD * AVATAR_SPRITE_DIRECTION_COUNT) % AVATAR_SPRITE_DIRECTION_COUNT;
}
export function avatarSpritePoseIndex(visual: Map2dAvatarVisual): number {
  if (visual.motion === "lying") return AVATAR_SPRITE_LYING_POSE_INDEX;
  if (visual.motion === "seated") return AVATAR_SPRITE_SEATED_POSE_INDEX;
  if (visual.motion === "idle") return 0;
  const turn = wrappedSpriteAngleRad(visual.stridePhaseRad);
  return 1 + Math.floor(turn / AVATAR_SPRITE_FULL_CIRCLE_RAD * AVATAR_SPRITE_WALK_FRAME_COUNT);
}
export function avatarSpriteSourceRect(rotationRad: number, visual: Map2dAvatarVisual) {
  return {
    x: avatarSpritePoseIndex(visual) * AVATAR_SPRITE_TILE_WIDTH_PX,
    y: avatarSpriteDirectionIndex(rotationRad) * AVATAR_SPRITE_TILE_HEIGHT_PX,
    width: AVATAR_SPRITE_TILE_WIDTH_PX,
    height: AVATAR_SPRITE_TILE_HEIGHT_PX,
  };
}
export function avatarSpriteScreenRect(xPx: number, yPx: number, pxPerM: number) {
  const scale = avatarSpriteScale(pxPerM);
  return { x: xPx - AVATAR_SPRITE_WIDTH_PX * scale / 2, y: yPx - avatarSpriteAboveAnchorPx(pxPerM),
    width: AVATAR_SPRITE_WIDTH_PX * scale, height: AVATAR_SPRITE_HEIGHT_PX * scale };
}
