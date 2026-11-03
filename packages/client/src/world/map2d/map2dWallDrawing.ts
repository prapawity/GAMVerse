import { roomWallSolidSegments, type RoomLayout, type RoomLayoutWall, type RoomLayoutDoor } from "@gammyverse/shared";
import { worldToScreen, type Map2dProjection } from "./map2dProjection";
import { map2dWallFootprint, map2dDoorFootprint, map2dWallThicknessPx } from "./map2dStaticDetail";
import { mapZoneFloorColor } from "../zoneFloorColor";

export const WALL_CAP_COLOR = "#63bbd0";
const WALL_EDGE_COLOR = "#7e9190";
const WALL_SHADOW_COLOR = "rgba(36, 56, 55, 0.16)";
const WALL_SHADOW_OFFSET_PX = 3;
const WALL_EDGE_WIDTH_PX = 1;
const WALL_HEIGHT_PROJECTION_RATIO = 0.62;
// Keep the side face close to the saved wall footprint. Larger lateral
// offsets made vertical walls drift into rooms and visually cover props.
const WALL_SIDE_PROJECTION_RATIO = 0.08;
const WALL_OCCLUDED_OPACITY = 0.2;
const ACTOR_OCCLUSION_WIDTH_M = 0.45;
const DOOR_THRESHOLD_COLOR = "#b98f5c";
const DOOR_FRAME_COLOR = "#c99c69";
const DOOR_PANEL_COLOR = "#b88451";
const DOOR_FRAME_WIDTH_M = 0.12;
const DOOR_THRESHOLD_WIDTH_PX = 2;
type SolidWallSpan = ReturnType<typeof roomWallSolidSegments>[number];

export type Map2dActorPoint = { x: number; z: number; local?: boolean };

