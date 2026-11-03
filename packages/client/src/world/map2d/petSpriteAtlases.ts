import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { loadGltfAsset } from "../../assets/loaders";
import { petModelUrl } from "../../assets/characterAssets";
import { webglFailedInThisTab } from "../webglFailureSession";
import { AVATAR_SPRITE_DIRECTION_COUNT, AVATAR_SPRITE_FULL_CIRCLE_RAD } from "./avatarSpriteGeometry";
import {
  PET_SPRITE_ATLAS_HEIGHT_PX, PET_SPRITE_ATLAS_WIDTH_PX, PET_SPRITE_DIRECTION_COUNT,
  PET_SPRITE_POSE_COUNT, PET_SPRITE_TILE_SIZE_PX, PET_SPRITE_WALK_FRAME_COUNT, petSpriteWalkRootPose,
} from "./petSpriteGeometry";
import { samplePetAnimationFrame } from "./petSpriteAnimation";
import { createPetFallbackAtlas } from "./petSpriteFallback";
import { queuePortraitSnapshot, waitForPortraitSnapshotIdle } from "./portraitSnapshotQueue";

const MAX_PET_SPRITE_CACHE_ENTRIES = 64;
const MAX_PET_SPRITE_ATTEMPTS = 256;
const PET_MODEL_LONGEST_DIMENSION_M = 1.1;
const PET_SNAPSHOT_FRAME_SIZE_M = 1.5;
const PET_SNAPSHOT_CAMERA_NEAR_M = 0.01;
const PET_SNAPSHOT_CAMERA_FAR_M = 40;
const PET_SNAPSHOT_CAMERA_DISTANCE_M = 4;
const PET_SNAPSHOT_CAMERA_ELEVATION_M = 0.48;
const PET_SNAPSHOT_CAMERA_DIRECTION = { x: 0.16, y: 0.28, z: 1 };
const PET_SPRITE_IDLE_SAMPLE_RATIO = 0.2;
function disposeModelResources(model: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

/** Lazily renders full GLB pet sprites for the 2D map, matching avatar direction frames. */
export class PetSpriteAtlases {
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private readonly pending = new Set<string>();
  private readonly fallbackPending = new Set<string>();
  private readonly fallbackAttempted = new Set<string>();
  private readonly attempted = new Set<string>();
  private active = new Set<string>();
  private disposed = false;
  revision = 0;

  setActivePets(ids: Iterable<string | undefined>): void {
    this.active = new Set(Array.from(ids).filter((id): id is string => Boolean(id)));
    for (const id of this.fallbackAttempted) {
      if (!this.active.has(id) && !this.fallbackPending.has(id)) this.fallbackAttempted.delete(id);
    }
  }

  constructor(
    private readonly enqueueSnapshot = queuePortraitSnapshot,
    private readonly createFallback = createPetFallbackAtlas,
    private readonly hasWebglFailure = webglFailedInThisTab,
  ) {}

  get(petId: string | undefined): HTMLCanvasElement | null {
    if (!petId || this.disposed) return null;
    const existing = this.sprites.get(petId);
    if (existing) return existing;
    if (this.hasWebglFailure()) {
      this.loadFallback(petId);
      return null;
    }
    if (this.attempted.has(petId)) {
      if (!this.pending.has(petId)) this.loadFallback(petId);
      return null;
    }
    if (this.attempted.size >= MAX_PET_SPRITE_ATTEMPTS) return null;
    if (this.sprites.size + this.pending.size + this.fallbackPending.size >= MAX_PET_SPRITE_CACHE_ENTRIES) {
      const stale = Array.from(this.sprites.keys()).find(id => !this.active.has(id));
      if (!stale) return null;
      this.sprites.delete(stale);
      this.attempted.delete(stale);
      this.fallbackAttempted.delete(stale);
    }
    this.attempted.add(petId);
    this.pending.add(petId);
    let gltf: Awaited<ReturnType<typeof loadGltfAsset>> | undefined;
    let resourcesDisposed = false;
    const disposeAsset = () => {
      if (resourcesDisposed || !gltf) return;
      resourcesDisposed = true;
      disposeModelResources(gltf.scene);
    };
    this.enqueueSnapshot({
      widthPx: PET_SPRITE_TILE_SIZE_PX,
      heightPx: PET_SPRITE_TILE_SIZE_PX,
      active: () => !this.disposed && this.active.has(petId),
      prepare: async () => { gltf = await loadGltfAsset(petModelUrl(petId)); },
      render: renderer => gltf ? this.render(gltf, renderer, () => !this.disposed && this.active.has(petId)) : null,
      cancel: disposeAsset,
      complete: portrait => {
        disposeAsset();
        this.pending.delete(petId);
        if (!portrait || this.disposed) {
          if (!this.disposed && !this.active.has(petId)) this.attempted.delete(petId);
          else if (!this.disposed) this.loadFallback(petId);
          return;
        }
        this.sprites.set(petId, portrait);
        this.revision += 1;
      },
    });
    return null;
  }

  private loadFallback(petId: string): void {
    if (this.disposed || this.sprites.has(petId) || this.fallbackPending.has(petId) || this.fallbackAttempted.has(petId)) return;
    if (this.sprites.size + this.pending.size + this.fallbackPending.size >= MAX_PET_SPRITE_CACHE_ENTRIES) {
      const stale = Array.from(this.sprites.keys()).find(id => !this.active.has(id));
      if (!stale) return;
      this.sprites.delete(stale);
      this.attempted.delete(stale);
      this.fallbackAttempted.delete(stale);
    }
    this.fallbackAttempted.add(petId);
    this.fallbackPending.add(petId);
    void this.createFallback(petId).then(sprite => {
      if (!sprite || this.disposed || !this.active.has(petId)) {
        if (!this.disposed && !this.active.has(petId)) this.fallbackAttempted.delete(petId);
        return;
      }
      this.sprites.set(petId, sprite);
      this.revision += 1;
    }).catch(() => {
      // Keep a failed active pet suppressed so map redraws cannot retry the
      // same missing/offline image continuously. Deactivation allows retry.
      if (!this.active.has(petId)) this.fallbackAttempted.delete(petId);
    }).finally(() => {
      this.fallbackPending.delete(petId);
    });
  }

  private async render(asset: GLTF, renderer: THREE.WebGLRenderer, active: () => boolean): Promise<HTMLCanvasElement | null> {
    // The queued GLTF parse is private to this portrait render. Render the
    // original skinned hierarchy so large-scale pets keep their bind data.
    const model = asset.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = PET_MODEL_LONGEST_DIMENSION_M / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    const directionRoot = new THREE.Group();
    directionRoot.add(model);
    const scene = new THREE.Scene();
    scene.add(directionRoot, new THREE.HemisphereLight(0xeaf8ff, 0x637887, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const camera = new THREE.OrthographicCamera(-PET_SNAPSHOT_FRAME_SIZE_M / 2, PET_SNAPSHOT_FRAME_SIZE_M / 2,
      PET_SNAPSHOT_FRAME_SIZE_M / 2, -PET_SNAPSHOT_FRAME_SIZE_M / 2, PET_SNAPSHOT_CAMERA_NEAR_M, PET_SNAPSHOT_CAMERA_FAR_M);
    const cameraDirection = new THREE.Vector3(PET_SNAPSHOT_CAMERA_DIRECTION.x, PET_SNAPSHOT_CAMERA_DIRECTION.y, PET_SNAPSHOT_CAMERA_DIRECTION.z).normalize();
    const cameraTarget = new THREE.Vector3(0, PET_SNAPSHOT_CAMERA_ELEVATION_M, 0);
    camera.position.copy(cameraDirection).multiplyScalar(PET_SNAPSHOT_CAMERA_DISTANCE_M).add(cameraTarget);
    camera.lookAt(cameraTarget);
    const canvas = document.createElement("canvas");
    canvas.width = PET_SPRITE_ATLAS_WIDTH_PX;
    canvas.height = PET_SPRITE_ATLAS_HEIGHT_PX;
    const ctx = canvas.getContext("2d");
    const findClip = (names: readonly string[]) => asset.animations.find(clip => names.includes(clip.name.toLowerCase()));
    const idleClip = findClip(["idle", "static"]);
    const walkClip = findClip(["walk", "run"]);
    const mixer = asset.animations.length ? new THREE.AnimationMixer(model) : null;
    const actions = new Map<THREE.AnimationClip, THREE.AnimationAction>();
    try {
      renderer.setClearColor(0x000000, 0);
      for (let direction = 0; direction < PET_SPRITE_DIRECTION_COUNT; direction += 1) {
        await waitForPortraitSnapshotIdle();
        if (!active()) return null;
        directionRoot.rotation.y = direction / AVATAR_SPRITE_DIRECTION_COUNT * AVATAR_SPRITE_FULL_CIRCLE_RAD;
        for (let pose = 0; pose < PET_SPRITE_POSE_COUNT; pose += 1) {
          const walking = pose > 0;
          const clip = walking ? walkClip : idleClip;
          const phaseIndex = walking ? pose - 1 : 0;
          const phase = walking ? phaseIndex / PET_SPRITE_WALK_FRAME_COUNT : PET_SPRITE_IDLE_SAMPLE_RATIO;
          if (mixer) samplePetAnimationFrame(mixer, actions, clip, phase);
          // Keep a readable body gait even when the GLB has no walk clip or its
          // small limb motion disappears at map scale. Animated clips still
          // provide the leg movement; this adds a restrained bounce and lean.
          const rootPose = walking ? petSpriteWalkRootPose(phaseIndex) : null;
          directionRoot.position.y = rootPose?.liftM ?? 0;
          directionRoot.rotation.z = rootPose?.leanRad ?? 0;
          directionRoot.scale.y = rootPose?.verticalScale ?? 1;
          renderer.render(scene, camera);
          ctx?.drawImage(renderer.domElement, pose * PET_SPRITE_TILE_SIZE_PX, direction * PET_SPRITE_TILE_SIZE_PX);
        }
      }
      return canvas;
    } finally {
      mixer?.stopAllAction();
      mixer?.uncacheRoot(model);
      scene.clear();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sprites.clear();
    this.pending.clear();
    this.fallbackPending.clear();
    this.fallbackAttempted.clear();
    this.attempted.clear();
    this.active.clear();
  }
}
