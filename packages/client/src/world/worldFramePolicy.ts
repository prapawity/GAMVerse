import type { CameraMode } from "./camera/cameraState";

export type WorldFramePolicy = {
  /** Network snapshots, local intent, camera state and 2D presentation stay live in both views. */
  updateSharedState: true;
  showMap2d: boolean;
  update3dAssets: boolean;
  update3dAnimation: boolean;
  update3dPresentation: boolean;
  update3dOverlays: boolean;
  renderThreeScene: boolean;
  resumed3d: boolean;
  animationDeltaScale: 0 | 1;
};

export function worldFramePolicy(mode: CameraMode, previousMode: CameraMode): WorldFramePolicy {
  const showMap2d = mode === "map2d";
  const update3d = !showMap2d;
  const resumed3d = previousMode === "map2d" && update3d;
  return {
    updateSharedState: true,
    showMap2d,
    update3dAssets: update3d,
    update3dAnimation: update3d,
    update3dPresentation: update3d,
    update3dOverlays: update3d,
    renderThreeScene: update3d,
    resumed3d,
    animationDeltaScale: resumed3d ? 0 : 1,
  };
}

export interface WorldAnimationMixer {
  update(deltaSeconds: number): unknown;
}

/** Advance a visible 3D mixer only; the first 3D frame after 2D reconciles without catch-up. */
export function updateWorldAnimationMixer(policy: WorldFramePolicy, mixer: WorldAnimationMixer, deltaSeconds: number): boolean {
  if (!policy.update3dAnimation) return false;
  mixer.update(deltaSeconds * policy.animationDeltaScale);
  return true;
}

export function advanceWorldAnimationPhase(policy: WorldFramePolicy, phase: number, deltaSeconds: number, ratePerSecond: number): number {
  if (!policy.update3dAnimation) return phase;
  return phase + deltaSeconds * policy.animationDeltaScale * ratePerSecond;
}
