import type { RoomLayoutZone } from "./roomLayout.js";
import type { StarterPlacement } from "./campusFurnishingTemplates.js";

const DESK_ASSET = "external-pixel-modern-office-pixel-modern-office-desk-l-shaped-e63b68bc";
const KEYBOARD_ASSET = "kit:computerkeyboard";
const MONITOR_ASSETS = [
  "computerScreen",
  "external-pixel-modern-office-pixel-modern-office-monitor-arm-54a8d67b",
  "external-cozy-home-interiors-cozy-home-interiors-computer-monitor-3e762133",
] as const;
// A double bed (3 × 3 m) cannot sit beside the entrance aisle of an 8 × 8 m studio, so every studio uses the single bed.
const BED_ASSET = "kit:bedsingle";
const PLANT_ASSETS = ["kit:pottedplant", "kit:plantsmall1", "kit:plantsmall2", "kit:plantsmall3"] as const;
const DECOR_ASSETS = ["kit:books", "kit:radio"] as const;
const KITCHEN_ASSETS = ["kit:kitchenfridge", "kit:kitchensink", "kit:kitchencabinet", "kit:kitchenstove"] as const;
const KITCHEN_KEYS = ["fridge", "sink", "counter", "stove"] as const;
const FLOOR_LAMP_ASSET = "external-pixel-modern-office-pixel-modern-office-floor-lamp-34798ca7";
const RUG_ASSET = "external-pixel-modern-office-pixel-modern-office-floor-tile-carpet-01352f6c";
const QUARTER_TURN_RAD = Math.PI / 2;
const HALF_TURN_RAD = Math.PI;
// The entrance runs through the middle of the north and south walls, so everything lives in the two side columns.
const WALL_LINE_X_M = 3.4;
const COLUMN_X_M = 2.4;
const KITCHEN_SPACING_M = 1;
const DESKTOP_ROW_OFFSET_M = 0.5;
const DESK_TO_CHAIR_M = 2.4;
// A bed beside the aisle sits as close as the walking radius allows, so the 2 m wide bed stays within seat-approach reach of the aisle.
const BED_AISLE_X_M = 1.89;
const BED_WALL_X_M = 2.38;

export const STUDIO_LAYOUT_COUNT = 3;
/** Keys every studio layout provides, whatever its arrangement. */
export const STUDIO_REQUIRED_KEYS = ["desk", "monitor", "keyboard", "chair", "bed", "fridge", "sink", "counter", "stove", "washer", "storage", "decor", "plant"] as const;

