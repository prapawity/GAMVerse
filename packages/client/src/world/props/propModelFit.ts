import * as THREE from "three";

/** Match the asset's source height and center its floor contact point. */
export function normalizePropModel(object: THREE.Object3D, height: number): void {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = height / Math.max(size.y, 0.001);
  object.scale.setScalar(scale);
  object.position.set(
    -((bounds.min.x + bounds.max.x) / 2) * scale,
    -bounds.min.y * scale,
    -((bounds.min.z + bounds.max.z) / 2) * scale,
  );
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/** Preserve model proportions and center the fitted geometry in its footprint. */
export function fitPropModelToFootprint(object: THREE.Object3D, width: number, depth: number): number {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const fitX = size.x > 0.001 ? width / size.x : Number.POSITIVE_INFINITY;
  const fitZ = size.z > 0.001 ? depth / size.z : Number.POSITIVE_INFINITY;
  // Catalog hit boxes can be larger than the authored model. Never enlarge a
  // small source prop just to fill its collision footprint.
  const fitScale = Math.min(1, fitX, fitZ);
  if (Number.isFinite(fitScale) && fitScale > 0) object.scale.multiplyScalar(fitScale);
  const fittedBounds = new THREE.Box3().setFromObject(object);
  const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
  object.position.x -= fittedCenter.x;
  object.position.z -= fittedCenter.z;
  object.position.y -= fittedBounds.min.y;
  return fitScale;
}
