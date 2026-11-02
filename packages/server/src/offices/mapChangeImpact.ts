import type { Position, RoomLayout, RoomLayoutProp, WorldConfig } from "@gammyverse/shared";
import { isAccessibleSpawn } from "./privateMovement.js";
import { propDefinitionByAsset } from "./roomSeatIndex.js";

const NEAREST_WALKABLE_STEP_M = 0.5;
const NEAREST_WALKABLE_MAX_RADIUS_M = 12;
const NEAREST_WALKABLE_ANGLES = 16;

const byId = <T extends { id: string }>(items: T[]) => [...items].sort((first, second) => first.id.localeCompare(second.id));

/** Walls, doors, zones, roads, size and spawn: everything except props. */
function structuralSignature(layout: RoomLayout) {
  return JSON.stringify({
    dimensions: layout.dimensions ?? null,
    zones: byId(layout.zones).map(({ id, kind, x, z, width, depth }) => [id, kind, x, z, width, depth]),
    walls: byId(layout.walls).map(({ id, axis, x, z, length, thickness, height, color, asset }) => [id, axis, x, z, length, thickness, height, color ?? null, asset ?? null]),
    doors: byId(layout.doors).map(({ id, wallId, offset, width, kind, leaves, asset }) => [id, wallId, offset, width, kind ?? null, leaves ?? null, asset ?? null]),
    roadways: byId(layout.roadways ?? []).map(({ id, x, z, width, depth, kind }) => [id, x, z, width, depth, kind]),
    spawnPoint: layout.spawnPoint ?? null,
  });
}

/**
 * Stricter than the world signature: any field of a zone, wall, door or road,
 * including a desk's owner and name, counts. Desk walks and meet requests depend
 * on those, so a change must still cancel them.
 */
function navigationSignature(layout: RoomLayout) {
  return JSON.stringify({
    dimensions: layout.dimensions ?? null,
    zones: byId(layout.zones),
    walls: byId(layout.walls),
    doors: byId(layout.doors),
    roadways: byId(layout.roadways ?? []),
    spawnPoint: layout.spawnPoint ?? null,
  });
}

function propSignature({ id, asset, x, z, rotation, width, depth, collision, elevation }: RoomLayoutProp) {
  return JSON.stringify([id, asset, x, z, rotation, width, depth, collision, elevation ?? null]);
}

/** Everything that decides collision, routes and the client's `worldVersion`. */
export function worldGeometrySignature(layout: RoomLayout) {
  return JSON.stringify({
    structure: structuralSignature(layout),
    props: byId(layout.props).map(propSignature),
  });
}

export type MapChangeImpact = {
  /** Same meaning as the old signature comparison: anything walkable-relevant moved. */
  worldGeometryChanged: boolean;
  /** Existing routes, desk walks and meet requests may no longer be valid. */
  navigationChanged: boolean;
  /** A seat prop was added, moved or removed. */
  seatsChanged: boolean;
  changedPropIds: string[];
};

function isNavigationProp(prop: RoomLayoutProp) {
  const definition = propDefinitionByAsset.get(prop.asset);
  return prop.collision === true || definition?.interaction === "sit" || definition?.vehicleId !== undefined;
}

function isSeatProp(prop: RoomLayoutProp) {
  return propDefinitionByAsset.get(prop.asset)?.interaction === "sit";
}

/**
 * Compares two layouts and says which server-side work a map apply really needs.
 * A decoration that does not block movement, seat anyone, or drive must not
 * cancel everyone's walks.
 */
export function classifyMapChange(previous: RoomLayout, next: RoomLayout): MapChangeImpact {
  const structuralChanged = structuralSignature(previous) !== structuralSignature(next);
  const navigationStructureChanged = structuralChanged || navigationSignature(previous) !== navigationSignature(next);
  const before = new Map(previous.props.map((prop) => [prop.id, prop]));
  const after = new Map(next.props.map((prop) => [prop.id, prop]));
  const changedPropIds: string[] = [];
  let navigationPropChanged = false;
  let seatsChanged = false;
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const oldProp = before.get(id);
    const newProp = after.get(id);
    if (oldProp && newProp && propSignature(oldProp) === propSignature(newProp)) continue;
    changedPropIds.push(id);
    for (const prop of [oldProp, newProp]) {
      if (!prop) continue;
      if (isNavigationProp(prop)) navigationPropChanged = true;
      if (isSeatProp(prop)) seatsChanged = true;
    }
  }
  return {
    worldGeometryChanged: structuralChanged || changedPropIds.length > 0,
    navigationChanged: navigationStructureChanged || navigationPropChanged,
    seatsChanged,
    changedPropIds,
  };
}

/**
 * Closest free walkable point around `from`, searched in expanding rings.
 * Used when a new prop lands on a player so they step aside instead of being
 * thrown to a spawn point or disconnected.
 */
export function findNearestWalkable(from: Position, occupied: readonly Position[], world: WorldConfig): Position | null {
  for (let radius = NEAREST_WALKABLE_STEP_M; radius <= NEAREST_WALKABLE_MAX_RADIUS_M; radius += NEAREST_WALKABLE_STEP_M) {
    for (let index = 0; index < NEAREST_WALKABLE_ANGLES; index += 1) {
      const angle = (index / NEAREST_WALKABLE_ANGLES) * Math.PI * 2;
      const candidate = { x: from.x + Math.cos(angle) * radius, z: from.z + Math.sin(angle) * radius };
      if (isAccessibleSpawn(candidate, occupied, world)) return candidate;
    }
  }
  return null;
}
