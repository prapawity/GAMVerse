import assert from "node:assert/strict";
import test from "node:test";
import type { RoomLayoutZone } from "@gammyverse/shared";
import { civicRoomFloorColor, mapZoneFloorColor } from "./zoneFloorColor";
import { zoneRoofColor } from "./zoneVisibility";

const zone = (id: string, kind: RoomLayoutZone["kind"] = "meeting"): RoomLayoutZone => ({ id, name: id, kind, x: 0, z: 0, width: 8, depth: 8, color: "#ff0000" });

test("generated rooms get an opaque style floor and the 2D map shows the same colour", () => {
  const studio = zone("team-1-office-1", "private");
  assert.notEqual(civicRoomFloorColor(studio), null);
  assert.equal(mapZoneFloorColor(studio, true), `#${civicRoomFloorColor(studio)!.toString(16).padStart(6, "0")}`);
});

test("editor-drawn rooms keep the tinted zone colour and wall-colour roof", () => {
  const custom = zone("custom-room-1");
  assert.equal(civicRoomFloorColor(custom), null);
  assert.equal(zoneRoofColor(custom, [{ id: "w", axis: "horizontal", x: 0, z: 0, length: 4, thickness: 0.2, height: 2.5, color: "#123456" }]), "#123456");
});

test("generated rooms take their roof colour from the style table", () => {
  assert.notEqual(zoneRoofColor(zone("shared-townhall"), []), "#63bbd0");
});
