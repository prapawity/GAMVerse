import * as THREE from "three";

export const CHARACTER_MAX_HEIGHT_M = 2.5;
export const CHARACTER_MAX_WIDTH_M = 1.55;
export const CHARACTER_MAX_DEPTH_M = 1.55;

type Point3 = { x: number; y: number; z: number };
type CharacterBounds = { min: Point3; max: Point3 };

/** Uniform scale and translation for bounds, preserving the source model's proportions. */
export function characterModelFitTransform({ min, max }: CharacterBounds): { scale: number; offset: Point3 } | null {
  if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)) return null;
  const width = max.x - min.x;
  const height = max.y - min.y;
  const depth = max.z - min.z;
  if (![width, height, depth].every(Number.isFinite) || width < 0 || height <= 0 || depth < 0) return null;
  const scale = Math.min(CHARACTER_MAX_HEIGHT_M / height, CHARACTER_MAX_WIDTH_M / width, CHARACTER_MAX_DEPTH_M / depth);
  const offset = { x: -(min.x + width / 2) * scale, y: -min.y * scale, z: -(min.z + depth / 2) * scale };
  return scale > 0 && [scale, offset.x, offset.y, offset.z].every(Number.isFinite) ? { scale, offset } : null;
}

/** Fit a detached character instance before attaching it to a scene; shared mesh data stays untouched. */
export function fitCharacterModel(model: THREE.Object3D): void {
  // Skinned bounds need every bone matrix and the attached mesh's bind inverse up to date.
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const fit = characterModelFitTransform(bounds);
  if (!fit) throw new Error("Character model has no finite, nonzero-height bounds");
  const position = model.position.clone().multiplyScalar(fit.scale).add(new THREE.Vector3(fit.offset.x, fit.offset.y, fit.offset.z));
  const scale = model.scale.clone().multiplyScalar(fit.scale);
  if (![...position.toArray(), ...scale.toArray()].every(Number.isFinite)) throw new Error("Character model transform is not finite");
  model.position.copy(position);
  model.scale.copy(scale);
  model.userData.characterHeightM = (bounds.max.y - bounds.min.y) * fit.scale;
  model.updateMatrix();
  model.updateMatrixWorld(true);
}
