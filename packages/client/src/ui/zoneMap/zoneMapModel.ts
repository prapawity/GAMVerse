import type { RoomLayout, RoomLayoutZone } from "@gammyverse/shared";
import { groupTeamZones } from "../../teamZones";

/** Coarse categories drawn on the zone map; colours live in ZoneMapOverlay.css. */
export type ZoneMapCategory = "team" | "meeting" | "townhall" | "restroom" | "common" | "room";
export type ZoneMapRect = { x: number; z: number; width: number; depth: number };
export type ZoneMapSeat = ZoneMapRect & { id: string; label: string };
export type ZoneMapRegion = ZoneMapRect & {
  id: string;
  label: string;
  category: ZoneMapCategory;
  /** Individual desk rooms inside a team region. */
  seats: ZoneMapSeat[];
};

const TOWN_HALL_NAME = /town\s*hall/i;
const MEETING_NAME = /meeting/i;

function zoneCategory(zone: RoomLayoutZone): ZoneMapCategory {
  if (zone.kind === "restroom") return "restroom";
  if (zone.kind === "private") return "room";
  if (zone.id.includes("townhall") || TOWN_HALL_NAME.test(zone.name)) return "townhall";
  return MEETING_NAME.test(zone.name) || zone.id.startsWith("meeting-") ? "meeting" : "common";
}

/**
 * Collapses the detailed layout into a few readable regions: one block per team
 * (with its desks as seats) and one block per shared room.
 */
export function buildZoneMapRegions(zones: readonly RoomLayoutZone[]): ZoneMapRegion[] {
    const { teams, otherZones } = groupTeamZones(zones);
  const regions: ZoneMapRegion[] = otherZones.map(zone => ({
    id: zone.id, label: zone.name, category: zoneCategory(zone),
    x: zone.x, z: zone.z, width: zone.width, depth: zone.depth, seats: [],
  }));
  for (const { id, label, legacy, members, ...bounds } of teams) {
    regions.push({
      id, label, category: "team", ...bounds,
      seats: members.map((zone) => ({ id: zone.id, label: zone.ownerUsername?.trim() || (legacy ? zone.name : zone.name.match(/(Office\s+\d+)$/i)?.[1] || zone.name), x: zone.x, z: zone.z, width: zone.width, depth: zone.depth })),
    });
  }
return regions;
}

function contains(rect: ZoneMapRect, point: { x: number; z: number }): boolean {
  return Math.abs(point.x - rect.x) <= rect.width / 2 && Math.abs(point.z - rect.z) <= rect.depth / 2;
}

/** Name of the smallest region (and seat) holding the point, or null outdoors. */
export function locateInZoneMap(regions: readonly ZoneMapRegion[], point: { x: number; z: number }): { region: ZoneMapRegion; seat: ZoneMapSeat | null } | null {
  let best: ZoneMapRegion | null = null;
  for (const region of regions) {
    if (!contains(region, point)) continue;
    if (!best || region.width * region.depth < best.width * best.depth) best = region;
  }
  if (!best) return null;
  return { region: best, seat: best.seats.find((seat) => contains(seat, point)) ?? null };
}

export function zoneMapLocationLabel(found: ReturnType<typeof locateInZoneMap>): string {
  if (!found) return "Outside";
  return found.seat ? `${found.region.label} · ${found.seat.label}` : found.region.label;
}

/** Map extents; the layout's own dimensions win over the campus default. */
export function zoneMapViewBox(layout: Pick<RoomLayout, "dimensions"> | null, fallback: { width: number; depth: number }) {
  const { width, depth } = layout?.dimensions ?? fallback;
  return { minX: -width / 2, minZ: -depth / 2, width, depth };
}
