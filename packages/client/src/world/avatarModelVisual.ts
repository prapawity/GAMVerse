import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import type { LoadedCharacterAsset } from "../assets/characterAssets";
import { pickCharacterClips, shouldUseProceduralRig } from "./characterClips";
import { fitCharacterModel } from "./characterModelFit";
import { createProceduralHumanoidRig, type ProceduralHumanoidRig } from "./proceduralHumanoidMotion";
import { avatarPoseBlend } from "./map2d/avatarPoseSmoother";

export interface AvatarAnimationState {
  model: THREE.Group;
  lyingModel?: THREE.Group;
  proceduralMotion: boolean;
  rotationOffset: number;
  phase: number;
  mixer?: THREE.AnimationMixer;
  idleAction?: THREE.AnimationAction;
  walkAction?: THREE.AnimationAction;
  runAction?: THREE.AnimationAction;
  sitAction?: THREE.AnimationAction;
  danceAction?: THREE.AnimationAction;
  currentAction?: THREE.AnimationAction;
  danceBasePosition?: THREE.Vector3;
  danceBaseRotation?: THREE.Euler;
  proceduralDanceActive?: boolean;
  proceduralRig?: ProceduralHumanoidRig;
}

export function shouldLoadAvatarModel(showMap2d: boolean, loaded: boolean, pending: boolean, failed: boolean): boolean {
  return !showMap2d && !loaded && !pending && !failed;
}

/** Allocate a main-scene avatar root only when the 3D presentation needs it. */
export function shouldCreateAvatarRoot(update3dAssets: boolean, hasAvatar: boolean): boolean {
  return update3dAssets && !hasAvatar;
}

/** Keep hidden-avatar motion/audio bookkeeping current while its 3D root is deferred. */
export function advanceDeferredAvatarPosition(current: { x: number; z: number }, target: { x: number; z: number }, deltaS: number, local: boolean): boolean {
  const distance = Math.hypot(target.x - current.x, target.z - current.z);
  if (distance <= 0.008) {
    current.x = target.x;
    current.z = target.z;
    return false;
  }
  const blend = avatarPoseBlend(deltaS, local);
  current.x += (target.x - current.x) * blend;
  current.z += (target.z - current.z) * blend;
  return true;
}

export function jumpHasExpired(startedAtMs: number, nowMs: number, durationMs: number): boolean {
  return nowMs - startedAtMs >= durationMs;
}

/** Build a private avatar instance after the 3D view needs it. */
export function createAvatarModelVisual(asset: LoadedCharacterAsset, characterId: string): {
  model: THREE.Group;
  animation: AvatarAnimationState;
} {
  const model = SkeletonUtils.clone(asset.scene) as THREE.Group;
  let mixer: THREE.AnimationMixer | undefined;
  try {
    fitCharacterModel(model);
    model.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      // Avatar mesh resources belong to the shared parsed asset cache.
      child.userData.sharedKenneyAvatarResources = true;
    });

    const clips = pickCharacterClips(asset.animations, characterId.startsWith("custom-"));
    const proceduralRig = shouldUseProceduralRig(characterId, clips)
      ? createProceduralHumanoidRig(model, characterId.startsWith("custom-")) ?? undefined
      : undefined;
    mixer = proceduralRig ? undefined : new THREE.AnimationMixer(model);
    const chairSitClip = clips.sit?.clone();
    chairSitClip?.tracks.forEach(track => {
      if (!/^(?:root|armature|mixamorig:)?root\.position$/i.test(track.name)) return;
      const values = track.values as Float32Array;
      for (let index = 1; index < values.length; index += 3) values[index] = 0;
    });
    const idleAction = clips.idle ? mixer?.clipAction(clips.idle) : undefined;
    const walkAction = clips.walk ? mixer?.clipAction(clips.walk) : undefined;
    const runAction = clips.run ? mixer?.clipAction(clips.run) : undefined;
    const sitAction = chairSitClip ? mixer?.clipAction(chairSitClip) : undefined;
    const danceAction = clips.dance ? mixer?.clipAction(clips.dance) : undefined;
    const currentAction = idleAction ?? walkAction;
    currentAction?.play();
    return {
      model,
      animation: {
        model,
        proceduralMotion: false,
        rotationOffset: 0,
        phase: 0,
        proceduralRig,
        mixer,
        idleAction,
        walkAction,
        runAction,
        sitAction,
        danceAction,
        currentAction,
        danceBasePosition: model.position.clone(),
        danceBaseRotation: model.rotation.clone(),
      },
    };
  } catch (error) {
    mixer?.stopAllAction();
    mixer?.uncacheRoot(model);
    model.traverse(child => { if (child instanceof THREE.SkinnedMesh) child.skeleton.dispose(); });
    throw error;
  }
}
