import type { RoomLayoutZone } from "./roomLayout.js";
import type { StarterPlacement } from "./campusFurnishingTemplates.js";

const HALF_TURN_RAD = Math.PI;
const QUARTER_TURN_RAD = Math.PI / 2;
const WALL_ART_ELEVATION_M = 1.5;
const WALL_ITEM_INSET_M = 0.6;
const PLANT_INSET_M = 1.2;

const ASSET = {
  picture: "office-wall-picture",
  shelf: "office-wall-shelf",
  plant: "kit:pottedplant",
  largePlant: "external-cozy-home-interiors-cozy-home-interiors-plant-large-f54433e5",
  lamp: "external-pixel-modern-office-pixel-modern-office-floor-lamp-34798ca7",
  bench: "kit:bench",
  rug: "external-pixel-modern-office-pixel-modern-office-floor-tile-carpet-01352f6c",
} as const;

type Wall = "north" | "south" | "east" | "west";
/** Rotation that turns an item on `wall` to face into the room (seat forward is local -Z). */
const FACING_RAD: Record<Wall, number> = { north: HALF_TURN_RAD, south: 0, west: -QUARTER_TURN_RAD, east: QUARTER_TURN_RAD };

/** A wall-hung item: `along` is the position along the wall, measured from the room centre. */
export function wallItem(key: string, asset: string, zone: Pick<RoomLayoutZone, "width" | "depth">, wall: Wall, along: number, elevationM = WALL_ART_ELEVATION_M): StarterPlacement {
  const halfWidthM = zone.width / 2 - WALL_ITEM_INSET_M;
  const halfDepthM = zone.depth / 2 - WALL_ITEM_INSET_M;
  const [xM, zM] = wall === "north" ? [along, -halfDepthM] : wall === "south" ? [along, halfDepthM] : wall === "west" ? [-halfWidthM, along] : [halfWidthM, along];
  return { key, asset, xM, zM, rotationRad: FACING_RAD[wall], elevationM, collision: false };
}

/** Evenly spaced positions centred on zero, e.g. `spread(3, 8)` is -8, 0, 8. */
export function spread(count: number, step: number): number[] {
  return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * step);
}

/** Town Hall: plants, pictures and lamps down the side aisles, benches by the door. The seating block stays untouched. */
export function townhallDecor(zone: RoomLayoutZone): StarterPlacement[] {
  const placements: StarterPlacement[] = [];
  for (const side of [-1, 1] as const) {
    const wall: Wall = side < 0 ? "west" : "east";
    const aisleX = side * (zone.width / 2 - PLANT_INSET_M - 0.3);
    for (const [index, z] of [-15, -5, 5, 15].entries()) placements.push({ key: `decor-plant-${side}-${index}`, asset: index % 2 ? ASSET.plant : ASSET.largePlant, xM: aisleX, zM: z });
    for (const [index, z] of [-10, 0, 10].entries()) placements.push(wallItem(`decor-picture-${side}-${index}`, ASSET.picture, zone, wall, z));
    for (const [index, z] of [-10, 10].entries()) placements.push({ key: `decor-lamp-${side}-${index}`, asset: ASSET.lamp, xM: aisleX - side * 2.2, zM: z });
    placements.push(wallItem(`decor-picture-north-${side}`, ASSET.picture, zone, "north", side * 10));
    placements.push({ key: `decor-bench-${side}`, asset: ASSET.bench, xM: side * 8, zM: zone.depth / 2 - 1.2, rotationRad: HALF_TURN_RAD });
  }
  return placements;
}

/** Fifty-seat meeting rooms: art flanking the screen, shelves and a picture on the south wall, lamps and plants at the edges. */
export function civicMeetingDecor(zone: RoomLayoutZone): StarterPlacement[] {
  const placements: StarterPlacement[] = [];
  for (const side of [-1, 1] as const) {
    placements.push(wallItem(`decor-picture-${side}`, ASSET.picture, zone, "north", side * 6.5));
    placements.push(wallItem(`decor-shelf-${side}`, ASSET.shelf, zone, "south", side * 5));
    for (const [index, z] of [-3.8, 3.8].entries()) placements.push({ key: `decor-lamp-${side}-${index}`, asset: ASSET.lamp, xM: side * (zone.width / 2 - 1.2), zM: z });
    placements.push({ key: `decor-plant-${side}`, asset: ASSET.largePlant, xM: side * (zone.width / 2 - 1.2), zM: -zone.depth / 2 + 2.6 });
  }
  placements.push(wallItem("decor-picture-south", ASSET.picture, zone, "south", 0));
  return placements;
}

/** Lobby: pictures along the long walls and plants in the corners, clear of reception and the door. */
export function lobbyDecor(zone: RoomLayoutZone): StarterPlacement[] {
  const placements: StarterPlacement[] = [];
  for (const [index, x] of [-6, 0, 6].entries()) {
    placements.push(wallItem(`decor-picture-north-${index}`, ASSET.picture, zone, "north", x));
    placements.push(wallItem(`decor-picture-south-${index}`, ASSET.picture, zone, "south", x));
  }
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) {
    placements.push({ key: `decor-plant-${sx}-${sz}`, asset: sx < 0 ? ASSET.largePlant : ASSET.plant, xM: sx * (zone.width / 2 - 1.3), zM: sz * (zone.depth / 2 - 1.3) });
  }
  return placements;
}

export const DECOR_ASSETS = ASSET;
/** Catalog assets flagged `wallMounted`: the office-props validator lets these hang at a fixed height without a supporting surface. */
export const WALL_MOUNTED_ASSETS: ReadonlySet<string> = new Set([ASSET.picture, ASSET.shelf]);
