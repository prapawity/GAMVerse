import * as THREE from "three";

/** Applies one normalized GLB animation sample for a transparent pet sprite frame. */
export function samplePetAnimationFrame(
  mixer: THREE.AnimationMixer,
  actions: Map<THREE.AnimationClip, THREE.AnimationAction>,
  clip: THREE.AnimationClip | undefined,
  normalizedTime: number,
): void {
  if (!clip) {
    mixer.stopAllAction();
    return;
  }
  mixer.stopAllAction();
  let action = actions.get(clip);
  if (!action) {
    action = mixer.clipAction(clip);
    actions.set(clip, action);
  }
  action.reset().play();
  action.time = clip.duration * THREE.MathUtils.clamp(normalizedTime, 0, 0.999999);
  mixer.update(0);
}
