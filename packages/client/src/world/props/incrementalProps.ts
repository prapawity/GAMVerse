import { ROOM_PROP_CATALOG, type RoomLayout, type RoomLayoutProp } from "@gammyverse/shared";
import { isInstancedScenery } from "../instancedScenery";

const catalogByAsset = new Map<string, (typeof ROOM_PROP_CATALOG)[number]>();
for (const definition of ROOM_PROP_CATALOG) if (!catalogByAsset.has(definition.asset)) catalogByAsset.set(definition.asset, definition);

const ROAD_TILE_GROUP = "Roads · Tiles";

/**
 * Props the scene can add, move and remove one at a time. Vehicles (own layer
 * and handles), instanced scenery (batched by asset) and legacy road tiles
 * (replaced by the roadway network) still need a full scene rebuild.
 */
export function isIncrementalProp(prop: Pick<RoomLayoutProp, "asset">, layoutHasRoadways: boolean) {
  const catalog = catalogByAsset.get(prop.asset);
  if (!catalog || catalog.vehicleId || isInstancedScenery(catalog)) return false;
  if (layoutHasRoadways && catalog.group === ROAD_TILE_GROUP) return false;
  return true;
}

/** The layout the scene is built from: everything except the incremental props. */
export function sceneStructureLayout(layout: RoomLayout): RoomLayout {
  const hasRoadways = Boolean(layout.roadways?.length);
  return { ...layout, props: layout.props.filter((prop) => !isIncrementalProp(prop, hasRoadways)) };
}

export type PropDiff = { added: RoomLayoutProp[]; removed: string[]; changed: RoomLayoutProp[] };

const propSignature = (prop: RoomLayoutProp) => JSON.stringify(prop);

/** Id-based diff. A prop whose any field differs counts as changed. */
export function diffProps(previous: readonly RoomLayoutProp[], next: readonly RoomLayoutProp[]): PropDiff {
  const before = new Map(previous.map((prop) => [prop.id, prop]));
  const after = new Map(next.map((prop) => [prop.id, prop]));
  const added: RoomLayoutProp[] = [];
  const changed: RoomLayoutProp[] = [];
  for (const prop of next) {
    const old = before.get(prop.id);
    if (!old) added.push(prop);
    else if (old !== prop && propSignature(old) !== propSignature(prop)) changed.push(prop);
  }
  const removed = previous.filter((prop) => !after.has(prop.id)).map((prop) => prop.id);
  return { added, removed, changed };
}

/** Signature that only changes when the scene needs a full rebuild. */
export function sceneStructureSignature(layout: RoomLayout | null) {
  return layout ? JSON.stringify(sceneStructureLayout(layout)) : "";
}
