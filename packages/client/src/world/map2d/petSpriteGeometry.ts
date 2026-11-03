import { avatarSpriteDirectionIndex } from "./avatarSpriteGeometry";
import type { Map2dAvatarVisual } from "./map2dAvatarVisual";

export const PET_SPRITE_TILE_SIZE_PX = 64;
export const PET_SPRITE_DIRECTION_COUNT = 8;
export const PET_SPRITE_WALK_FRAME_COUNT = 4;
export const PET_SPRITE_POSE_COUNT = PET_SPRITE_WALK_FRAME_COUNT + 1;
export const PET_SPRITE_ATLAS_WIDTH_PX = PET_SPRITE_TILE_SIZE_PX * PET_SPRITE_POSE_COUNT;
export const PET_SPRITE_ATLAS_HEIGHT_PX = PET_SPRITE_TILE_SIZE_PX * PET_SPRITE_DIRECTION_COUNT;
export const PET_SPRITE_WALK_CYCLE_DURATION_MS = 1208;
export const PET_SPRITE_ANIMATION_REDRAW_INTERVAL_MS = 1000 / 12;
const FULL_CIRCLE_RAD = Math.PI * 2;

export function petSpriteAnimationRedrawDue(hasWalkingPet: boolean, nowMs: number, lastDrawMs: number): boolean {
  return hasWalkingPet && nowMs - lastDrawMs >= PET_SPRITE_ANIMATION_REDRAW_INTERVAL_MS;
}

export function petSpriteWalkRootPose(frameIndex: number) {
  const phase = ((frameIndex % PET_SPRITE_WALK_FRAME_COUNT) + PET_SPRITE_WALK_FRAME_COUNT) % PET_SPRITE_WALK_FRAME_COUNT;
  const lifts = [0, 0.075, 0.025, 0.075] as const;
  const leans = [0.1, 0.04, -0.1, -0.04] as const;
  return {
    liftM: lifts[phase],
    leanRad: leans[phase],
    verticalScale: phase === 1 || phase === 3 ? 0.94 : 1,
  };
}

export function petSpritePoseIndex(visual: Map2dAvatarVisual, nowMs?: number): number {
  if (visual.motion !== "walking") return 0;
  const phase = nowMs === undefined
    ? ((visual.stridePhaseRad % FULL_CIRCLE_RAD) + FULL_CIRCLE_RAD) % FULL_CIRCLE_RAD
    : (((nowMs % PET_SPRITE_WALK_CYCLE_DURATION_MS) + PET_SPRITE_WALK_CYCLE_DURATION_MS) % PET_SPRITE_WALK_CYCLE_DURATION_MS)
      / PET_SPRITE_WALK_CYCLE_DURATION_MS * FULL_CIRCLE_RAD;
  return 1 + Math.floor(phase / FULL_CIRCLE_RAD * PET_SPRITE_WALK_FRAME_COUNT);
}

export function petSpriteSourceRect(rotationRad: number, visual: Map2dAvatarVisual, nowMs?: number) {
  return {
    x: petSpritePoseIndex(visual, nowMs) * PET_SPRITE_TILE_SIZE_PX,
    y: avatarSpriteDirectionIndex(rotationRad) * PET_SPRITE_TILE_SIZE_PX,
    width: PET_SPRITE_TILE_SIZE_PX,
    height: PET_SPRITE_TILE_SIZE_PX,
  };
}
