import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { samplePetAnimationFrame } from "./petSpriteAnimation";

test("GLB walk clip sampling produces different transforms for different sprite frames", () => {
  const model = new THREE.Group();
  const mixer = new THREE.AnimationMixer(model);
  const clip = new THREE.AnimationClip("walk", 1, [
    new THREE.VectorKeyframeTrack(".position", [0, 1], [0, 0, 0, 0, 2, 0]),
  ]);
  const actions = new Map<THREE.AnimationClip, THREE.AnimationAction>();

  samplePetAnimationFrame(mixer, actions, clip, 0);
  const firstFrameY = model.position.y;
  samplePetAnimationFrame(mixer, actions, clip, 0.5);
  const nextFrameY = model.position.y;

  assert.equal(firstFrameY, 0);
  assert.ok(nextFrameY > firstFrameY);
  assert.ok(Math.abs(nextFrameY - 1) < 1e-6);
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
});

test("a missing pet pose clip restores the model bind pose after sampling another clip", () => {
  const model = new THREE.Group();
  model.position.y = 2;
  const mixer = new THREE.AnimationMixer(model);
  const clip = new THREE.AnimationClip("walk", 1, [
    new THREE.VectorKeyframeTrack(".position", [0, 1], [0, 2, 0, 0, 6, 0]),
  ]);
  const actions = new Map<THREE.AnimationClip, THREE.AnimationAction>();

  samplePetAnimationFrame(mixer, actions, clip, 0.5);
  assert.equal(model.position.y, 4);
  samplePetAnimationFrame(mixer, actions, undefined, 0);
  assert.equal(model.position.y, 2);
  mixer.uncacheRoot(model);
});
