import * as THREE from "three";
import type { DomeEntry, DomeShape } from "./proximityGroupShape";

export const PROXIMITY_DOME_OPACITY = 0.35;
/** Other people's groups are a lighter hint than your own. */
export const PROXIMITY_DOME_OTHER_OPACITY = 0.2;
const PROXIMITY_DOME_COLOR = 0x9fd8ee;
const PROXIMITY_DOME_RING_OPACITY = 0.6;
const PROXIMITY_DOME_OTHER_RING_OPACITY = 0.35;
const PROXIMITY_DOME_RING_WIDTH_RATIO = 0.015;
const PROXIMITY_DOME_SEGMENTS = 48;
const PROXIMITY_DOME_RINGS = 16;
const PROXIMITY_DOME_GROUND_LIFT_M = 0.03;
const PROXIMITY_DOME_HEIGHT_RATIO = 0.6;

export interface ProximityDome {
  group: THREE.Group;
  update(visible: boolean, shape: DomeShape | null, own?: boolean): void;
  dispose(): void;
}

/** A translucent hemisphere with a ground ring, sized each frame to the group's shared shape. */
export function createProximityDome(): ProximityDome {
  const group = new THREE.Group();
  group.visible = false;
  const fill = new THREE.MeshBasicMaterial({ color: PROXIMITY_DOME_COLOR, transparent: true, opacity: PROXIMITY_DOME_OPACITY, depthWrite: false, side: THREE.DoubleSide });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, PROXIMITY_DOME_SEGMENTS, PROXIMITY_DOME_RINGS, 0, Math.PI * 2, 0, Math.PI / 2), fill);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: PROXIMITY_DOME_COLOR, transparent: true, opacity: PROXIMITY_DOME_RING_OPACITY, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1 - PROXIMITY_DOME_RING_WIDTH_RATIO, 1, PROXIMITY_DOME_SEGMENTS), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = PROXIMITY_DOME_GROUND_LIFT_M;
  for (const mesh of [dome, ring]) { mesh.renderOrder = 5; mesh.raycast = () => undefined; }
  group.add(dome, ring);
  return {
    group,
    update(visible, shape, own = true) {
      group.visible = visible && shape !== null;
      if (!group.visible || !shape) return;
      fill.opacity = own ? PROXIMITY_DOME_OPACITY : PROXIMITY_DOME_OTHER_OPACITY;
      ringMaterial.opacity = own ? PROXIMITY_DOME_RING_OPACITY : PROXIMITY_DOME_OTHER_RING_OPACITY;
      group.position.set(shape.x, 0, shape.z);
      group.scale.set(shape.radius, 1, shape.radius);
      dome.scale.y = shape.radius * PROXIMITY_DOME_HEIGHT_RATIO;
    },
    dispose() {
      dome.geometry.dispose(); ring.geometry.dispose(); fill.dispose(); ringMaterial.dispose();
      group.removeFromParent();
    },
  };
}

export interface ProximityDomeSet {
  update(entries: readonly DomeEntry[], offset: { x: number; z: number }): void;
  dispose(): void;
}

/** One dome per visible proximity group, created and released as groups form and dissolve. */
export function createProximityDomeSet(parent: THREE.Object3D): ProximityDomeSet {
  const domes = new Map<string, ProximityDome>();
  return {
    update(entries, offset) {
      const live = new Set(entries.map(entry => entry.key));
      for (const [key, dome] of domes) if (!live.has(key)) { dome.dispose(); domes.delete(key); }
      for (const entry of entries) {
        let dome = domes.get(entry.key);
        if (!dome) { dome = createProximityDome(); parent.add(dome.group); domes.set(entry.key, dome); }
        dome.update(true, { ...entry.shape, x: entry.shape.x + offset.x, z: entry.shape.z + offset.z }, entry.own);
      }
    },
    dispose() { for (const dome of domes.values()) dome.dispose(); domes.clear(); },
  };
}
