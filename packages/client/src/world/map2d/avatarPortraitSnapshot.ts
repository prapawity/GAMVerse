import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { loadCharacterAsset, type LoadedCharacterAsset } from "../../assets/characterAssets";
import { createProceduralHumanoidRig, updateProceduralHumanoidRig, type ProceduralHumanoidRig } from "../proceduralHumanoidMotion";
import { pickCharacterClips, shouldUseProceduralRig } from "../characterClips";
import { fitCharacterModel } from "../characterModelFit";
import { applyLyingCharacterPose } from "../lyingCharacterPose";
import { webglFailedInThisTab } from "../webglFailureSession";
import { PORTRAIT_POSES_PER_IDLE_SLICE, queuePortraitSnapshot, waitForPortraitSnapshotIdle, type PortraitSnapshotRequest } from "./portraitSnapshotQueue";
import {
  AVATAR_SPRITE_FRAME_HEIGHT_M, AVATAR_SPRITE_TARGET_HEIGHT_M, AVATAR_SPRITE_DIRECTION_COUNT, AVATAR_SPRITE_FULL_CIRCLE_RAD, AVATAR_SPRITE_POSE_COUNT,
  AVATAR_SPRITE_SEATED_POSE_INDEX, AVATAR_SPRITE_LYING_POSE_INDEX, AVATAR_SPRITE_TILE_HEIGHT_PX, AVATAR_SPRITE_TILE_WIDTH_PX,
  AVATAR_SPRITE_WALK_FRAME_COUNT, AVATAR_SPRITE_ANIMATED_POSE_COUNT, AVATAR_SPRITE_IDLE_FRAME_COUNT, setAvatarSpriteIdleCycle,
} from "./avatarSpriteGeometry";

const CAMERA_NEAR_M = 0.01;
const CAMERA_FAR_M = 100;
const CAMERA_DISTANCE_M = 4;
const CAMERA_ELEVATION_M = 1.4;
const PORTRAIT_LIGHT_PALETTE = { clear: 0x000000, sky: 0xeaf8ff, ground: 0x637887, key: 0xffffff };
const HEMISPHERE_INTENSITY = 1.35;
const KEY_LIGHT_INTENSITY = 1.9;
const KEY_LIGHT_POSITION_M = { x: 3.8, y: 5.5, z: 4.8 };
const SEATED_THIGH_ANGLE_RAD = -Math.PI / 2;
const SEATED_SHIN_ANGLE_RAD = Math.PI / 2;
const SEATED_ROOT_OFFSET_M = -0.25;
const SEATED_SAMPLE_DURATION_RATIO = 0.5;

