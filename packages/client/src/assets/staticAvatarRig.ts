import * as THREE from "three";
import { inferAvatarFeet, type AvatarFoot } from "./avatarFootDetection";
import { inferAvatarArms, type AvatarArm } from "./avatarArmDetection";

const MAX_RIG_VERTICES = 400_000;
const MAX_DETECTION_SAMPLES = 16_000;
const WALK_DURATION_S = 0.9;
const IDLE_DURATION_S = 2.4;
const CLIP_SAMPLES = 17;
const FULL_TURN_RAD = 2 * Math.PI;
const SWING_AXIS = new THREE.Vector3(1, 0, 0);

function tracks(name: string, durationS: number, sample: (phase: number) => number[], rotation = false) {
  const times = Array.from({ length: CLIP_SAMPLES }, (_, index) => durationS * index / (CLIP_SAMPLES - 1));
  const values = times.flatMap(time => sample(time / durationS * FULL_TURN_RAD));
  return rotation ? new THREE.QuaternionKeyframeTrack(name, times, values) : new THREE.VectorKeyframeTrack(name, times, values);
}

function addSkinAttributes(geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4,
  normalize: (point: THREE.Vector3) => THREE.Vector3, feet: readonly AvatarFoot[], hipHeight: number, arms: readonly AvatarArm[]) {
  const positions = geometry.attributes.position;
  const indices = new Uint16Array(positions.count * 4);
  const weights = new Float32Array(positions.count * 4);
  const point = new THREE.Vector3();
  const armSegments = arms.map(arm => {
    const axis = new THREE.Vector3().copy(arm.hand).sub(arm.shoulder);
    return { ...arm, axis, lengthSquared: axis.lengthSq() };
  });
  const shoulderOffset = new THREE.Vector3();
  const footSpacing = Math.min(...feet.flatMap((foot, index) => feet.slice(index + 1)
    .map(other => Math.hypot(foot.x - other.x, foot.z - other.z))));
  for (let index = 0; index < positions.count; index++) {
    normalize(point.fromBufferAttribute(positions, index).applyMatrix4(worldMatrix));
    let nearest = 0;
    let distance = Infinity;
    for (const [footIndex, foot] of feet.entries()) {
      const candidate = Math.hypot(point.x - foot.x, point.z - foot.z);
      if (candidate < distance) { distance = candidate; nearest = footIndex; }
    }
    const heightWeight = 1 - THREE.MathUtils.smoothstep(point.y, hipHeight * 0.28, hipHeight);
    const sideWeight = 1 - THREE.MathUtils.smoothstep(distance, footSpacing * 0.38, footSpacing * 0.9);
    let weight = heightWeight * sideWeight;
    for (const [armIndex, arm] of armSegments.entries()) {
      if (point.y < 0.37 || point.y > 0.81) continue;
      shoulderOffset.copy(point).sub(arm.shoulder);
      const progress = THREE.MathUtils.clamp(shoulderOffset.dot(arm.axis) / arm.lengthSquared, 0, 1);
      const armDistance = shoulderOffset.addScaledVector(arm.axis, -progress).length();
      const lateral = (point.x - arm.centerX) * arm.side;
      const inner = (arm.shoulder.x - arm.centerX) * arm.side;
      const armWeight = THREE.MathUtils.smoothstep(lateral, inner * 0.70, inner * 1.1) *
        THREE.MathUtils.smoothstep(progress, 0, 0.32) *
        THREE.MathUtils.smoothstep(point.y, 0.37, 0.44) *
        (1 - THREE.MathUtils.smoothstep(point.y, 0.76, 0.81)) *
        (1 - THREE.MathUtils.smoothstep(armDistance, arm.radius * 0.55, arm.radius));
      if (armWeight > weight) {
        nearest = feet.length + armIndex;
        weight = armWeight;
      }
    }
    indices[index * 4 + 1] = nearest + 1;
    weights[index * 4] = 1 - weight;
    weights[index * 4 + 1] = weight;
  }
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
}

