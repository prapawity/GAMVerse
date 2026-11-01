import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { fitCharacterModel, characterModelFitTransform, CHARACTER_MAX_HEIGHT_M, CHARACTER_MAX_WIDTH_M, CHARACTER_MAX_DEPTH_M } from "./characterModelFit";
import { applyLyingCharacterPose } from "./lyingCharacterPose";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

for (const [name, dimensions] of [["tall", [1, 10, 1]], ["wide", [10, 1, 1]], ["deep", [1, 1, 10]]] as const) {
  test(`${name} characters fit the shared envelope without changing proportions`, () => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(...dimensions)));
    fitCharacterModel(model);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x <= CHARACTER_MAX_WIDTH_M + 1e-8);
    assert.ok(size.y <= CHARACTER_MAX_HEIGHT_M + 1e-8);
    assert.ok(size.z <= CHARACTER_MAX_DEPTH_M + 1e-8);
    close(size.x / dimensions[0], size.y / dimensions[1]);
    close(size.z / dimensions[2], size.y / dimensions[1]);
    const limitingScale = Math.min(CHARACTER_MAX_WIDTH_M / dimensions[0], CHARACTER_MAX_HEIGHT_M / dimensions[1], CHARACTER_MAX_DEPTH_M / dimensions[2]);
    close(size.y, dimensions[1] * limitingScale);
    close(model.userData.characterHeightM, size.y);
    close(bounds.min.y, 0);
    close(bounds.min.x + bounds.max.x, 0);
    close(bounds.min.z + bounds.max.z, 0);
  });
}

test("fit preserves transformed root scale ratios and source geometry", () => {
  const template = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
  mesh.position.set(1, 2, -1);
  template.add(mesh);
  template.position.set(8, -7, 3);
  template.rotation.set(0.2, 0.4, 0.1);
  template.scale.set(2, 3, 4);
  const sourceVertices = Array.from(mesh.geometry.attributes.position.array);
  const model = template.clone(true);
  const initialSize = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
  fitCharacterModel(model);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const fittedSize = bounds.getSize(new THREE.Vector3());
  close(fittedSize.x / initialSize.x, fittedSize.y / initialSize.y);
  close(fittedSize.z / initialSize.z, fittedSize.y / initialSize.y);
  close(model.scale.x / model.scale.y, 2 / 3);
  close(model.scale.z / model.scale.y, 4 / 3);
  close(bounds.min.y, 0);
  close(bounds.min.x + bounds.max.x, 0);
  close(bounds.min.z + bounds.max.z, 0);
  assert.deepEqual(template.position.toArray(), [8, -7, 3]);
  assert.deepEqual(template.scale.toArray(), [2, 3, 4]);
  assert.deepEqual(Array.from(mesh.geometry.attributes.position.array), sourceVertices);
});

test("invalid or empty geometry fails before changing model transforms", () => {
  const model = new THREE.Group();
  model.position.set(1, 2, 3);
  model.scale.set(2, 3, 4);
  assert.throws(() => fitCharacterModel(model));
  assert.deepEqual(model.position.toArray(), [1, 2, 3]);
  assert.deepEqual(model.scale.toArray(), [2, 3, 4]);
  for (const bounds of [
    { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 1 } },
    { min: { x: 0, y: 0, z: 0 }, max: { x: Infinity, y: 1, z: 1 } },
    { min: { x: NaN, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    { min: { x: 2, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
  ]) assert.equal(characterModelFitTransform(bounds), null);
});

test("skinned clones fit current bone transforms even when the mesh precedes its bones", () => {
  const template = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  const count = geometry.attributes.position.count;
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) weights[index * 4] = 1;
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  const bone = new THREE.Bone();
  template.add(mesh, bone);
  template.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([bone]));
  bone.position.y = 0.5;
  template.position.set(8, 4, -2);
  template.scale.set(3, 2, 4);
  const model = SkeletonUtils.clone(template);
  fitCharacterModel(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  close(size.x, CHARACTER_MAX_WIDTH_M * 3 / 4);
  close(size.y, CHARACTER_MAX_DEPTH_M);
  close(size.z, CHARACTER_MAX_DEPTH_M);
  close(bounds.min.y, 0);
  close(bounds.min.x + bounds.max.x, 0);
  close(bounds.min.z + bounds.max.z, 0);
  assert.deepEqual(template.position.toArray(), [8, 4, -2]);
  assert.deepEqual(template.scale.toArray(), [3, 2, 4]);
  assert.notEqual((model.children[0] as THREE.SkinnedMesh).skeleton, mesh.skeleton);
});

test("lying centers tall and width-limited characters using their actual fitted height", () => {
  for (const dimensions of [[1, 10, 1], [10, 1, 1]]) {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(...dimensions)));
    fitCharacterModel(model);
    const standing = model.position.clone();
    applyLyingCharacterPose(model, true, standing);
    close(model.position.z - standing.z, model.userData.characterHeightM / 2);
    applyLyingCharacterPose(model, false, standing);
    close(model.position.z, standing.z);
    close(model.position.y, standing.y);
  }
});