function darkenWallColor(color: string, ratio: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const value = Number.parseInt(color.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * ratio).toString(16).padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

function adjacentZoneColor(wall: RoomLayoutWall, layout: RoomLayout): string | undefined {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestColor: string | undefined;
  for (const zone of layout.zones) {
    const horizontal = wall.axis === "horizontal";
    const overlaps = horizontal
      ? Math.abs(zone.x - wall.x) <= zone.width / 2 + wall.length / 2
      : Math.abs(zone.z - wall.z) <= zone.depth / 2 + wall.length / 2;
    if (!overlaps) continue;
    const edgeDistance = horizontal
      ? Math.abs(Math.abs(wall.z - zone.z) - zone.depth / 2)
      : Math.abs(Math.abs(wall.x - zone.x) - zone.width / 2);
    if (edgeDistance < bestDistance) {
      bestDistance = edgeDistance;
      bestColor = mapZoneFloorColor(zone, Boolean(layout.roadways?.length));
    }
  }
  return bestColor;
}

function wallOccludesActor(wall: RoomLayoutWall, actor: Map2dActorPoint): boolean {
  if (wall.axis === "horizontal") {
    const withinLength = Math.abs(actor.x - wall.x) <= wall.length / 2 + ACTOR_OCCLUSION_WIDTH_M;
    const behindWall = actor.z <= wall.z + wall.thickness / 2;
    const withinProjectedHeight = actor.z + ACTOR_OCCLUSION_WIDTH_M >= wall.z - wall.height * WALL_HEIGHT_PROJECTION_RATIO;
    return withinLength && behindWall && withinProjectedHeight;
  }
  const withinLength = Math.abs(actor.z - wall.z) <= wall.length / 2 + ACTOR_OCCLUSION_WIDTH_M;
  const behindWall = actor.x <= wall.x + wall.thickness / 2;
  const withinProjectedHeight = actor.x + ACTOR_OCCLUSION_WIDTH_M >= wall.x - wall.height * WALL_SIDE_PROJECTION_RATIO;
  return withinLength && behindWall && withinProjectedHeight;
}

function drawWallSpan(ctx: CanvasRenderingContext2D, p: Map2dProjection, wall: RoomLayoutWall, faded = false): void {
  ctx.save();
  if (faded) ctx.globalAlpha = WALL_OCCLUDED_OPACITY;
  const footprint = map2dWallFootprint(wall, p.pxPerM);
  const screen = worldToScreen(p, footprint);
  const widthPx = footprint.width * p.pxPerM;
  const depthPx = footprint.depth * p.pxPerM;
  const leftPx = screen.x - widthPx / 2;
  const topPx = screen.y - depthPx / 2;
  const wallHeightPx = Math.max(0, wall.height * p.pxPerM * WALL_HEIGHT_PROJECTION_RATIO);
  const sideDepthPx = wallHeightPx * WALL_SIDE_PROJECTION_RATIO;
  const wallColor = wall.color ?? WALL_CAP_COLOR;
  if (wallHeightPx > 0.5) {
    ctx.fillStyle = darkenWallColor(wallColor, wall.axis === "horizontal" ? 0.82 : 0.7);
    ctx.beginPath();
    if (wall.axis === "horizontal") {
      ctx.moveTo(leftPx, topPx + depthPx);
      ctx.lineTo(leftPx + widthPx, topPx + depthPx);
      ctx.lineTo(leftPx + widthPx, topPx + depthPx - wallHeightPx);
      ctx.lineTo(leftPx, topPx + depthPx - wallHeightPx);
    } else {
      ctx.moveTo(leftPx + widthPx, topPx);
      ctx.lineTo(leftPx + widthPx + sideDepthPx, topPx - wallHeightPx);
      ctx.lineTo(leftPx + widthPx + sideDepthPx, topPx + depthPx - wallHeightPx);
      ctx.lineTo(leftPx + widthPx, topPx + depthPx);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (p.pxPerM >= WALL_EDGE_WIDTH_PX) {
    const offsetX = wall.axis === "vertical" ? WALL_SHADOW_OFFSET_PX : 0;
    const offsetY = wall.axis === "horizontal" ? WALL_SHADOW_OFFSET_PX : 0;
    ctx.fillStyle = WALL_SHADOW_COLOR;
    ctx.fillRect(leftPx + offsetX, topPx + offsetY, widthPx, depthPx);
  }
  ctx.fillStyle = wallColor;
  if (wall.axis === "horizontal") ctx.fillRect(leftPx, topPx - wallHeightPx, widthPx, depthPx);
  else ctx.fillRect(leftPx + sideDepthPx, topPx - wallHeightPx, widthPx, depthPx);
  ctx.strokeStyle = WALL_EDGE_COLOR;
  ctx.lineWidth = WALL_EDGE_WIDTH_PX;
  if (wall.axis === "horizontal") ctx.strokeRect(leftPx, topPx - wallHeightPx, widthPx, depthPx);
  else ctx.strokeRect(leftPx + sideDepthPx, topPx - wallHeightPx, widthPx, depthPx);
  ctx.restore();
}

function drawDoorThreshold(ctx: CanvasRenderingContext2D, p: Map2dProjection, wall: RoomLayoutWall, door: RoomLayoutDoor): void {
  const thicknessM = map2dWallThicknessPx(wall.thickness, p.pxPerM) / p.pxPerM;
  const footprint = map2dDoorFootprint(wall, door, thicknessM);
  const screen = worldToScreen(p, footprint);
  const widthPx = footprint.width * p.pxPerM;
  const depthPx = footprint.depth * p.pxPerM;
  const horizontal = wall.axis === "horizontal";
  ctx.strokeStyle = DOOR_THRESHOLD_COLOR;
  ctx.lineWidth = DOOR_THRESHOLD_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(screen.x - (horizontal ? widthPx / 2 : 0), screen.y - (horizontal ? 0 : depthPx / 2));
  ctx.lineTo(screen.x + (horizontal ? widthPx / 2 : 0), screen.y + (horizontal ? 0 : depthPx / 2));
  ctx.stroke();
}

function drawAnimatedDoorLeaf(ctx: CanvasRenderingContext2D, p: Map2dProjection, wall: RoomLayoutWall,
  hingeX: number, hingeZ: number, leafWidth: number, direction: number, swingSign: number, progress: number, faded: boolean): void {
  if (progress <= 0.001) return;
  const swingRad = swingSign * progress * Math.PI / 2;
  const horizontal = wall.axis === "horizontal";
  const baseDx = horizontal ? direction * leafWidth : 0;
  const baseDz = horizontal ? 0 : direction * leafWidth;
  const dx = baseDx * Math.cos(swingRad) + baseDz * Math.sin(swingRad);
  const dz = -baseDx * Math.sin(swingRad) + baseDz * Math.cos(swingRad);
  const start = worldToScreen(p, { x: hingeX, z: hingeZ });
  const end = worldToScreen(p, { x: hingeX + dx, z: hingeZ + dz });
  const heightPx = Math.min(wall.height, 2.05) * p.pxPerM * WALL_HEIGHT_PROJECTION_RATIO;
  ctx.save();
  if (faded) ctx.globalAlpha = WALL_OCCLUDED_OPACITY;
  ctx.fillStyle = darkenWallColor(wall.color ?? DOOR_PANEL_COLOR, 0.7);
  ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
  ctx.lineTo(end.x + 1.5, end.y - heightPx + 1.5); ctx.lineTo(start.x + 1.5, start.y - heightPx + 1.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = DOOR_PANEL_COLOR;
  ctx.strokeStyle = "#8d633e";
  ctx.lineWidth = WALL_EDGE_WIDTH_PX;
  ctx.beginPath(); ctx.moveTo(start.x, start.y - heightPx); ctx.lineTo(end.x, end.y - heightPx);
  ctx.lineTo(end.x, end.y); ctx.lineTo(start.x, start.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawDoorway(ctx: CanvasRenderingContext2D, p: Map2dProjection, wall: RoomLayoutWall,
  door: RoomLayoutDoor, actors: readonly Map2dActorPoint[], openProgress: number): void {
  const faded = actors.some(actor => actor.local && wallOccludesActor(wall, actor));
  const midpointX = wall.x + (wall.axis === "horizontal" ? door.offset : 0);
  const midpointZ = wall.z + (wall.axis === "vertical" ? door.offset : 0);
  const jambHeight = Math.min(wall.height, 2.15);
  const jambLength = Math.min(DOOR_FRAME_WIDTH_M, Math.max(0.08, door.width * 0.16));
  for (const side of [-1, 1]) {
    const jamb: RoomLayoutWall = {
      ...wall,
      id: `${wall.id}:${door.id}:jamb:${side}`,
      x: midpointX + (wall.axis === "horizontal" ? side * (door.width / 2 - jambLength / 2) : 0),
      z: midpointZ + (wall.axis === "vertical" ? side * (door.width / 2 - jambLength / 2) : 0),
      length: jambLength,
      height: jambHeight,
      color: DOOR_FRAME_COLOR,
    };
    drawWallSpan(ctx, p, jamb, faded);
  }
  if (door.kind === "opening") { drawDoorThreshold(ctx, p, wall, door); return; }
  const horizontal = wall.axis === "horizontal";
  const leafCount = door.leaves ?? 1;
  const leafWidth = door.width / leafCount * 0.88;
  const leafThickness = Math.max(0.06, wall.thickness * 0.42);
  for (let index = 0; index < leafCount; index += 1) {
    const side = leafCount === 1 ? -1 : (index === 0 ? -1 : 1);
    const offset = (index - (leafCount - 1) / 2) * door.width / leafCount;
    const hingeX = midpointX + (horizontal ? side * door.width / 2 : 0);
    const hingeZ = midpointZ + (horizontal ? 0 : side * door.width / 2);
    if (openProgress > 0.001) {
      const swingSign = horizontal ? side : -side;
      drawAnimatedDoorLeaf(ctx, p, wall, hingeX, hingeZ, leafWidth, -side, swingSign, openProgress, faded);
    } else {
      const leaf: RoomLayoutWall = {
        ...wall,
        id: `${wall.id}:${door.id}:leaf:${index}`,
        x: midpointX + (horizontal ? offset : 0),
        z: midpointZ + (horizontal ? 0 : offset),
        length: leafWidth,
        thickness: leafThickness,
        height: Math.min(wall.height, 2.05),
        color: DOOR_PANEL_COLOR,
      };
      drawWallSpan(ctx, p, leaf, faded);
    }
  }
  drawDoorThreshold(ctx, p, wall, door);
}

function segmentWall(wall: RoomLayoutWall, segment: SolidWallSpan): RoomLayoutWall {
  const midpointM = (segment.start + segment.end) / 2;
  return { ...wall, length: segment.end - segment.start,
    x: wall.x + (wall.axis === "horizontal" ? midpointM : 0),
    z: wall.z + (wall.axis === "vertical" ? midpointM : 0) };
}

export type Map2dWallDrawItem = { depth: number; draw(ctx: CanvasRenderingContext2D, p: Map2dProjection, actors?: readonly Map2dActorPoint[]): void };

type Map2dWallLayoutIndex = {
  wallsById: ReadonlyMap<string, RoomLayoutWall>;
  doorsByWallId: ReadonlyMap<string, readonly RoomLayoutDoor[]>;
  wallColors: ReadonlyMap<string, string>;
};
const wallLayoutIndexCache = new WeakMap<RoomLayout, Map2dWallLayoutIndex>();

export function map2dWallLayoutIndex(layout: RoomLayout): Map2dWallLayoutIndex {
  const cached = wallLayoutIndexCache.get(layout);
  if (cached) return cached;
  const wallsById = new Map(layout.walls.map(wall => [wall.id, wall]));
  const doorBuckets = new Map<string, RoomLayoutDoor[]>();
  for (const door of layout.doors) {
    const bucket = doorBuckets.get(door.wallId);
    if (bucket) bucket.push(door);
    else doorBuckets.set(door.wallId, [door]);
  }
  const wallColors = new Map(layout.walls.flatMap(wall => {
    const color = wall.color ?? adjacentZoneColor(wall, layout) ?? WALL_CAP_COLOR;
    return [[wall.id, color] as const];
  }));
  const index = { wallsById, doorsByWallId: doorBuckets, wallColors };
  wallLayoutIndexCache.set(layout, index);
  return index;
}

/** One painter item per solid span lets nearer props cover walls and walls hide props behind them. */
export function map2dWallDrawItems(layout: RoomLayout, doorProgress: ReadonlyMap<string, number> = new Map()): Map2dWallDrawItem[] {
  const items: Map2dWallDrawItem[] = [];
  const { doorsByWallId, wallColors } = map2dWallLayoutIndex(layout);
  for (const wall of layout.walls) {
    const doors = doorsByWallId.get(wall.id) ?? [];
    for (const segment of roomWallSolidSegments(wall, doors)) {
      const span = segmentWall({ ...wall, color: wallColors.get(wall.id) ?? WALL_CAP_COLOR }, segment);
      // Sort horizontal walls at their near edge, not their centre, so a
      // character or prop just behind the wall cannot paint over its face.
      const depth = span.z + (span.axis === "horizontal" ? span.thickness / 2 : 0);
      items.push({ depth, draw: (ctx, p, actors = []) => drawWallSpan(ctx, p, span, actors.some(actor => actor.local && wallOccludesActor(span, actor))) });
    }
    for (const door of doors) {
      const thresholdDepth = wall.z + (wall.axis === "vertical" ? door.offset : 0);
      items.push({ depth: thresholdDepth, draw: (ctx, p, actors = []) => drawDoorway(ctx, p, wall, door, actors, doorProgress.get(door.id) ?? 0) });
    }
  }
  return items;
}

export function drawMap2dWalls(ctx: CanvasRenderingContext2D, p: Map2dProjection, layout: RoomLayout): void {
  ctx.save();
  for (const item of map2dWallDrawItems(layout).sort((a, b) => a.depth - b.depth)) item.draw(ctx, p);
  ctx.restore();
}
