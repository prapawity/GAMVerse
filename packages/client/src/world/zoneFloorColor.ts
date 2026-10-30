import { campusRoomStyle, type RoomLayoutZone } from "@gammyverse/shared";

export const CAMPUS_GRASS_COLOR = 0xb8d2a5;
export const CAMPUS_STONE_COLOR = 0xe9e8df;
export const ZONE_COLOR_OPACITY = 0.22;

/** Opaque floors of generated rooms in the 3D world; rooms drawn in the editor keep their tinted zone colour. */
export function civicRoomFloorColor(zone: RoomLayoutZone): number | null {
  return campusRoomStyle(zone)?.floorColor ?? null;
}

/** Canvas uses the visible result of the 3D translucent zone floor. */
export function mapZoneFloorColor(zone: RoomLayoutZone, hasRoadways: boolean): string {
  const civic = civicRoomFloorColor(zone);
  if (civic !== null) return `#${civic.toString(16).padStart(6, "0")}`;
  const base = hasRoadways ? CAMPUS_GRASS_COLOR : CAMPUS_STONE_COLOR;
  if (!/^#[0-9a-f]{6}$/i.test(zone.color)) return `#${base.toString(16)}`;
  const tint = Number.parseInt(zone.color.slice(1), 16);
  const channel = (shift: number) => Math.round(((base >> shift) & 255) * (1 - ZONE_COLOR_OPACITY) + ((tint >> shift) & 255) * ZONE_COLOR_OPACITY);
  return `#${[16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}
