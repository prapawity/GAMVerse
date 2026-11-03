import type { RoomPropDefinition } from "@gammyverse/shared";
import * as THREE from "three";
import { loadGltfAsset, loadRoomPropAsset } from "../../assets/loaders";
import { roomPropAssetPaths } from "../../assets/roomPropPaths";
import { vehicleModelUrl } from "../../assets/vehicleAssets";
import { createOfficePropGeometry } from "../officePropGeometry";
import { fitPropModelToFootprint, normalizePropModel } from "../props/propModelFit";
import { PROP_TOPDOWN_ASSETS } from "./propTopdownAssets";

const MODEL_PREVIEW_CACHE = "gammyverse-map2d-props-v4-oblique-soft-shadow";
const MODEL_PREVIEW_EDGE_PX = 256;
const MODEL_PREVIEW_PADDING = 1.02;
const CAMERA_DEPTH_PROJECTION = 0.78;
const CAMERA_HEIGHT_PROJECTION = 0.62;
const SPRITE_LIFT_RATIO = 0.72;
const GROUND_SHADOW_X_RATIO = 0.025;
const GROUND_SHADOW_CENTER_Y_RATIO = 0.66;
const GROUND_SHADOW_WIDTH_RATIO = 0.31;
const GROUND_SHADOW_DEPTH_RATIO = 0.18;
const MAP2D_PREVIEW_DB = "gammyverse-map2d-preview-cache";
const MAP2D_PREVIEW_DB_VERSION = 1;
const MAP2D_PREVIEW_STORE = "models";
const MODEL_PREVIEW_MEMORY_BUDGET_BYTES = 32 * 1024 * 1024;
const AMBIENT_LIGHT_INTENSITY = 2.1;
const KEY_LIGHT_INTENSITY = 2.4;

type ModelImage = HTMLCanvasElement;
type QueuedProp = RoomPropDefinition;

/**
 * Renders an asset's actual 3D model into a transparent, shallow-angle map
 * sprite. Models are rendered on idle time and cached in IndexedDB so map
 * redraws and later visits never do 3D work during the zoom gesture.
 */
