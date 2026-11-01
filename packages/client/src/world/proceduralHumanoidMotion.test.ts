import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createProceduralHumanoidRig, updateProceduralHumanoidRig } from "./proceduralHumanoidMotion";

function humanoid(armDrop = 0, rotatedAxes = false) {
  const root = new THREE.Group();
  let index = 0;
  const bone = (parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const value = new THREE.Bone();
    value.name = `node${index++}`;
    parent.add(value);
    value.position.set(x, y, z);
    return value;
  };
  const hips = bone(root, 0, 1);
  const chest = bone(hips, 0, 0.5);
  bone(chest, 0, 0.4);
  const arms = [1, -1].map(side => {
    const arm = bone(chest, side * 0.2, 0);
    const forearm = bone(arm, side * 0.3, -armDrop);
    const hand = bone(forearm, side * 0.3, -armDrop);
    if (rotatedAxes) {
      arm.rotation.y = Math.PI / 2;
      forearm.position.applyQuaternion(arm.quaternion.clone().invert());
      forearm.quaternion.copy(arm.quaternion).invert();
    }
    return { arm, forearm, hand };
  });
  for (const side of [1, -1]) {
    const thigh = bone(hips, side * 0.12, -0.05);
    const shin = bone(thigh, 0, -0.45);
    bone(shin, 0, -0.45);
  }
  return { root, arms };
}

test("unknown bone names infer humanoid limbs and lower T-pose arms", () => {
  const { root, arms } = humanoid();
  const rig = createProceduralHumanoidRig(root);
  assert.ok(rig);
  assert.equal(rig.leftArm?.bone, arms[0].arm);
  assert.equal(rig.rightArm?.bone, arms[1].arm);
  assert.ok(rig.leftLeg && rig.rightLeg && rig.leftShin && rig.rightShin);
  updateProceduralHumanoidRig(rig, 0, false, false, false);
  root.updateMatrixWorld(true);
  for (const { arm, forearm } of arms) {
    assert.ok(forearm.getWorldPosition(new THREE.Vector3()).y < arm.getWorldPosition(new THREE.Vector3()).y - 0.2);
  }
});

test("A-pose and rotated local bone axes lower arms without cumulative drift", () => {
  const { root, arms } = humanoid(0.18, true);
  root.scale.setScalar(2.5);
  root.rotation.y = 1.1;
  const rig = createProceduralHumanoidRig(root);
  assert.ok(rig);
  updateProceduralHumanoidRig(rig, 1, true, false, true);
  const moving = arms[0].arm.quaternion.clone();
  assert.ok(rig.leftLeg!.bone.quaternion.angleTo(new THREE.Quaternion()) > 0.1);
  for (let index = 0; index < 20; index++) updateProceduralHumanoidRig(rig, 1, true, false, true);
  assert.ok(moving.angleTo(arms[0].arm.quaternion) < 1e-7);
  updateProceduralHumanoidRig(rig, 0, false, false, false);
  root.updateMatrixWorld(true);
  for (const { arm, forearm } of arms) {
    assert.ok(forearm.getWorldPosition(new THREE.Vector3()).y < arm.getWorldPosition(new THREE.Vector3()).y - 0.6);
  }
});

test("partial named rigs still infer unnamed lower limbs", () => {
  const { root, arms } = humanoid();
  arms[0].arm.name = "LeftArm";
  arms[1].arm.name = "RightArm";
  const rig = createProceduralHumanoidRig(root);
  assert.ok(rig?.leftLeg && rig.rightLeg && rig.leftForearm && rig.rightForearm);
});

test("uploaded rigs calibrate named bones with arbitrary local axes", () => {
  const { root, arms } = humanoid(0, true);
  for (const [index, side] of ["Left", "Right"].entries()) {
    arms[index].arm.name = `${side}Arm`;
    arms[index].forearm.name = `${side}ForeArm`;
  }
  const hips = root.children[0];
  for (const [index, side] of ["Left", "Right"].entries()) {
    const leg = hips.children[index + 1];
    leg.name = `${side}UpLeg`;
    leg.children[0].name = `${side}Leg`;
  }
  const rig = createProceduralHumanoidRig(root, true);
  assert.ok(rig);
  updateProceduralHumanoidRig(rig, 0, false, false, false);
  root.updateMatrixWorld(true);
  for (const { arm, forearm } of arms) {
    assert.ok(forearm.getWorldPosition(new THREE.Vector3()).y < arm.getWorldPosition(new THREE.Vector3()).y - 0.2);
  }
});

test("ambiguous extra arm pairs and disconnected skeletons are rejected", () => {
  const { root, arms } = humanoid();
  for (const { arm } of arms) {
    const clone = arm.clone();
    clone.position.y -= 0.01;
    arm.parent!.add(clone);
  }
  assert.equal(createProceduralHumanoidRig(root), null);

  const branched = humanoid();
  for (const { arm, forearm } of branched.arms) arm.add(forearm.clone());
  assert.equal(createProceduralHumanoidRig(branched.root), null);

  const disconnected = humanoid();
  for (const { arm } of disconnected.arms) disconnected.root.attach(arm);
  assert.equal(createProceduralHumanoidRig(disconnected.root), null);
});

test("geometry fallback requires actual bones and a complete paired humanoid", () => {
  assert.equal(createProceduralHumanoidRig(new THREE.Group()), null);
  const { root, arms } = humanoid();
  arms[1].arm.removeFromParent();
  assert.equal(createProceduralHumanoidRig(root), null);
  const fake = new THREE.Group();
  for (let index = 0; index < 20; index++) {
    const meshNode = new THREE.Object3D();
    meshNode.position.set(index % 2, index / 10, 0);
    fake.add(meshNode);
  }
  assert.equal(createProceduralHumanoidRig(fake), null);
});
