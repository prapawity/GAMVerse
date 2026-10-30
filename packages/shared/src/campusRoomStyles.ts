import type { RoomLayoutZone } from "./roomLayout.js";

/** Floor, wall and roof colours of one generated campus room type. */
export type CampusRoomStyle = { floorColor: number; wallColor: string; roofColor: string };

// Each room has one base colour: its walls and roof use it as is (so the roof matches the walls seen from the
// side) and its floor is the same colour lifted toward white (so the room still reads as one hue).
const FLOOR_LIFT_TOWARD_WHITE = 0.45;
const BYTE_MAX = 255;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const BLUE_MASK = 255;

function liftToward(rgb: number, amount: number): number {
  const lift = (channel: number) => Math.round(channel + (BYTE_MAX - channel) * amount);
  return (lift((rgb >> RED_SHIFT) & BLUE_MASK) << RED_SHIFT) | (lift((rgb >> GREEN_SHIFT) & BLUE_MASK) << GREEN_SHIFT) | lift(rgb & BLUE_MASK);
}
const toHex = (rgb: number) => `#${rgb.toString(16).padStart(6, "0")}`;
const styleFromBase = (base: number): CampusRoomStyle => ({ floorColor: liftToward(base, FLOOR_LIFT_TOWARD_WHITE), wallColor: toHex(base), roofColor: toHex(base) });

// Each desk room gets its own hue so neighbouring rooms read as separate spaces. Hues step by the
// golden angle, which keeps consecutive rooms far apart on the colour wheel.
const GOLDEN_ANGLE_DEG = 137.508;
const FULL_TURN_DEG = 360;
const TEAM_ORDINAL_STRIDE = 37;
// Teams also step through three lightness levels, which keeps far-apart rooms from landing on the same colour.
const STUDIO_BASE_SATURATION = 0.45;
const STUDIO_BASE_LIGHTNESS_LEVELS = [0.72, 0.77, 0.82] as const;

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
  const hue = (teamNumber * TEAM_ORDINAL_STRIDE + officeNumber) * GOLDEN_ANGLE_DEG;
  return styleFromBase(hslToRgbNumber(hue, STUDIO_BASE_SATURATION, STUDIO_BASE_LIGHTNESS_LEVELS[teamNumber % STUDIO_BASE_LIGHTNESS_LEVELS.length]!));
}

// Meeting and shared rooms are formal: one shared look per room type.
const STYLES = {
  teamMeeting: styleFromBase(0xb4bccb),
  meeting: styleFromBase(0xaeb2ba),
  townhall: styleFromBase(0xbfb2d6),
  lobby: styleFromBase(0xdccdb2),
  cafeteria: styleFromBase(0xe0b99c),
  lounge: styleFromBase(0xbccfaa),
  restroom: styleFromBase(0xa6d2d0),
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
