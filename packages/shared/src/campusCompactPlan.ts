import type { RoomLayout } from "./roomLayout.js";

/** Private rooms are 14 m wide and 8 m deep; rows are separated by 4 m alleys. */
export const COMPACT_ROOM_WIDTH_M = 14;
export const COMPACT_ROOM_DEPTH_M = 8;
const ALLEY_M = 4;
/** Gap between neighbouring team blocks: one alley on each side. */
export const COMPACT_TEAM_GAP_M = 2 * ALLEY_M;
/** Cross street between the team bands and the civic row, centre line. */
export const COMPACT_TEAM_ROAD_Z_M = 30;
/** Ring street (8 m) plus its 4 m verge on every side of the map. */
const RING_AND_VERGE_M = 12;
/** From the edge avenue's centre: half its width, the 20 m meeting room, the ring street (8 m) and its 4 m verge. */
const MEETING_RING_STACK_M = 4 + 20 + 8 + 4;
const MIN_WIDTH_M = 224;
const MIN_SLOTS = 3;
const MAX_SLOTS = 5;
export const COMPACT_MAX_PEOPLE_PER_TEAM = 15;
const COLUMN_CHOICES = [3, 4, 5, 6] as const;

export interface CompactCampusPlan {
  /** Team slots in the widest band (teams per half). */
  slots: number;
  columns: number;
  rows: number;
  /** Width of one team slot including its own alleys, which is also the width of its meeting room. */
  slotWidthM: number;
  blockDepthM: number;
  edgeRoadZ: number;
  width: number;
  depth: number;
}

/** Width of a band of `count` team blocks, edge to edge. */
export function compactBandWidth(count: number, columns: number) {
  return count * COMPACT_ROOM_WIDTH_M * columns + Math.max(0, count - 1) * COMPACT_TEAM_GAP_M;
}

/**
 * Sizes a compact campus (3–5 teams per half, up to 15 people per team). Every column count that keeps the civic row
 * wide enough is scored by how far the map is from square, and the most proportionate one wins.
 */
export function planCompactCampus(teamCount: number, peoplePerTeam: number): CompactCampusPlan | null {
  const slots = Math.ceil(teamCount / 2);
  if (slots < MIN_SLOTS || slots > MAX_SLOTS || peoplePerTeam > COMPACT_MAX_PEOPLE_PER_TEAM || peoplePerTeam < 1) return null;
  let best: { plan: CompactCampusPlan; score: number } | null = null;
  for (const columns of COLUMN_CHOICES) {
    const rows = Math.ceil(peoplePerTeam / columns);
    const blockDepthM = rows * (COMPACT_ROOM_DEPTH_M + ALLEY_M) - ALLEY_M;
    const edgeRoadZ = COMPACT_TEAM_ROAD_Z_M + 4 + blockDepthM + 4;
    const width = compactBandWidth(slots, columns) + 2 * ALLEY_M + 2 * RING_AND_VERGE_M;
    const depth = 2 * (edgeRoadZ + MEETING_RING_STACK_M);
    if (width < MIN_WIDTH_M) continue;
    const score = Math.abs(Math.log(width / depth));
    if (!best || score < best.score - 1e-9) {
      best = { score, plan: { slots, columns, rows, slotWidthM: COMPACT_ROOM_WIDTH_M * columns + COMPACT_TEAM_GAP_M, blockDepthM, edgeRoadZ, width, depth } };
    }
  }
  return best?.plan ?? null;
}

const LOBBY_W_M = 24;
const RESTROOM_W_M = 20;
const TOWNHALL_W_M = 42;
const ROW_GAP_M = 4;
const ROW_END_GAP_M = 2;
const PARK_SHARE = 0.44;

export interface CompactCivicRow {
  lobbyX: number;
  restroomWestX: number;
  townHallX: number;
  restroomEastX: number;
  park: { x: number; width: number };
  field: { x: number; width: number };
}

/** West to east between the side streets: Lobby, park lot, Restroom, Town Hall, Restroom, football field lot. */
export function compactCivicRow(mapWidth: number): CompactCivicRow {
  const interior = mapWidth - 2 * RING_AND_VERGE_M;
  const lots = interior - (LOBBY_W_M + 2 * RESTROOM_W_M + TOWNHALL_W_M) - 5 * ROW_GAP_M - 2 * ROW_END_GAP_M - 1;
  const parkWidth = Math.round(lots * PARK_SHARE);
  const fieldWidth = lots - parkWidth;
  let cursor = -interior / 2 + ROW_END_GAP_M;
  const take = (width: number) => { const centre = cursor + width / 2; cursor += width + ROW_GAP_M; return centre; };
  const lobbyX = take(LOBBY_W_M);
  const parkX = take(parkWidth);
  const restroomWestX = take(RESTROOM_W_M);
  const townHallX = take(TOWNHALL_W_M);
  const restroomEastX = take(RESTROOM_W_M);
  const fieldX = take(fieldWidth);
  return { lobbyX, restroomWestX, townHallX, restroomEastX, park: { x: parkX, width: parkWidth }, field: { x: fieldX, width: fieldWidth } };
}

/** Park and football-field lots of a saved compact campus, read back from its rooms (null for other layouts). */
export function compactCivicLots(layout: Pick<RoomLayout, "zones">): { park: { x: number; width: number }; field: { x: number; width: number } } | null {
  const zone = (id: string) => layout.zones.find((item) => item.id === id);
  const lobby = zone("shared-lobby");
  const west = zone("shared-restroom-west");
  const east = zone("shared-restroom-east");
  if (!lobby || !west || !east || !zone("shared-townhall") || zone("shared-cafeteria")) return null;
  const parkLeft = lobby.x + lobby.width / 2 + ROW_GAP_M;
  const parkRight = west.x - west.width / 2 - ROW_GAP_M;
  const fieldLeft = east.x + east.width / 2 + ROW_GAP_M;
  // The row is centred: the field ends 1 m short of the east side street, mirroring the Lobby's 2 m on the west.
  const fieldRight = -(lobby.x - lobby.width / 2) + ROW_END_GAP_M - 1;
  if (parkRight - parkLeft < 20 || fieldRight - fieldLeft < 20) return null;
  return {
    park: { x: (parkLeft + parkRight) / 2, width: parkRight - parkLeft },
    field: { x: (fieldLeft + fieldRight) / 2, width: fieldRight - fieldLeft },
  };
}