type AvatarSnapshotRequest = {
  characterId: string;
  endpoint: string;
  active(): boolean;
  complete(portrait: HTMLCanvasElement | null): void;
};
function snapshotScene(model: THREE.Object3D): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(model, new THREE.HemisphereLight(PORTRAIT_LIGHT_PALETTE.sky, PORTRAIT_LIGHT_PALETTE.ground, HEMISPHERE_INTENSITY));
  const keyLight = new THREE.DirectionalLight(PORTRAIT_LIGHT_PALETTE.key, KEY_LIGHT_INTENSITY);
  keyLight.position.set(KEY_LIGHT_POSITION_M.x, KEY_LIGHT_POSITION_M.y, KEY_LIGHT_POSITION_M.z);
  scene.add(keyLight);
  return scene;
}
function snapshotCamera(): THREE.OrthographicCamera {
  const halfHeightM = AVATAR_SPRITE_FRAME_HEIGHT_M / 2;
  const halfWidthM = halfHeightM * AVATAR_SPRITE_TILE_WIDTH_PX / AVATAR_SPRITE_TILE_HEIGHT_PX;
  const camera = new THREE.OrthographicCamera(-halfWidthM, halfWidthM, halfHeightM, -halfHeightM, CAMERA_NEAR_M, CAMERA_FAR_M);
  camera.position.set(0, CAMERA_ELEVATION_M, CAMERA_DISTANCE_M);
  camera.lookAt(0, AVATAR_SPRITE_TARGET_HEIGHT_M, 0);
  return camera;
}
function poseSeatedRig(rig: ProceduralHumanoidRig): void {
  for (const thigh of [rig.leftLeg, rig.rightLeg]) {
    if (thigh) thigh.bone.quaternion.copy(thigh.rest).multiply(thigh.deltaA.setFromAxisAngle(thigh.axisA, SEATED_THIGH_ANGLE_RAD));
  }
  for (const shin of [rig.leftShin, rig.rightShin]) {
    if (shin) shin.bone.quaternion.copy(shin.rest).multiply(shin.deltaA.setFromAxisAngle(shin.axisA, SEATED_SHIN_ANGLE_RAD));
  }
}
function spritePose(model: THREE.Object3D, asset: LoadedCharacterAsset, characterId: string) {
  const clips = pickCharacterClips(asset.animations, characterId.startsWith("custom-"));
  const procedural = shouldUseProceduralRig(characterId, clips)
    ? createProceduralHumanoidRig(model, characterId.startsWith("custom-")) : null;
  const mixer = new THREE.AnimationMixer(model);
  const { idle, sit } = clips;
  const walk = clips.walk ?? clips.run;
  const idleDurationMs = characterId.startsWith("custom-") && !procedural && idle && idle.duration > 0
    ? idle.duration * 1000 : 0;
  const setPose = (poseIndex: number) => {
    const walking = poseIndex > 0 && poseIndex < AVATAR_SPRITE_SEATED_POSE_INDEX;
    const seated = poseIndex === AVATAR_SPRITE_SEATED_POSE_INDEX;
    const phaseRatio = walking ? (poseIndex - 1) / AVATAR_SPRITE_WALK_FRAME_COUNT : 0;
    if (procedural) {
      updateProceduralHumanoidRig(procedural, phaseRatio * AVATAR_SPRITE_FULL_CIRCLE_RAD, walking, false, false);
      if (seated) poseSeatedRig(procedural);
      return;
    }
    mixer.stopAllAction();
    const clip = seated ? sit ?? idle : walking ? walk ?? idle : idle;
    if (!clip) return;
    const action = mixer.clipAction(clip).reset().play();
    const idlePhaseRatio = poseIndex >= AVATAR_SPRITE_POSE_COUNT
      ? (poseIndex - AVATAR_SPRITE_POSE_COUNT + 1) / AVATAR_SPRITE_IDLE_FRAME_COUNT : 0;
    action.time = clip.duration * (seated ? SEATED_SAMPLE_DURATION_RATIO : walking ? phaseRatio : idlePhaseRatio);
    mixer.update(0);
  };
  return { setPose, idleDurationMs };
}
async function renderSprites(asset: LoadedCharacterAsset, request: Pick<AvatarSnapshotRequest, "characterId" | "active">,
  renderer: THREE.WebGLRenderer): Promise<HTMLCanvasElement | null> {
  const model = SkeletonUtils.clone(asset.scene);
  const root = new THREE.Group();
  const scene = snapshotScene(root);
  try {
    fitCharacterModel(model);
    root.add(model);
    const camera = snapshotCamera();
    const lyingCamera = snapshotCamera();
    lyingCamera.position.set(0, CAMERA_DISTANCE_M, 0);
    lyingCamera.up.set(0, 0, -1);
    lyingCamera.lookAt(0, 0, 0);
    const restPosition = model.position.clone();
    const restRotation = model.rotation.clone();
    const { setPose, idleDurationMs } = spritePose(model, asset, request.characterId);
    const poseCount = idleDurationMs > 0 ? AVATAR_SPRITE_ANIMATED_POSE_COUNT : AVATAR_SPRITE_POSE_COUNT;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SPRITE_TILE_WIDTH_PX * poseCount;
    canvas.height = AVATAR_SPRITE_TILE_HEIGHT_PX * AVATAR_SPRITE_DIRECTION_COUNT;
    if (idleDurationMs > 0) setAvatarSpriteIdleCycle(canvas, idleDurationMs);
    const ctx = canvas.getContext("2d");
    renderer.setClearColor(PORTRAIT_LIGHT_PALETTE.clear, 0);
    for (let direction = 0; direction < AVATAR_SPRITE_DIRECTION_COUNT; direction += 1) {
      root.rotation.y = direction / AVATAR_SPRITE_DIRECTION_COUNT * AVATAR_SPRITE_FULL_CIRCLE_RAD;
      for (let pose = 0; pose < poseCount; pose += 1) {
        if (pose % PORTRAIT_POSES_PER_IDLE_SLICE === 0) {
          await waitForPortraitSnapshotIdle();
          if (!request.active()) return null;
        }
        if (webglFailedInThisTab()) return null;
        setPose(pose);
        const lying = pose === AVATAR_SPRITE_LYING_POSE_INDEX;
        applyLyingCharacterPose(model, lying, restPosition, restRotation);
        if (!lying) model.position.y = restPosition.y;
        root.position.y = pose === AVATAR_SPRITE_SEATED_POSE_INDEX ? SEATED_ROOT_OFFSET_M : 0;
        renderer.render(scene, lying ? lyingCamera : camera);
        ctx?.drawImage(renderer.domElement, pose * AVATAR_SPRITE_TILE_WIDTH_PX, direction * AVATAR_SPRITE_TILE_HEIGHT_PX);
      }
    }
    return canvas;
  } finally {
    // SkeletonUtils clones skeletons; geometry/materials belong to the shared asset cache.
    model.traverse((object) => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose(); });
    scene.clear();
  }
}
export function queueAvatarSnapshot(request: AvatarSnapshotRequest): void {
  let asset: LoadedCharacterAsset | undefined;
  const snapshotRequest: PortraitSnapshotRequest = {
    widthPx: AVATAR_SPRITE_TILE_WIDTH_PX,
    heightPx: AVATAR_SPRITE_TILE_HEIGHT_PX,
    active: request.active,
    prepare: async () => { asset = await loadCharacterAsset(request.characterId, request.endpoint); },
    render: renderer => asset ? renderSprites(asset, request, renderer) : null,
    complete: request.complete,
  };
  queuePortraitSnapshot(snapshotRequest);
}
