import type { RoomLayoutZone } from "./roomLayout.js";

/** Floor, wall and roof colours of one generated campus room type. */
export type CampusRoomStyle = { floorColor: number; wallColor: string; roofColor: string };

// Generated private rooms use one soft colour across the floor, walls and roof.
const STUDIO_PASTEL_SATURATION_MIN = 0.22;
const STUDIO_PASTEL_SATURATION_SPAN = 0.12;
const STUDIO_PASTEL_LIGHTNESS_MIN = 0.82;
const STUDIO_PASTEL_LIGHTNESS_SPAN = 0.08;
const SHARED_FLOOR_LIFT_TOWARD_WHITE = 0.45;
const BYTE_MAX = 255;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const BLUE_MASK = 255;

const toHex = (rgb: number) => `#${rgb.toString(16).padStart(6, "0")}`;
function liftTowardWhite(rgb: number, amount: number): number {
  const lift = (channel: number) => Math.round(channel + (BYTE_MAX - channel) * amount);
  return (lift((rgb >> RED_SHIFT) & BLUE_MASK) << RED_SHIFT) | (lift((rgb >> GREEN_SHIFT) & BLUE_MASK) << GREEN_SHIFT) | lift(rgb & BLUE_MASK);
}
const sharedRoomStyleFromBase = (base: number): CampusRoomStyle => ({ floorColor: liftTowardWhite(base, SHARED_FLOOR_LIFT_TOWARD_WHITE), wallColor: toHex(base), roofColor: toHex(base) });
const studioStyleFromBase = (base: number): CampusRoomStyle => ({ floorColor: base, wallColor: toHex(base), roofColor: toHex(base) });

const FULL_TURN_DEG = 360;

function roomStyleSeed(teamNumber: number, officeNumber: number): number {
  const identity = `${teamNumber}-${officeNumber}`;
  let seed = 2166136261;
  for (const character of identity) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function hslToRgbNumber(hueDeg: number, saturation: number, lightness: number): number {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (hueDeg % FULL_TURN_DEG) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] = [[chroma, second, 0], [second, chroma, 0], [0, chroma, second], [0, second, chroma], [second, 0, chroma], [chroma, 0, second]][Math.floor(sector) % 6]!;
  const offset = lightness - chroma / 2;
  const channel = (value: number) => Math.round((value + offset) * BYTE_MAX);
  return (channel(r) << RED_SHIFT) | (channel(g) << GREEN_SHIFT) | channel(b);
}

function privateStudioStyle(teamNumber: number, officeNumber: number): CampusRoomStyle {
  const seed = roomStyleSeed(teamNumber, officeNumber);
  const hue = seed % FULL_TURN_DEG;
  const saturation = STUDIO_PASTEL_SATURATION_MIN + ((seed >>> 9) % 100) / 100 * STUDIO_PASTEL_SATURATION_SPAN;
  const lightness = STUDIO_PASTEL_LIGHTNESS_MIN + ((seed >>> 17) % 100) / 100 * STUDIO_PASTEL_LIGHTNESS_SPAN;
  return studioStyleFromBase(hslToRgbNumber(hue, saturation, lightness));
}

// Meeting and shared rooms are formal: one shared look per room type.
const STYLES = {
  teamMeeting: sharedRoomStyleFromBase(0xb4bccb),
  meeting: sharedRoomStyleFromBase(0xaeb2ba),
  townhall: sharedRoomStyleFromBase(0xbfb2d6),
  lobby: sharedRoomStyleFromBase(0xdccdb2),
  cafeteria: sharedRoomStyleFromBase(0xe0b99c),
  lounge: sharedRoomStyleFromBase(0xbccfaa),
  restroom: sharedRoomStyleFromBase(0xa6d2d0),
} as const satisfies Record<string, CampusRoomStyle>;

/**
 * Style for a room made by the campus generator, told apart by zone id.
 * Rooms the owner drew in the editor have no generated id and return null, so they keep their own colour.
 */
export function campusRoomStyle(zone: Pick<RoomLayoutZone, "id" | "kind">): CampusRoomStyle | null {
  const studio = /^team-(\d+)-office-(\d+)/.exec(zone.id);
  if (studio) return privateStudioStyle(Number(studio[1]), Number(studio[2]));
  if (/^meeting-(north|south|east|west)-\d+$/.test(zone.id)) return STYLES.teamMeeting;
  if (/^meeting-(small|large)-/.test(zone.id)) return STYLES.meeting;
  if (zone.id === "shared-townhall") return STYLES.townhall;
  if (zone.id === "shared-lobby") return STYLES.lobby;
  if (zone.id === "shared-cafeteria") return STYLES.cafeteria;
  if (zone.id === "shared-lounge") return STYLES.lounge;
  if (zone.id.startsWith("shared-restroom-")) return STYLES.restroom;
  return null;
}
