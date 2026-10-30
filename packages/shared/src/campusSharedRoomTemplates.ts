import type { RoomLayoutZone } from "./roomLayout.js";
import type { StarterPlacement } from "./campusFurnishingTemplates.js";
import { DECOR_ASSETS, spread, wallItem } from "./campusRoomDecor.js";

const HALF_TURN_RAD = Math.PI;
const QUARTER_TURN_RAD = Math.PI / 2;
const SERVING_LINE_INSET_M = 1.2;
const CORNER_INSET_M = 2.5;
const TABLE_ASSET = "table";
const CHAIR_ASSET = "kit:chair";
const TABLE_SEAT_X_M = [-0.8, 0.8];
const TABLE_SEAT_Z_M = [-1.8, 1.8];
const SERVICE_ASSET = {
  cabinet: "kit:kitchencabinet",
  fridge: "kit:kitchenfridge",
  coffee: "kit:kitchencoffeemachine",
  cooler: "external-pixel-modern-office-pixel-modern-office-water-cooler-33f143d4",
  snacks: "external-pixel-modern-office-pixel-modern-office-snack-shelf-aee54379",
} as const;

function diningGroup(key: string, xM: number, zM: number): StarterPlacement[] {
  return [
    { key: `${key}-table`, asset: TABLE_ASSET, xM, zM },
    ...TABLE_SEAT_Z_M.flatMap((seatZ, row) => TABLE_SEAT_X_M.map((seatX, column) => ({
      key: `${key}-chair-${row}-${column}`, asset: CHAIR_ASSET, xM: xM + seatX, zM: zM + seatZ, rotationRad: seatZ < 0 ? HALF_TURN_RAD : 0,
    }))),
  ];
}

/**
 * Cafeteria (door in the west wall): a serving counter with appliances along the north wall, six staggered dining
 * groups either side of a clear east-west aisle, benches along the south wall, and pictures, lamps and plants.
 */
export function campusCafeteriaPlacements(zone: RoomLayoutZone): StarterPlacement[] {
  const servingZ = -zone.depth / 2 + SERVING_LINE_INSET_M;
  const placements: StarterPlacement[] = [
    ...spread(10, 1).map((xM, index) => ({ key: `serving-counter-${index}`, asset: SERVICE_ASSET.cabinet, xM, zM: servingZ, rotationRad: HALF_TURN_RAD })),
  ];
  for (const side of [-1, 1] as const) {
    placements.push({ key: `serving-fridge-${side}`, asset: SERVICE_ASSET.fridge, xM: side * 6.5, zM: servingZ, rotationRad: HALF_TURN_RAD });
    placements.push({ key: `serving-appliance-${side}`, asset: side < 0 ? SERVICE_ASSET.coffee : SERVICE_ASSET.cooler, xM: side * 8.5, zM: servingZ, rotationRad: HALF_TURN_RAD });
    placements.push({ key: `serving-snacks-${side}`, asset: SERVICE_ASSET.snacks, xM: side * 10.5, zM: servingZ, rotationRad: HALF_TURN_RAD });
  }
  for (const [column, xM] of [-9, 1, 11].entries()) for (const [row, zM] of [-8, 8].entries()) {
    // Alternate the second row sideways so the dining area does not read as a parade-ground grid.
    placements.push(...diningGroup(`dining-${row}-${column}`, xM + (row === 1 ? 1.5 : 0), zM));
  }
  for (const [index, z] of [-12, 0, 12].entries()) placements.push(wallItem(`cafeteria-picture-${index}`, DECOR_ASSETS.picture, zone, "east", z));
  placements.push(wallItem("cafeteria-picture-south", DECOR_ASSETS.picture, zone, "south", 8));
  for (const [index, xM] of [-9, -3, 3, 9].entries()) placements.push({ key: `cafeteria-bench-${index}`, asset: DECOR_ASSETS.bench, xM, zM: zone.depth / 2 - 1.2, rotationRad: HALF_TURN_RAD });
  for (const side of [-1, 1] as const) {
    placements.push({ key: `cafeteria-plant-${side}`, asset: DECOR_ASSETS.largePlant, xM: side * (zone.width / 2 - CORNER_INSET_M), zM: zone.depth / 2 - CORNER_INSET_M });
    placements.push({ key: `cafeteria-corner-plant-${side}`, asset: DECOR_ASSETS.plant, xM: side * (zone.width / 2 - CORNER_INSET_M), zM: -zone.depth / 2 + CORNER_INSET_M + 1.5 });
    placements.push({ key: `cafeteria-lamp-${side}`, asset: DECOR_ASSETS.lamp, xM: zone.width / 2 - 1.5, zM: side * 6 });
  }
  return placements;
}

/**
 * Lounge (door in the south wall): two conversation groups around coffee tables on rugs, a bookcase wall, pictures,
 * armchairs, lamps and corner plants. The entrance aisle down the middle stays empty.
 */
export function campusLoungePlacements(zone: RoomLayoutZone): StarterPlacement[] {
  const placements: StarterPlacement[] = [];
  for (const side of [-1, 1] as const) {
    const groupX = side * 7;
    placements.push(
      { key: `lounge-rug-${side}`, asset: DECOR_ASSETS.rug, xM: groupX, zM: -6 },
      { key: `lounge-table-${side}`, asset: "kit:tablecoffee", xM: groupX, zM: -6 },
      { key: `lounge-sofa-north-${side}`, asset: "kit:loungesofa", xM: groupX, zM: -9, rotationRad: HALF_TURN_RAD },
      { key: `lounge-sofa-south-${side}`, asset: "kit:loungesofa", xM: groupX, zM: -3 },
      { key: `lounge-armchair-${side}`, asset: "external-pixel-modern-office-pixel-modern-office-armchair-86e0acaa", xM: side * 12, zM: 3, rotationRad: side < 0 ? -QUARTER_TURN_RAD : QUARTER_TURN_RAD },
      { key: `lounge-lamp-${side}`, asset: DECOR_ASSETS.lamp, xM: side * 12, zM: -6 },
      { key: `lounge-plant-${side}`, asset: DECOR_ASSETS.largePlant, xM: side * (zone.width / 2 - CORNER_INSET_M + 1), zM: zone.depth / 2 - CORNER_INSET_M },
      { key: `lounge-corner-plant-${side}`, asset: DECOR_ASSETS.plant, xM: side * (zone.width / 2 - CORNER_INSET_M + 1), zM: -zone.depth / 2 + CORNER_INSET_M },
    );
    for (const [index, z] of [-8, 0, 8].entries()) placements.push(wallItem(`lounge-picture-${side}-${index}`, DECOR_ASSETS.picture, zone, side < 0 ? "west" : "east", z));
  }
  for (const [index, xM] of spread(8, 2).entries()) {
    placements.push({ key: `lounge-bookcase-${index}`, asset: "kit:bookcaseclosedwide", xM, zM: -zone.depth / 2 + 0.9, rotationRad: HALF_TURN_RAD });
  }
  return placements;
}
