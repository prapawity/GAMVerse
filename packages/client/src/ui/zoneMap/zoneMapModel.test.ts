import assert from "node:assert/strict";
import test from "node:test";
import type { RoomLayoutZone } from "@gammyverse/shared";
import { buildZoneMapRegions, locateInZoneMap, zoneMapLocationLabel, zoneMapViewBox } from "./zoneMapModel";

const zone = (id: string, name: string, kind: RoomLayoutZone["kind"], x: number, z: number, size = 8): RoomLayoutZone => ({ id, name, kind, x, z, width: size, depth: size, color: "#fff" });
const ZONES = [
  zone("a", "T1 Office 01", "private", -90, -60),
  zone("b", "T1 Office 02", "private", -82, -60),
  zone("c", "T2 Office 01", "private", 40, -60),
  zone("th", "Town Hall", "meeting", 0, 0, 42),
  zone("m", "Meeting 3", "meeting", 0, 90, 20),
  zone("cafe", "Cafeteria", "meeting", 50, 0, 20),
  zone("wc", "Restroom", "restroom", 112, 90, 10),
];

test("team desks collapse into one team region with seats", () => {
  const regions = buildZoneMapRegions(ZONES);
  const team = regions.find((r) => r.id === "team-1")!;
  assert.equal(team.category, "team");
  assert.equal(team.label, "Team 1");
  assert.equal(team.seats.length, 2);
  assert.equal(regions.filter((r) => r.category === "team").length, 2);
});

test("shared rooms are categorised", () => {
  const byId = Object.fromEntries(buildZoneMapRegions(ZONES).map((r) => [r.id, r.category]));
  assert.deepEqual([byId.th, byId.m, byId.cafe, byId.wc], ["townhall", "meeting", "common", "restroom"]);
});

test("locate returns the room, seat and an outdoor null", () => {
  const regions = buildZoneMapRegions(ZONES);
  assert.equal(zoneMapLocationLabel(locateInZoneMap(regions, { x: -82, z: -60 })), "Team 1 · T1 Office 02");
  assert.equal(zoneMapLocationLabel(locateInZoneMap(regions, { x: 0, z: 5 })), "Town Hall");
  assert.equal(zoneMapLocationLabel(locateInZoneMap(regions, { x: 70, z: 70 })), "Outside");
});

test("view box prefers layout dimensions", () => {
  assert.deepEqual(zoneMapViewBox({ dimensions: { width: 100, depth: 60 } }, { width: 1, depth: 1 }), { minX: -50, minZ: -30, width: 100, depth: 60 });
  assert.equal(zoneMapViewBox(null, { width: 10, depth: 10 }).width, 10);
});
