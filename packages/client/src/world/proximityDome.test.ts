import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createProximityDome, createProximityDomeSet, PROXIMITY_DOME_OPACITY, PROXIMITY_DOME_OTHER_OPACITY } from "./proximityDome";

test("the dome fits the shape it is given and stays translucent", () => {
  const dome = createProximityDome();
  dome.update(true, { x: 4, z: -6, radius: 12 });
  assert.equal(dome.group.visible, true);
  assert.deepEqual([dome.group.position.x, dome.group.position.y, dome.group.position.z], [4, 0, -6]);
  assert.equal(dome.group.scale.x, 12);
  assert.ok(PROXIMITY_DOME_OPACITY >= 0.3 && PROXIMITY_DOME_OPACITY <= 0.4);
  dome.update(false, null);
  assert.equal(dome.group.visible, false);
  dome.dispose();
});

test("the set keeps one dome per group, lighter for other people's, and releases dissolved groups", () => {
  const parent = new THREE.Group();
  const set = createProximityDomeSet(parent);
  set.update([
    { key: "a", shape: { x: 0, z: 0, radius: 6 }, own: true },
    { key: "b", shape: { x: 30, z: 0, radius: 5 }, own: false },
  ], { x: 100, z: 50 });
  assert.equal(parent.children.length, 2);
  const [own, other] = parent.children as THREE.Group[];
  assert.deepEqual([own!.position.x, own!.position.z], [100, 50]);
  assert.equal(((own!.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity, PROXIMITY_DOME_OPACITY);
  assert.equal(((other!.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity, PROXIMITY_DOME_OTHER_OPACITY);
  set.update([{ key: "a", shape: { x: 0, z: 0, radius: 6 }, own: true }], { x: 0, z: 0 });
  assert.equal(parent.children.length, 1);
  set.dispose();
  assert.equal(parent.children.length, 0);
});
