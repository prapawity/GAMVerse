import assert from "node:assert/strict";
import test from "node:test";
import { Object3D } from "three";
import type { RoomLayoutZone } from "@gammyverse/shared";
import { PropModelVisibility, propVisibilityFocus, type DeferredPropModel } from "./propModelVisibility";
import { RoadsideSceneryVisibility } from "./roadsideScenery";
const room: RoomLayoutZone = { id: "room", name: "Room", kind: "meeting", x: 0, z: 0, width: 10, depth: 10, color: "#fff" };
function pending(id: string, x: number): DeferredPropModel {
  return { propId: id, position: { x, z: 100 }, started: false, start() { this.started = true; } };
}
test("covered room props neither load nor render and open immediately on entry", () => {
  const controller = new PropModelVisibility();
  const indoors = pending("in", 100);
  const outdoors = pending("out", 110);
  const visual = new Object3D();
  visual.position.set(100, 0, 100);
  const roadside = new RoadsideSceneryVisibility([]);
  const offset = { x: 100, z: 100 };
  controller.update(0, false, undefined, offset, roadside, [indoors, outdoors], [visual], [room], offset);
  assert.equal(indoors.started, false);
  assert.equal(outdoors.started, true);
  assert.equal(visual.visible, false);
  controller.update(1, false, undefined, offset, roadside, [indoors], [visual], [], offset);
  assert.equal(indoors.started, true);
  assert.equal(visual.visible, true);
});
test("editing loads and renders around the camera focus while distant props remain culled", () => {
  const controller = new PropModelVisibility();
  const near = pending("near", 1000);
  const far = pending("far", 100);
  const visual = (id: string, x: number) => {
    const object = new Object3D();
    object.position.set(x, 0, 100);
    object.userData.officeMapPropId = id;
    return object;
  };
  const nearVisual = visual("near", 1000);
  const farVisual = visual("far", 100);
  const roadside = new RoadsideSceneryVisibility([
    { id: "near", x: 900, z: 0, width: 1, depth: 1, rotation: 0 },
    { id: "far", x: 0, z: 0, width: 1, depth: 1, rotation: 0 },
  ]);
  const offset = { x: 100, z: 100 };
  const stationaryPlayer = { x: 0, z: 0, rotation: Math.PI };
  controller.update(0, true, stationaryPlayer, propVisibilityFocus({ x: 1000, z: 200 }, { x: 1000, z: 100 }), roadside, [near, far], [nearVisual, farVisual], [], offset);
  assert.equal(near.started, true);
  assert.equal(nearVisual.visible, true);
  assert.equal(far.started, false);
  assert.equal(farVisual.visible, false);
  controller.update(100, true, stationaryPlayer, propVisibilityFocus({ x: 100, z: 200 }, offset), roadside, [near, far], [nearVisual, farVisual], [], offset);
  assert.equal(far.started, true);
  assert.equal(farVisual.visible, true);
  assert.equal(nearVisual.visible, false);
});
