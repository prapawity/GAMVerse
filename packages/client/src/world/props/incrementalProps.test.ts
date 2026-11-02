import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_PROP_CATALOG, type RoomLayout, type RoomLayoutProp } from "@gammyverse/shared";
import { diffProps, isIncrementalProp, sceneStructureLayout, sceneStructureSignature } from "./incrementalProps";

const SIGN = ROOM_PROP_CATALOG.find((item) => item.asset === "office-wayfinding-sign")!;
const VEHICLE = ROOM_PROP_CATALOG.find((item) => item.vehicleId)!;
const TREE = ROOM_PROP_CATALOG.find((item) => /tree/i.test(item.asset) && !item.geometry && !item.vehicleId && !item.interaction && !item.supportsPlacement)!;
const prop = (id: string, asset: string, x = 0, z = 0): RoomLayoutProp => ({ id, asset, x, z, width: 1, depth: 1, rotation: 0, collision: false });
const layout = (props: RoomLayoutProp[], extra: Partial<RoomLayout> = {}): RoomLayout => ({ version: 1, props, zones: [], walls: [], doors: [], ...extra });

test("ordinary props are incremental; vehicles, instanced scenery and unknown assets are not", () => {
  assert.equal(isIncrementalProp(prop("a", SIGN.asset), false), true);
  assert.equal(isIncrementalProp(prop("v", VEHICLE.asset), false), false);
  assert.equal(isIncrementalProp(prop("t", TREE.asset), false), false);
  assert.equal(isIncrementalProp(prop("x", "does-not-exist"), false), false);
});

test("moving, adding or removing an incremental prop keeps the scene structure signature", () => {
  const base = layout([prop("a", SIGN.asset, 0, 0), prop("v", VEHICLE.asset, 5, 5)]);
  const edited = layout([prop("a", SIGN.asset, 9, 9), prop("b", SIGN.asset, 1, 1), prop("v", VEHICLE.asset, 5, 5)]);
  assert.equal(sceneStructureSignature(base), sceneStructureSignature(edited));
  const vehicleMoved = layout([prop("a", SIGN.asset), prop("v", VEHICLE.asset, 6, 5)]);
  assert.notEqual(sceneStructureSignature(base), sceneStructureSignature(vehicleMoved), "a vehicle edit still rebuilds");
  const zoneAdded = layout(base.props, { zones: [{ id: "z", kind: "meeting", name: "Z", x: 0, z: 0, width: 2, depth: 2, color: "#fff" }] });
  assert.notEqual(sceneStructureSignature(base), sceneStructureSignature(zoneAdded), "structure edits still rebuild");
  assert.deepEqual(sceneStructureLayout(base).props.map((p) => p.id), ["v"]);
});

test("diffProps reports added, removed and changed ids", () => {
  const a = prop("a", SIGN.asset), b = prop("b", SIGN.asset, 1, 1), c = prop("c", SIGN.asset, 2, 2);
  const diff = diffProps([a, b], [{ ...a }, { ...b, x: 5 }, c]);
  assert.deepEqual(diff.added.map((p) => p.id), ["c"]);
  assert.deepEqual(diff.changed.map((p) => p.id), ["b"]);
  assert.deepEqual(diff.removed, []);
  assert.deepEqual(diffProps([a, b], [a]).removed, ["b"]);
  assert.deepEqual(diffProps([a], [a]), { added: [], removed: [], changed: [] });
});
