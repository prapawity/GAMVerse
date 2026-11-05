import { Euler, Quaternion, Vector3 } from "three";
import type { AvatarAnimationState } from "./avatarModelVisual";
import { AVATAR_DANCE_DURATION_S, sampleAvatarDance } from "./avatarDance";
import { poseProceduralHumanoidDance } from "./proceduralHumanoidMotion";

const FALLBACK_HALF_HEIGHT_M = 0.775;
const pivot = new Vector3();
const rotation = new Quaternion();
const angles = new Euler(0, 0, 0, "YXZ");

export function restoreAvatarDance(animation: AvatarAnimationState, dancing: boolean): void {
  const model = animation.danceModel ?? animation.model;
  const pose = animation.danceRestore;
  if (pose) {
    model.position.copy(pose.position);
    model.quaternion.copy(pose.rotation);
  }
  if (!dancing) {
    animation.danceElapsedS = undefined;
    animation.danceRestore = undefined;
  }
}

export function applyAvatarDance(animation: AvatarAnimationState, deltaS: number): void {
  const model = animation.danceModel ?? animation.model;
  const halfHeightM = typeof model.userData.characterHeightM !== "number"
    ? FALLBACK_HALF_HEIGHT_M : model.userData.characterHeightM / 2;
  const elapsedS = animation.danceElapsedS ?? 0;
  const pose = sampleAvatarDance(elapsedS, halfHeightM);
  animation.danceElapsedS = (elapsedS + deltaS) % AVATAR_DANCE_DURATION_S;
  const restore = animation.danceRestore ??= { position: new Vector3(), rotation: new Quaternion() };
  restore.position.copy(model.position);
  restore.rotation.copy(model.quaternion);

  if (animation.proceduralRig) poseProceduralHumanoidDance(animation.proceduralRig, pose);
  rotation.setFromEuler(angles.set(pose.pitchRad, pose.yawRad, pose.rollRad));
  pivot.set(0, halfHeightM, 0);
  model.position.sub(pivot).applyQuaternion(rotation).add(pivot);
  model.position.y += pose.liftM + halfHeightM * (1 - Math.abs(Math.cos(pose.pitchRad) * Math.cos(pose.rollRad)));
  model.quaternion.premultiply(rotation);
}
