import type { RoomLayoutZone } from "@gammyverse/shared";

const LEGACY_TEAM_OFFICE_NAME = /^T(\d+)\s+Office\s*(.*)$/i;
const TEAM_OFFICE_ID = /^team-(\d+)-office-/i;
export const TEAM_ZONE_PADDING_M = 2;

/** Group named campus desks and legacy campus desks by their team number. */
export function groupTeamZones(zones: readonly RoomLayoutZone[]) {
  const teamMembers = new Map<number, RoomLayoutZone[]>();
  const otherZones: RoomLayoutZone[] = [];
  for (const zone of zones) {
    const team = zone.kind === "private" ? TEAM_OFFICE_ID.exec(zone.id) ?? LEGACY_TEAM_OFFICE_NAME.exec(zone.name) : null;
    if (!team) {
      otherZones.push(zone);
      continue;
    }
    const number = Number(team[1]);
    const members = teamMembers.get(number);
    if (members) members.push(zone);
    else teamMembers.set(number, [zone]);
  }

  const teams = [...teamMembers].sort(([left], [right]) => left - right).map(([number, members]) => {
    const firstName = members[0].name;
    const legacy = LEGACY_TEAM_OFFICE_NAME.test(firstName);
    const label = (legacy ? "" : firstName.replace(/\s+Office\s+\d+$/i, "")) || `Team ${number}`;
    const minX = Math.min(...members.map(zone => zone.x - zone.width / 2));
    const maxX = Math.max(...members.map(zone => zone.x + zone.width / 2));
    const minZ = Math.min(...members.map(zone => zone.z - zone.depth / 2));
    const maxZ = Math.max(...members.map(zone => zone.z + zone.depth / 2));
    return {
      id: `team-${number}`, label, legacy, members,
      x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
      width: maxX - minX + 2 * TEAM_ZONE_PADDING_M,
      depth: maxZ - minZ + 2 * TEAM_ZONE_PADDING_M,
    };
  });
  return { teams, otherZones };
}
