import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { advanceWorldAnimationPhase, updateWorldAnimationMixer, worldFramePolicy } from "./worldFramePolicy";

test("2D keeps shared work live while hidden 3D animation pauses and resumes without catch-up", () => {
  const model = new THREE.Group();
  const mixer = new THREE.AnimationMixer(model);
  const clip = new THREE.AnimationClip("idle", 2, [
    new THREE.VectorKeyframeTrack(".position", [0, 2], [0, 0, 0, 0, 2, 0]),
  ]);
  mixer.clipAction(clip).play();

  const map2d = worldFramePolicy("map2d", "tpp");
  assert.equal(map2d.updateSharedState, true);
  assert.equal(map2d.update3dAnimation, false);
  assert.equal(updateWorldAnimationMixer(map2d, mixer, 0.05), false);
  assert.equal(advanceWorldAnimationPhase(map2d, 3, 0.05, 8), 3);
  assert.equal(mixer.time, 0);

  const resumed = worldFramePolicy("tpp", "map2d");
  assert.equal(resumed.resumed3d, true);
  assert.equal(updateWorldAnimationMixer(resumed, mixer, 0.05), true);
  assert.equal(advanceWorldAnimationPhase(resumed, 3, 0.05, 8), 3);
  assert.equal(mixer.time, 0);

  const steady3d = worldFramePolicy("tpp", "tpp");
  updateWorldAnimationMixer(steady3d, mixer, 0.016);
  assert.equal(mixer.time, 0.016);
  assert.equal(advanceWorldAnimationPhase(steady3d, 3, 0.016, 8), 3.128);
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
});

test("the frame policy gates all view-only work while preserving shared snapshots", () => {
  const map2d = worldFramePolicy("map2d", "map2d");
  assert.deepEqual({
    shared: map2d.updateSharedState,
    assets: map2d.update3dAssets,
    presentation: map2d.update3dPresentation,
    overlays: map2d.update3dOverlays,
    render: map2d.renderThreeScene,
  }, { shared: true, assets: false, presentation: false, overlays: false, render: false });
  const threeD = worldFramePolicy("free", "map2d");
  assert.equal(threeD.updateSharedState, true);
  assert.equal(threeD.update3dAssets, true);
  assert.equal(threeD.update3dPresentation, true);
  assert.equal(threeD.update3dOverlays, true);
  assert.equal(threeD.renderThreeScene, true);
});
