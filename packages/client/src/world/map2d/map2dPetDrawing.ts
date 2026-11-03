import { worldToScreen, type Map2dProjection } from "./map2dProjection";
import type { Map2dPlayer } from "./map2dAvatarVisual";
import { petSpriteSourceRect } from "./petSpriteGeometry";
import { petFollowTarget } from "../petFollowPosition";

const PET_HEIGHT_M = 0.92;

export type Map2dPetActor = { x: number; z: number; elevation: 0; local: false; draw(ctx: CanvasRenderingContext2D, projection: Map2dProjection): void };
type PetSpriteSource = { get(petId: string | undefined): HTMLCanvasElement | null };

/** Pet markers stay lightweight in 2D and share the owner's ground position and facing. */
export function map2dPetActor(sessionId: string, player: Map2dPlayer, sprites?: PetSpriteSource, nowMs?: number): Map2dPetActor | null {
  if (!player.petId) return null;
  const { x, z } = petFollowTarget(player, player.rotation, sessionId);
  return {
    x, z, elevation: 0, local: false,
    draw(ctx, projection) {
      const screen = worldToScreen(projection, { x, z });
      const sprite = sprites?.get(player.petId);
      if (!sprite) return;
      const size = Math.max(18, Math.min(64, PET_HEIGHT_M * projection.pxPerM));
      const source = petSpriteSourceRect(player.rotation, player.visual ?? { motion: "idle", stridePhaseRad: 0 }, nowMs);
      ctx.save();
      ctx.shadowColor = "rgba(23, 33, 30, 0.3)";
      ctx.shadowBlur = Math.max(1, size * 0.08);
      ctx.shadowOffsetY = Math.max(1, size * 0.04);
      ctx.drawImage(sprite, source.x, source.y, source.width, source.height,
        screen.x - size / 2, screen.y - size * 0.78, size, size);
      ctx.restore();
    },
  };
}
