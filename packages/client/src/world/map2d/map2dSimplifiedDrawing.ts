import { type RoomLayout } from "@gammyverse/shared";
import { MAP2D_COLORS } from "./constants";
import { worldToScreen, type Map2dProjection } from "./map2dProjection";
import { mapZoneFloorColor } from "../zoneFloorColor";
export function drawMap2dSimplified(ctx: CanvasRenderingContext2D, p: Map2dProjection, layout: RoomLayout): void {
  for (const road of layout.roadways ?? []) {
    const point = worldToScreen(p, road);
    ctx.fillStyle = MAP2D_COLORS.road;
    ctx.fillRect(point.x - road.width * p.pxPerM / 2, point.y - road.depth * p.pxPerM / 2,
      road.width * p.pxPerM, road.depth * p.pxPerM);
  }
  for (const zone of layout.zones) {
    const point = worldToScreen(p, zone);
    ctx.fillStyle = mapZoneFloorColor(zone, Boolean(layout.roadways?.length));
    ctx.fillRect(point.x - zone.width * p.pxPerM / 2, point.y - zone.depth * p.pxPerM / 2,
      zone.width * p.pxPerM, zone.depth * p.pxPerM);
  }
}