class Map2dPropModelImages {
  private readonly images = new Map<string, ModelImage>();
  private readonly activeAssets = new Set<string>();
  private imageBytes = 0;
  private readonly pending = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly queue: QueuedProp[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  private database: Promise<IDBDatabase | null> | null = null;
  private scheduled = false;
  revision = 0;

  get(definition: RoomPropDefinition | undefined): ModelImage | null {
    if (!definition || PROP_TOPDOWN_ASSETS.has(definition.asset)) return null;
    this.activeAssets.add(definition.asset);
    const cached = this.images.get(definition.asset);
    if (cached) {
      this.images.delete(definition.asset);
      this.images.set(definition.asset, cached);
      return cached;
    }
    if (this.pending.has(definition.asset) || this.failed.has(definition.asset)) return null;
    this.pending.add(definition.asset);
    void this.loadOrQueue(definition);
    return null;
  }

  /** Keep sprites used by this view resident for the full frame so LRU eviction cannot cause fallback flicker. */
  beginFrame(): void {
    this.activeAssets.clear();
  }

  private async loadOrQueue(definition: QueuedProp): Promise<void> {
    try {
      const blob = await this.readStored(definition.asset);
      if (blob) {
        const bitmap = await createImageBitmap(blob);
        const canvas = this.createCanvas(bitmap.width, bitmap.height);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
        this.cacheImage(definition.asset, canvas);
        this.pending.delete(definition.asset);
        if (this.images.has(definition.asset)) this.revision += 1;
        return;
      }
      this.queue.push(definition);
      this.scheduleNext();
    } catch {
      this.queue.push(definition);
      this.scheduleNext();
    }
  }

  private scheduleNext(): void {
    if (this.scheduled || !this.queue.length) return;
    this.scheduled = true;
    const render = () => {
      this.scheduled = false;
      void this.renderNext();
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(render, { timeout: 900 });
    else window.setTimeout(render, 60);
  }

  private async renderNext(): Promise<void> {
    const definition = this.queue.shift();
    if (!definition) return;
    try {
      const model = await this.loadModel(definition);
      const image = model ? this.renderModel(definition, model) : null;
      if (!image) throw new Error(`No renderable model for ${definition.asset}`);
      const cached = this.cacheImage(definition.asset, image);
      this.pending.delete(definition.asset);
      if (cached) {
        this.revision += 1;
        void this.writeStored(definition.asset, image);
      }
    } catch {
      this.pending.delete(definition.asset);
      this.failed.add(definition.asset);
    } finally {
      this.scheduleNext();
    }
  }

  private cacheImage(asset: string, image: ModelImage): boolean {
    const bytes = image.width * image.height * 4;
    if (bytes > MODEL_PREVIEW_MEMORY_BUDGET_BYTES) {
      this.failed.add(asset);
      return false;
    }
    const previous = this.images.get(asset);
    if (previous) {
      this.images.delete(asset);
      this.imageBytes -= previous.width * previous.height * 4;
    }
    while (this.imageBytes + bytes > MODEL_PREVIEW_MEMORY_BUDGET_BYTES) {
      const oldest = Array.from(this.images.entries()).find(([asset]) => !this.activeAssets.has(asset));
      // Keep the resident sprites stable throughout a draw frame. If every
      // cached sprite is active, leave the new asset on its vector fallback
      // instead of exceeding the memory budget and evicting a visible sprite.
      if (!oldest) {
        this.failed.add(asset);
        return false;
      }
      this.images.delete(oldest[0]);
      this.imageBytes -= oldest[1].width * oldest[1].height * 4;
    }
    this.images.set(asset, image);
    this.imageBytes += bytes;
    return true;
  }

  private async loadModel(definition: RoomPropDefinition): Promise<THREE.Object3D | null> {
    if (definition.geometry) return createOfficePropGeometry(definition.geometry);
    if (definition.vehicleId) {
      const gltf = await loadGltfAsset(vehicleModelUrl(definition.vehicleId));
      return gltf.scene.clone(true);
    }
    return loadRoomPropAsset(roomPropAssetPaths(definition));
  }

  private renderModel(definition: RoomPropDefinition, model: THREE.Object3D): ModelImage | null {
    normalizePropModel(model, definition.height);
    fitPropModelToFootprint(model, definition.width, definition.depth);
    const longestFootprintEdge = Math.max(definition.width, definition.depth);
    const width = Math.max(1, Math.round(MODEL_PREVIEW_EDGE_PX * definition.width / longestFootprintEdge));
    const visibleHeight = definition.depth * CAMERA_DEPTH_PROJECTION + definition.height * CAMERA_HEIGHT_PROJECTION;
    const pixelsPerMeter = MODEL_PREVIEW_EDGE_PX / longestFootprintEdge;
    const height = Math.max(1, Math.round(visibleHeight * pixelsPerMeter));
    const canvas = this.createCanvas(width, height);
    const renderer = this.getRenderer();
    if (!renderer) return null;
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const maxDimension = Math.max(definition.width, definition.depth);
    const cameraDistance = Math.max(12, definition.height + maxDimension * 2);
    const cameraViewHeight = visibleHeight * MODEL_PREVIEW_PADDING;
    const camera = new THREE.OrthographicCamera(
      -definition.width * MODEL_PREVIEW_PADDING / 2,
      definition.width * MODEL_PREVIEW_PADDING / 2,
      cameraViewHeight / 2,
      -cameraViewHeight / 2,
      0.01,
      Math.max(100, cameraDistance * 2 + definition.height + 5),
    );
    camera.position.set(0, cameraDistance * 0.78, cameraDistance * 0.62);
    camera.lookAt(0, definition.height * 0.34, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x78827f, AMBIENT_LIGHT_INTENSITY));
    const key = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
    key.position.set(-3, 8, -4);
    scene.add(key);
    scene.add(model);
    renderer.render(scene, camera);
    const context = canvas.getContext("2d");
    if (!context) return null;
    this.drawGroundShadow(context, canvas, definition);
    context.drawImage(renderer.domElement, 0, 0, width, height);
    scene.remove(model);
    return canvas;
  }

  private drawGroundShadow(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, definition: RoomPropDefinition): void {
    const targetHeight = definition.depth + definition.height * SPRITE_LIFT_RATIO;
    const targetCenterY = definition.depth * GROUND_SHADOW_CENTER_Y_RATIO + definition.height * SPRITE_LIFT_RATIO;
    const centerX = canvas.width * (0.5 + GROUND_SHADOW_X_RATIO);
    const centerY = canvas.height * targetCenterY / targetHeight;
    const radiusX = canvas.width * GROUND_SHADOW_WIDTH_RATIO;
    const radiusY = canvas.height * definition.depth * GROUND_SHADOW_DEPTH_RATIO / targetHeight;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(radiusX, radiusY);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadow.addColorStop(0, "rgba(35, 33, 58, 0.12)");
    shadow.addColorStop(0.58, "rgba(35, 33, 58, 0.055)");
    shadow.addColorStop(1, "rgba(35, 33, 58, 0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private getRenderer(): THREE.WebGLRenderer | null {
    if (this.renderer) return this.renderer;
    try {
      const canvas = document.createElement("canvas");
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setPixelRatio(1);
      return this.renderer;
    } catch {
      return null;
    }
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.database) return this.database;
    this.database = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      try {
        const request = indexedDB.open(MAP2D_PREVIEW_DB, MAP2D_PREVIEW_DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(MAP2D_PREVIEW_STORE))
            request.result.createObjectStore(MAP2D_PREVIEW_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
    return this.database;
  }

  private async readStored(asset: string): Promise<Blob | null> {
    const db = await this.openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const request = db.transaction(MAP2D_PREVIEW_STORE, "readonly").objectStore(MAP2D_PREVIEW_STORE).get(`${MODEL_PREVIEW_CACHE}:${asset}`);
        request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  private async writeStored(asset: string, canvas: HTMLCanvasElement): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    try {
      db.transaction(MAP2D_PREVIEW_STORE, "readwrite").objectStore(MAP2D_PREVIEW_STORE).put(blob, `${MODEL_PREVIEW_CACHE}:${asset}`);
    } catch { /* In-memory previews remain usable when local storage is unavailable. */ }
  }
}

export const map2dPropModelImages = new Map2dPropModelImages();
