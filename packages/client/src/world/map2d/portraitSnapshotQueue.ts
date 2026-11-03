import * as THREE from "three";
import { rememberWebglFailure, webglFailedInThisTab } from "../webglFailureSession";

export const PORTRAIT_POSES_PER_IDLE_SLICE = 2;
const PORTRAIT_IDLE_TIMEOUT_MS = 100;

export type PortraitSnapshotRequest = {
  widthPx: number;
  heightPx: number;
  active(): boolean;
  prepare?(): Promise<void>;
  render(renderer: THREE.WebGLRenderer): Promise<HTMLCanvasElement | null> | HTMLCanvasElement | null;
  cancel?(): void;
  complete(portrait: HTMLCanvasElement | null): void;
};

export function waitForPortraitSnapshotIdle(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: PORTRAIT_IDLE_TIMEOUT_MS });
    else setTimeout(resolve, 16);
  });
}

function createSnapshotRenderer(): THREE.WebGLRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch (error) {
    rememberWebglFailure();
    throw error;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export class PortraitSnapshotQueue {
  private readonly queue: PortraitSnapshotRequest[] = [];
  private draining = false;
  private renderer: THREE.WebGLRenderer | null = null;

  constructor(private readonly createRenderer = createSnapshotRenderer) {}

  enqueue(request: PortraitSnapshotRequest): void {
    if (webglFailedInThisTab()) { request.cancel?.(); request.complete(null); return; }
    this.queue.push(request);
    if (!this.draining) void this.drain();
  }

  private async drain(): Promise<void> {
    this.draining = true;
    try {
      while (this.queue.length) {
        const request = this.queue.shift();
        if (!request) continue;
        if (!request.active()) { request.cancel?.(); request.complete(null); continue; }
        try {
          await request.prepare?.();
        } catch {
          request.cancel?.();
          request.complete(null);
          continue;
        }
        if (!request.active()) { request.cancel?.(); request.complete(null); continue; }
        if (webglFailedInThisTab()) { request.cancel?.(); request.complete(null); continue; }
        let portrait: HTMLCanvasElement | null = null;
        try {
          this.renderer ??= this.createRenderer();
          this.renderer.setSize(request.widthPx, request.heightPx, false);
          portrait = await request.render(this.renderer);
        } catch {
          request.cancel?.();
        }
        request.complete(portrait);
        if (this.queue.length) await new Promise<void>(resolve => setTimeout(resolve, 16));
      }
    } finally {
      this.renderer?.dispose();
      this.renderer?.forceContextLoss();
      this.renderer = null;
      this.draining = false;
    }
  }
}

const portraitSnapshotQueue = new PortraitSnapshotQueue();

export function queuePortraitSnapshot(request: PortraitSnapshotRequest): void {
  portraitSnapshotQueue.enqueue(request);
}
