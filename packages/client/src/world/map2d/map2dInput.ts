import { AVATAR_SPRITE_TARGET_HEIGHT_M } from "./avatarSpriteGeometry";
import { LOCATE_PULSE_MS, MAP2D_DRAG_THRESHOLD_PX, MAP2D_PICK_RADIUS_PX } from "./constants";
import {
  worldToScreen,
  type Map2dPoint,
  type Map2dProjection,
  type ScreenPoint,
} from "./map2dProjection";
import type { Map2dAvatarVisual } from "./map2dAvatarVisual";

type PickableMap2dPlayer = Map2dPoint & { renderElevationM?: number; visual?: Map2dAvatarVisual };
export function pickMap2dPlayer(
  projection: Map2dProjection,
  players: ReadonlyMap<string, PickableMap2dPlayer>,
  point: ScreenPoint,
): string | null {
  let nearest: string | null = null;
  const pickRadiusPx = MAP2D_PICK_RADIUS_PX;
  let distancePx = pickRadiusPx;
  for (const [id, player] of players) {
    const screen = worldToScreen(projection, player, player.renderElevationM);
    const candidatePx = Math.hypot(point.x - screen.x, point.y - screen.y);
    const bodyWidthPx = Math.max(12, 0.8 * projection.pxPerM);
    const bodyHeightPx = AVATAR_SPRITE_TARGET_HEIGHT_M * projection.pxPerM;
    const lying = player.visual?.motion === "lying";
    const bodyTopPx = lying ? screen.y - bodyHeightPx / 2 : screen.y - bodyHeightPx;
    const bodyBottomPx = lying ? screen.y + bodyHeightPx / 2 : screen.y + 4;
    const hitsBody = point.x >= screen.x - bodyWidthPx / 2 && point.x <= screen.x + bodyWidthPx / 2
      && point.y >= bodyTopPx && point.y <= bodyBottomPx;
    if ((hitsBody || candidatePx < pickRadiusPx) && (nearest === null || candidatePx < distancePx)) {
      nearest = id;
      distancePx = candidatePx;
    }
  }
  return nearest;
}
export function locateMap2d(
  center: Map2dPoint,
  sessionId: string,
  nowMs: number,
) {
  return {
    center,
    following: false,
    view: "2d" as const,
    decoration: { sessionId, text: "◎", expiresAtMs: nowMs + LOCATE_PULSE_MS },
  };
}
export type Map2dLocateRequest = {
  sessionId?: string;
  center?: Map2dPoint;
  requestId: number;
};

export function isMap2dDrag(start: ScreenPoint, point: ScreenPoint): boolean {
  return Math.hypot(point.x - start.x, point.y - start.y) >= MAP2D_DRAG_THRESHOLD_PX;
}
