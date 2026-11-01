import type { RoomLayout, RoomLayoutZone } from "@gammyverse/shared";

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

export const ZONE_MAP_TEAM_PADDING_M = 2;
const LEGACY_TEAM_OFFICE_NAME = /^T(\d+)\s+Office\s*(.*)$/i;
const TOWN_HALL_NAME = /town\s*hall/i;
const MEETING_NAME = /meeting/i;

function zoneCategory(zone: RoomLayoutZone): ZoneMapCategory {
  if (zone.kind === "restroom") return "restroom";
  if (zone.kind === "private") return "room";
  if (zone.id.includes("townhall") || TOWN_HALL_NAME.test(zone.name)) return "townhall";
  return MEETING_NAME.test(zone.name) || zone.id.startsWith("meeting-") ? "meeting" : "common";
}

function boundsOf(rects: readonly ZoneMapRect[], padding: number): ZoneMapRect {
  const minX = Math.min(...rects.map((r) => r.x - r.width / 2)) - padding;
  const maxX = Math.max(...rects.map((r) => r.x + r.width / 2)) + padding;
  const minZ = Math.min(...rects.map((r) => r.z - r.depth / 2)) - padding;
  const maxZ = Math.max(...rects.map((r) => r.z + r.depth / 2)) + padding;
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
}

/**
 * Collapses the detailed layout into a few readable regions: one block per team
 * (with its desks as seats) and one block per shared room.
 */
export function buildZoneMapRegions(zones: readonly RoomLayoutZone[]): ZoneMapRegion[] {
  const teams = new Map<number, RoomLayoutZone[]>();
  const regions: ZoneMapRegion[] = [];
  for (const zone of zones) {
    const teamId = zone.kind === "private" ? /^team-(\d+)-office-/i.exec(zone.id) : null;
    const legacyTeam = zone.kind === "private" && !teamId ? LEGACY_TEAM_OFFICE_NAME.exec(zone.name) : null;
    if (teamId || legacyTeam) {
      const number = Number(teamId?.[1] ?? legacyTeam?.[1]);
      teams.set(number, [...(teams.get(number) ?? []), zone]);
      continue;
    }
    regions.push({ id: zone.id, label: zone.name, category: zoneCategory(zone), x: zone.x, z: zone.z, width: zone.width, depth: zone.depth, seats: [] });
  }
  for (const [number, members] of [...teams].sort((a, b) => a[0] - b[0])) {
    const firstName = members[0]?.name ?? "";
    const isLegacyName = LEGACY_TEAM_OFFICE_NAME.test(firstName);
    const teamLabel = isLegacyName ? `Team ${number}` : firstName.replace(/\s+Office\s+\d+$/i, "");
    regions.push({
      id: `team-${number}`,
      label: teamLabel || `Team ${number}`,
      category: "team",
      ...boundsOf(members, ZONE_MAP_TEAM_PADDING_M),
      seats: members.map((zone) => ({ id: zone.id, label: zone.ownerUsername?.trim() || (isLegacyName ? zone.name : zone.name.match(/(Office\s+\d+)$/i)?.[1] || zone.name), x: zone.x, z: zone.z, width: zone.width, depth: zone.depth })),
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