function identityHash(identity: string): number {
  let hash = 2166136261;
  for (const character of identity) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

type Pick3 = { monitor: string; plant: string; decor: string };

/** A workstation: desk with monitor and keyboard on the far side from the chair. `facing` is +1 when the chair is south of the desk. */
function workstation(deskX: number, deskZ: number, facing: 1 | -1, assets: Pick3): StarterPlacement[] {
  return [
    { key: "desk", asset: DESK_ASSET, xM: deskX, zM: deskZ },
    { key: "monitor", asset: assets.monitor, xM: deskX, zM: deskZ - facing * DESKTOP_ROW_OFFSET_M, supported: true },
    { key: "keyboard", asset: KEYBOARD_ASSET, xM: deskX, zM: deskZ + facing * DESKTOP_ROW_OFFSET_M, supported: true },
    { key: "chair", asset: "kit:chairdesk", xM: deskX, zM: deskZ + facing * DESK_TO_CHAIR_M, rotationRad: facing > 0 ? 0 : HALF_TURN_RAD },
  ];
}

/** Kitchen units in a row along a side wall, starting at `startZ` and facing into the room. */
function kitchenRow(side: 1 | -1, startZ: number): StarterPlacement[] {
  return KITCHEN_ASSETS.map((asset, index) => ({
    key: KITCHEN_KEYS[index]!, asset, xM: side * WALL_LINE_X_M, zM: startZ + index * KITCHEN_SPACING_M, rotationRad: -side * QUARTER_TURN_RAD,
  }));
}

/** Layout A, "work nook": desk in the north-west, bed in the north-east, kitchen down the east wall. Authored for the west-hand desk. */
function workNook(assets: Pick3): StarterPlacement[] {
  return [
    ...workstation(-COLUMN_X_M, -2.6, 1, assets),
    { key: "rug", asset: RUG_ASSET, xM: -COLUMN_X_M, zM: -1.4 },
    { key: "bed", asset: BED_ASSET, xM: BED_AISLE_X_M, zM: -2 },
    ...kitchenRow(1, 0.4),
    { key: "washer", asset: "kit:washer", xM: -WALL_LINE_X_M, zM: 3.4 },
    { key: "storage", asset: "kit:bookcaseopenlow", xM: -COLUMN_X_M, zM: 3.4 },
    { key: "decor", asset: assets.decor, xM: -COLUMN_X_M, zM: 3.4, supported: true },
    { key: "plant", asset: assets.plant, xM: -WALL_LINE_X_M, zM: 1.6 },
    { key: "lamp", asset: FLOOR_LAMP_ASSET, xM: -WALL_LINE_X_M, zM: 0.4 },
  ];
}

/** Layout B, "loft": bed and desk share the west column, the kitchen runs down the north half of the east wall. */
function loft(assets: Pick3): StarterPlacement[] {
  return [
    { key: "bed", asset: BED_ASSET, xM: -BED_AISLE_X_M, zM: -2 },
    ...workstation(-COLUMN_X_M, 2.6, -1, assets),
    { key: "rug", asset: RUG_ASSET, xM: -COLUMN_X_M, zM: 1.4 },
    ...kitchenRow(1, -3.4),
    { key: "washer", asset: "kit:washer", xM: WALL_LINE_X_M, zM: 3.4 },
    { key: "storage", asset: "kit:bookcaseopenlow", xM: WALL_LINE_X_M, zM: 2.4 },
    { key: "decor", asset: assets.decor, xM: WALL_LINE_X_M, zM: 2.4, supported: true },
    { key: "plant", asset: assets.plant, xM: COLUMN_X_M - 0.2, zM: 3.4 },
    { key: "lamp", asset: FLOOR_LAMP_ASSET, xM: WALL_LINE_X_M, zM: 1.0 },
  ];
}

/** Layout C, "host": television lounge in the north-west, bed in the south-west, workstation and kitchen on the east. */
function host(assets: Pick3): StarterPlacement[] {
  return [
    { key: "tv-cabinet", asset: "kit:cabinettelevision", xM: -WALL_LINE_X_M, zM: -2, rotationRad: -QUARTER_TURN_RAD },
    { key: "sofa", asset: "kit:loungesofa", xM: -1.7, zM: -2, rotationRad: QUARTER_TURN_RAD },
    { key: "rug", asset: RUG_ASSET, xM: -2.4, zM: -2 },
    { key: "storage", asset: "kit:bookcaseopenlow", xM: -WALL_LINE_X_M, zM: 0.4 },
    { key: "decor", asset: assets.decor, xM: -WALL_LINE_X_M, zM: 0.4, supported: true },
    { key: "lamp", asset: FLOOR_LAMP_ASSET, xM: -1.9, zM: 0.4 },
    { key: "bed", asset: BED_ASSET, xM: -BED_WALL_X_M, zM: 2.4 },
    ...workstation(COLUMN_X_M, -2.6, 1, assets),
    { key: "washer", asset: "kit:washer", xM: WALL_LINE_X_M, zM: -0.6 },
    ...kitchenRow(1, 0.4),
    { key: "plant", asset: assets.plant, xM: COLUMN_X_M, zM: 3.4 },
  ];
}

const LAYOUTS = [workNook, loft, host] as const;

/** Mirrors a west/east layout; quarter-turn facings swap sides while half turns stay put. */
function mirrored(placements: StarterPlacement[]): StarterPlacement[] {
  return placements.map(item => ({ ...item, xM: -item.xM, ...(item.rotationRad === undefined ? {} : { rotationRad: Math.abs(item.rotationRad) === QUARTER_TURN_RAD ? -item.rotationRad : item.rotationRad }) }));
}

/**
 * Fixed 8 × 8 m studio in one of three layouts, optionally mirrored. The choice is stable per room id, and the
 * central north/south entrance aisle stays empty in every layout.
 */
export function campusPrivateRoomPlacements(zone: RoomLayoutZone): readonly StarterPlacement[] {
  const variant = (key: string) => identityHash(`${zone.id}:${key}`);
  const assets: Pick3 = {
    monitor: MONITOR_ASSETS[variant("computer") % MONITOR_ASSETS.length]!,
    plant: PLANT_ASSETS[variant("plant") % PLANT_ASSETS.length]!,
    decor: DECOR_ASSETS[variant("decor") % DECOR_ASSETS.length]!,
  };
  const placements = LAYOUTS[variant("layout") % STUDIO_LAYOUT_COUNT]!(assets);
  return variant("mirror") % 2 === 1 ? mirrored(placements) : placements;
}
