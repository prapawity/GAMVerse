import type { RoomLayout, RoomLayoutProp, RoomLayoutWall } from "@gammyverse/shared";
import { roomWallSolidSegments } from "@gammyverse/shared";
import type { Map2dProjection } from "./map2dProjection";
import { worldToScreen } from "./map2dProjection";

type ClipEdge = { axis: "x" | "y"; value: number; keepPositive: boolean };
type WallSpan = { wall: RoomLayoutWall; x: number; z: number; halfLength: number };
const WALL_INDEX_CELL_M = 8;
const wallSpanIndexCache = new WeakMap<RoomLayout, ReadonlyMap<string, readonly WallSpan[]>>();

function wallCellKey(x: number, z: number): string { return `${x}:${z}`; }

function wallSpanIndex(layout: RoomLayout): ReadonlyMap<string, readonly WallSpan[]> {
  const cached = wallSpanIndexCache.get(layout);
  if (cached) return cached;
  const cells = new Map<string, WallSpan[]>();
  const doorsByWall = new Map<string, typeof layout.doors>();
  for (const door of layout.doors) {
    const bucket = doorsByWall.get(door.wallId);
    if (bucket) bucket.push(door);
    else doorsByWall.set(door.wallId, [door]);
  }
  for (const wall of layout.walls) {
    for (const segment of roomWallSolidSegments(wall, doorsByWall.get(wall.id) ?? [])) {
      const midpoint = (segment.start + segment.end) / 2;
      const span: WallSpan = {
        wall,
        x: wall.x + (wall.axis === "horizontal" ? midpoint : 0),
        z: wall.z + (wall.axis === "vertical" ? midpoint : 0),
        halfLength: (segment.end - segment.start) / 2,
      };
      const minX = Math.floor((span.x - (wall.axis === "horizontal" ? span.halfLength : wall.thickness / 2)) / WALL_INDEX_CELL_M);
      const maxX = Math.floor((span.x + (wall.axis === "horizontal" ? span.halfLength : wall.thickness / 2)) / WALL_INDEX_CELL_M);
      const minZ = Math.floor((span.z - (wall.axis === "vertical" ? span.halfLength : wall.thickness / 2)) / WALL_INDEX_CELL_M);
      const maxZ = Math.floor((span.z + (wall.axis === "vertical" ? span.halfLength : wall.thickness / 2)) / WALL_INDEX_CELL_M);
      for (let cellX = minX; cellX <= maxX; cellX += 1) for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const key = wallCellKey(cellX, cellZ);
        const bucket = cells.get(key);
        if (bucket) bucket.push(span);
        else cells.set(key, [span]);
      }
    }
  }
  wallSpanIndexCache.set(layout, cells);
  return cells;
}

/** Clip a prop sprite to the side of every solid wall occupied by its footprint. */
export function withMap2dPropWallClip(
  ctx: CanvasRenderingContext2D,
  projection: Map2dProjection,
  prop: RoomLayoutProp,
  layout: RoomLayout | null,
  draw: () => void,
): void {
  if (!layout?.walls.length) { draw(); return; }
  const cosine = Math.abs(Math.cos(prop.rotation));
  const sine = Math.abs(Math.sin(prop.rotation));
  const halfX = (cosine * prop.width + sine * prop.depth) / 2;
  const halfZ = (sine * prop.width + cosine * prop.depth) / 2;
  const clipEdges: ClipEdge[] = [];
  const index = wallSpanIndex(layout);
  const candidates = new Set<WallSpan>();
  const minX = Math.floor((prop.x - halfX) / WALL_INDEX_CELL_M);
  const maxX = Math.floor((prop.x + halfX) / WALL_INDEX_CELL_M);
  const minZ = Math.floor((prop.z - halfZ) / WALL_INDEX_CELL_M);
  const maxZ = Math.floor((prop.z + halfZ) / WALL_INDEX_CELL_M);
  for (let cellX = minX; cellX <= maxX; cellX += 1) for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1)
    for (const span of index.get(wallCellKey(cellX, cellZ)) ?? []) candidates.add(span);

  for (const span of candidates) {
    const { wall } = span;
    if (wall.axis === "horizontal") {
      const overlapsAlongWall = Math.abs(prop.x - span.x) <= span.halfLength + halfX;
      const distance = prop.z - wall.z;
      if (!overlapsAlongWall || Math.abs(distance) > halfZ + wall.thickness / 2) continue;
      const edge = worldToScreen(projection, { x: prop.x, z: wall.z + Math.sign(distance || 1) * wall.thickness / 2 }).y;
      clipEdges.push({ axis: "y", value: edge, keepPositive: distance >= 0 });
    } else {
      const overlapsAlongWall = Math.abs(prop.z - span.z) <= span.halfLength + halfZ;
      const distance = prop.x - wall.x;
      if (!overlapsAlongWall || Math.abs(distance) > halfX + wall.thickness / 2) continue;
      const edge = worldToScreen(projection, { x: wall.x + Math.sign(distance || 1) * wall.thickness / 2, z: prop.z }).x;
      clipEdges.push({ axis: "x", value: edge, keepPositive: distance >= 0 });
    }
  }

  if (!clipEdges.length) { draw(); return; }
  ctx.save();
  for (const edge of clipEdges) {
    ctx.beginPath();
    if (edge.axis === "y") {
      const top = edge.keepPositive ? edge.value : -1_000_000;
      ctx.rect(-1_000_000, top, 2_000_000, edge.keepPositive ? 1_000_000 : edge.value + 1_000_000);
    } else {
      const left = edge.keepPositive ? edge.value : -1_000_000;
      ctx.rect(left, -1_000_000, edge.keepPositive ? 1_000_000 : edge.value + 1_000_000, 2_000_000);
    }
    ctx.clip();
  }
  draw();
  ctx.restore();
}