/** Rig a private static scene in memory. Authored skins and animations take precedence. */
export function prepareStaticAvatarRig(source: THREE.Group): { scene: THREE.Group; animations: THREE.AnimationClip[] } | null {
  const meshes: THREE.Mesh[] = [];
  let vertices = 0;
  let unsupported = false;
  source.traverse(object => {
    if (object instanceof THREE.Bone || object instanceof THREE.SkinnedMesh || object instanceof THREE.InstancedMesh ||
        object instanceof THREE.Line || object instanceof THREE.Points) unsupported = true;
    if (!(object instanceof THREE.Mesh) || !object.geometry.attributes.position) return;
    if (object.morphTargetInfluences?.length) unsupported = true;
    meshes.push(object);
    vertices += object.geometry.attributes.position.count;
  });
  if (unsupported || !meshes.length || vertices > MAX_RIG_VERTICES) return null;
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.y <= 0 || !Number.isFinite(size.lengthSq())) return null;
  const origin = bounds.getCenter(new THREE.Vector3()).setY(bounds.min.y);
  const normalize = (point: THREE.Vector3) => point.sub(origin).divideScalar(size.y);
  const samples: THREE.Vector3[] = [];
  const stride = Math.max(1, Math.ceil(vertices / MAX_DETECTION_SAMPLES));
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += stride) {
      samples.push(normalize(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld)));
    }
  }
  const feet = inferAvatarFeet(samples, size.x / size.y, size.z / size.y);
  if (!feet) return null;
  const arms = feet.length === 2 ? inferAvatarArms(samples, size.x / size.y) : [];

  const scene = new THREE.Group();
  const body = new THREE.Bone();
  body.name = "AutoRigBody";
  body.position.copy(origin);
  scene.add(body);
  const hipHeight = feet.length === 4 ? 0.35 : size.z / size.y > 0.6 ? 0.23 : 0.4;
  const legs = feet.map((foot, index) => {
    const leg = new THREE.Bone();
    leg.name = "AutoRigLeg" + index;
    leg.position.set(foot.x * size.y, hipHeight * size.y, foot.z * size.y);
    body.add(leg);
    return leg;
  });
  const shoulders = arms.map((arm, index) => {
    const bone = new THREE.Bone();
    bone.name = "AutoRigArm" + index;
    bone.position.copy(arm.shoulder).multiplyScalar(size.y);
    body.add(bone);
    return bone;
  });
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([body, ...legs, ...shoulders]);
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone();
    addSkinAttributes(geometry, mesh.matrixWorld, normalize, feet, hipHeight, arms);
    const skinned = new THREE.SkinnedMesh(geometry, mesh.material);
    skinned.matrix.copy(mesh.matrixWorld);
    skinned.matrixAutoUpdate = false;
    scene.add(skinned);
    skinned.updateMatrixWorld(true);
    skinned.bind(skeleton);
  }

  const idle = new THREE.AnimationClip("Idle", IDLE_DURATION_S, [
    tracks(`${body.name}.scale`, IDLE_DURATION_S, phase => [1, 1 + (1 - Math.cos(phase)) * 0.008, 1]),
  ]);
  const walk = new THREE.AnimationClip("Walk", WALK_DURATION_S, feet.flatMap((foot, index) => {
    const leg = legs[index];
    return [
      tracks(`${leg.name}.quaternion`, WALK_DURATION_S, phase =>
        new THREE.Quaternion().setFromAxisAngle(SWING_AXIS, Math.cos(phase + foot.phase) * 0.28).toArray(), true),
      tracks(`${leg.name}.position`, WALK_DURATION_S, phase =>
        [leg.position.x, leg.position.y + size.y * 0.035 * Math.max(0, Math.sin(phase + foot.phase)), leg.position.z]),
    ];
  }));
  const feetBySide = [...feet].sort((left, right) => left.x - right.x);
  for (const [index, shoulder] of shoulders.entries()) {
    const swingPhase = feetBySide[index].phase + Math.PI;
    walk.tracks.push(tracks(`${shoulder.name}.quaternion`, WALK_DURATION_S, phase =>
      new THREE.Quaternion().setFromAxisAngle(SWING_AXIS, Math.cos(phase + swingPhase) * 0.28).toArray(), true));
  }
  return { scene, animations: [idle, walk] };
}
