import { type RoomLayout, type RoomLayoutZone, type RoomLayoutRoadway } from "@gammyverse/shared";
import { worldToScreen, type Map2dProjection } from "./map2dProjection";
import { MAP2D_DETAIL_PALETTE } from "./map2dStaticDetail";
import { mapZoneFloorColor } from "../zoneFloorColor";

const OUTLINE_WIDTH_PX = 1;
const ROAD_DASH_LENGTH_M = 2;
const ROAD_DASH_GAP_M = 1;
const ROAD_CURB_WIDTH_M = 0.12;
const ROAD_CURB_MIN_WIDTH_PX = 1;
const ROAD_CURB_COLOR = "#9ea9a4";
const GROUND_DEPTH_MIN_SCALE_PX_PER_M = 6;
const GROUND_DEPTH_MAX_PX = 4;
const ROAD_FACE_COLOR = "#252633";
const FLOOR_FACE_COLOR = "rgba(65, 53, 95, 0.14)";
const ZONE_EDGE_COLOR = "rgba(84, 109, 106, 0.22)";

function groundDepthPx(p: Map2dProjection): number {
  return p.pxPerM < GROUND_DEPTH_MIN_SCALE_PX_PER_M
    ? 0
    : Math.min(GROUND_DEPTH_MAX_PX, p.pxPerM * 0.14);
}

function drawGroundSides(ctx: CanvasRenderingContext2D, widthPx: number, depthPx: number, extrusionPx: number, color: string): void {
  if (!extrusionPx) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-widthPx / 2, depthPx / 2);
  ctx.lineTo(widthPx / 2, depthPx / 2);
  ctx.lineTo(widthPx / 2, depthPx / 2 + extrusionPx);
  ctx.lineTo(-widthPx / 2, depthPx / 2 + extrusionPx);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(widthPx / 2, -depthPx / 2);
  ctx.lineTo(widthPx / 2, depthPx / 2);
  ctx.lineTo(widthPx / 2 + extrusionPx, depthPx / 2 + extrusionPx);
  ctx.lineTo(widthPx / 2 + extrusionPx, -depthPx / 2 + extrusionPx);
  ctx.closePath();
  ctx.fill();
}

function drawRoad(ctx: CanvasRenderingContext2D, p: Map2dProjection, road: RoomLayoutRoadway): void {
  const screen = worldToScreen(p, road);
  const widthPx = road.width * p.pxPerM;
  const depthPx = road.depth * p.pxPerM;
  const extrusionPx = groundDepthPx(p);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  drawGroundSides(ctx, widthPx, depthPx, extrusionPx, ROAD_FACE_COLOR);
  ctx.fillStyle = MAP2D_DETAIL_PALETTE.asphalt;
  ctx.fillRect(-widthPx / 2, -depthPx / 2, widthPx, depthPx);
  ctx.strokeStyle = ROAD_CURB_COLOR;
  ctx.lineWidth = Math.max(ROAD_CURB_MIN_WIDTH_PX, ROAD_CURB_WIDTH_M * p.pxPerM);
  ctx.strokeRect(-widthPx / 2, -depthPx / 2, widthPx, depthPx);
  if (road.kind === "major") {
    const horizontal = widthPx >= depthPx;
    ctx.strokeStyle = MAP2D_DETAIL_PALETTE.roadLine;
    ctx.lineWidth = OUTLINE_WIDTH_PX;
    ctx.setLineDash([ROAD_DASH_LENGTH_M * p.pxPerM, ROAD_DASH_GAP_M * p.pxPerM]);
    ctx.beginPath();
    ctx.moveTo(horizontal ? -widthPx / 2 : 0, horizontal ? 0 : -depthPx / 2);
    ctx.lineTo(horizontal ? widthPx / 2 : 0, horizontal ? 0 : depthPx / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawZone(ctx: CanvasRenderingContext2D, p: Map2dProjection, zone: RoomLayoutZone, hasRoadways: boolean): void {
  const screen = worldToScreen(p, zone);
  const widthPx = zone.width * p.pxPerM;
  const depthPx = zone.depth * p.pxPerM;
  const extrusionPx = groundDepthPx(p);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  drawGroundSides(ctx, widthPx, depthPx, extrusionPx, FLOOR_FACE_COLOR);
  ctx.fillStyle = mapZoneFloorColor(zone, hasRoadways);
  ctx.fillRect(-widthPx / 2, -depthPx / 2, widthPx, depthPx);
  ctx.strokeStyle = ZONE_EDGE_COLOR;
  ctx.lineWidth = OUTLINE_WIDTH_PX;
  ctx.strokeRect(-widthPx / 2, -depthPx / 2, widthPx, depthPx);
  ctx.restore();
}

export function drawMap2dStaticDetail(ctx: CanvasRenderingContext2D, p: Map2dProjection, layout: RoomLayout): void {
  for (const road of layout.roadways ?? []) drawRoad(ctx, p, road);
  for (const zone of layout.zones) drawZone(ctx, p, zone, Boolean(layout.roadways?.length));
}
