import type { Map2dAvatarVisual } from "./map2dAvatarVisual";
import { CHARACTER_MAX_HEIGHT_M, CHARACTER_MAX_WIDTH_M } from "../characterModelFit";

// The sprites are enlarged at close map zoom, so render each atlas frame at
// higher source resolution instead of stretching a small thumbnail.
// Keep the sprite's world-sized display envelope, but capture it at a higher
// raster resolution so close 2D views don't enlarge a soft 144×180 portrait.
export const AVATAR_SPRITE_TILE_WIDTH_PX = 192;
export const AVATAR_SPRITE_TILE_HEIGHT_PX = 240;
export const AVATAR_SPRITE_WIDTH_PX = 44;
export const AVATAR_SPRITE_HEIGHT_PX = 56;
const AVATAR_SPRITE_FRAME_MARGIN_M = 0.5;
export const AVATAR_SPRITE_TARGET_HEIGHT_M = Math.min(CHARACTER_MAX_HEIGHT_M, 1.8);
export const AVATAR_SPRITE_FRAME_HEIGHT_M = Math.hypot(CHARACTER_MAX_HEIGHT_M, CHARACTER_MAX_WIDTH_M)
  * AVATAR_SPRITE_TILE_HEIGHT_PX / AVATAR_SPRITE_TILE_WIDTH_PX + AVATAR_SPRITE_FRAME_MARGIN_M;
export const AVATAR_SPRITE_ABOVE_ANCHOR_PX = AVATAR_SPRITE_HEIGHT_PX * (0.5 + AVATAR_SPRITE_TARGET_HEIGHT_M / AVATAR_SPRITE_FRAME_HEIGHT_M);
export function avatarSpriteScale(pxPerM: number): number {
  return AVATAR_SPRITE_FRAME_HEIGHT_M * pxPerM / AVATAR_SPRITE_HEIGHT_PX;
}
/** Match the vector fallback's visible height to the transparent sprite atlas content. */
export function avatarFallbackScale(pxPerM: number): number {
  return AVATAR_SPRITE_TARGET_HEIGHT_M * pxPerM / 47;
}
/** Keep rings and facing markers readable without inheriting the atlas's transparent padding. */
export function avatarMarkerScale(pxPerM: number): number {
  return Math.max(0.65, Math.min(1.5, pxPerM / 24));
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
export const AVATAR_SPRITE_IDLE_FRAME_COUNT = 4;
export const AVATAR_SPRITE_ANIMATED_POSE_COUNT = AVATAR_SPRITE_POSE_COUNT + AVATAR_SPRITE_IDLE_FRAME_COUNT - 1;
const AVATAR_SPRITE_IDLE_MIN_CYCLE_MS = 400;
const idleCycleMsByAtlas = new WeakMap<HTMLCanvasElement, number>();
export function setAvatarSpriteIdleCycle(atlas: HTMLCanvasElement, durationMs: number): void {
  idleCycleMsByAtlas.set(atlas, Math.max(AVATAR_SPRITE_IDLE_MIN_CYCLE_MS, durationMs));
}
export function avatarSpriteIdleCycle(atlas: HTMLCanvasElement): number | undefined {
  return idleCycleMsByAtlas.get(atlas);
}
export function avatarSpriteIdlePoseIndex(nowMs: number, cycleMs: number): number {
  const frame = Math.floor(nowMs % cycleMs / cycleMs * AVATAR_SPRITE_IDLE_FRAME_COUNT);
  return frame === 0 ? 0 : AVATAR_SPRITE_POSE_COUNT + frame - 1;
}
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
export function avatarSpriteSourceRect(rotationRad: number, visual: Map2dAvatarVisual, idlePose = 0) {
  return {
    x: (visual.motion === "idle" ? idlePose : avatarSpritePoseIndex(visual)) * AVATAR_SPRITE_TILE_WIDTH_PX,
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
