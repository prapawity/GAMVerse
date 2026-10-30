import assert from "node:assert/strict";
import test from "node:test";
import { campusRoomStyle } from "./campusRoomStyles.js";
import { generateCampusMap } from "./campusMapGenerator.js";

const INPUTS = [
  { totalPeople: 10, peoplePerTeam: 5, teamCount: 2, seed: 2 },
  { totalPeople: 150, peoplePerTeam: 15, teamCount: 10, seed: 3 },
];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

test("every room the campus generator creates has a style", () => {
  for (const input of INPUTS) {
    for (const zone of generateCampusMap(input).layout.zones) {
      const style = campusRoomStyle(zone);
      assert.ok(style, `${zone.id} has no style`);
      assert.match(style.wallColor, HEX_COLOR);
      assert.match(style.roofColor, HEX_COLOR);
      assert.ok(Number.isInteger(style.floorColor) && style.floorColor >= 0 && style.floorColor <= 0xffffff);
    }
  }
});

test("walls, roof and floor of a room share one colour, the floor being the lighter tint", () => {
  const { layout } = generateCampusMap(INPUTS[1]!);
  const channels = (rgb: number) => [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  for (const zone of layout.zones) {
    const style = campusRoomStyle(zone)!;
    assert.equal(style.roofColor, style.wallColor, `${zone.id} roof matches its walls`);
    const wall = channels(Number.parseInt(style.wallColor.slice(1), 16));
    const floor = channels(style.floorColor);
    wall.forEach((value, index) => assert.ok(floor[index]! >= value, `${zone.id} floor is never darker than its walls`));
  }
});

test("generated walls use their room style instead of a cycling palette", () => {
  for (const { layout } of INPUTS.map(generateCampusMap)) {
    for (const zone of layout.zones) {
      const walls = layout.walls.filter(wall => wall.id.startsWith(`${zone.id}-wall-`));
      assert.ok(walls.length > 0, `${zone.id} has walls`);
      for (const wall of walls) assert.equal(wall.color, campusRoomStyle(zone)!.wallColor, wall.id);
    }
  }
});

test("every desk room gets its own colour so room boundaries show", () => {
  const { layout } = generateCampusMap({ totalPeople: 150, peoplePerTeam: 15, teamCount: 10, seed: 3 });
  const studios = layout.zones.filter(zone => zone.kind === "private");
  assert.ok(studios.length > 20);
  const floors = studios.map(zone => campusRoomStyle(zone)!.floorColor);
  // Neighbours matter most: rooms of one team sit together, and consecutive rooms must read as different.
  const team = (zone: { id: string }) => zone.id.split("-")[1];
  for (const id of new Set(studios.map(team))) {
    const own = studios.filter(zone => team(zone) === id).map(zone => campusRoomStyle(zone)!.floorColor);
    assert.equal(new Set(own).size, own.length, `team ${id} rooms are all different`);
  }
  for (let index = 1; index < floors.length; index += 1) assert.notEqual(floors[index], floors[index - 1], "consecutive rooms differ");
  assert.ok(new Set(floors).size / floors.length > 0.9, "colours are widely spread across the campus");
  const byId = new Map(studios.map(zone => [zone.id, campusRoomStyle(zone)!.floorColor]));
  for (const zone of studios) assert.equal(campusRoomStyle({ ...zone })!.floorColor, byId.get(zone.id), "stable per room");
});

test("meeting and shared rooms keep one look per room type", () => {
  assert.equal(campusRoomStyle({ id: "meeting-north-1", kind: "meeting" })!.floorColor, campusRoomStyle({ id: "meeting-south-4", kind: "meeting" })!.floorColor);
  assert.notEqual(campusRoomStyle({ id: "shared-townhall", kind: "meeting" })!.floorColor, campusRoomStyle({ id: "shared-lobby", kind: "meeting" })!.floorColor);
});

test("rooms drawn in the editor keep their own colour", () => {
  assert.equal(campusRoomStyle({ id: "custom-room-1", kind: "meeting" }), null);
  assert.equal(campusRoomStyle({ id: "meeting-9", kind: "meeting" }), null);
});
