/** Furthest visible prop distance from the point at the centre of the camera. */
export const PROP_RENDER_DISTANCE_M = 200;
/** Buffer that prevents props popping while the camera sits on the cutoff. */
export const PROP_RENDER_DISTANCE_HYSTERESIS_M = 15;
export const PROP_RENDER_CULL_INTERVAL_MS = 100;
/** Start loading models just before they can enter the 200 m render radius. */
export const PROP_MODEL_LOAD_DISTANCE_M = 225;
/** Spread scene creation over frames instead of cloning thousands of models at once. */
export const PROP_MODEL_LOAD_BATCH_SIZE = 32;

export function shouldRenderDistanceCulledProp(
  prop: { x: number; z: number },
  cameraFocus: { x: number; z: number },
  wasVisible: boolean,
  renderDistanceM = PROP_RENDER_DISTANCE_M,
  hysteresisM = PROP_RENDER_DISTANCE_HYSTERESIS_M,
) {
  // A hidden prop only returns after the camera is closer by the hysteresis
  // band, preventing visible flicker at the boundary.
  const radius = wasVisible ? renderDistanceM : renderDistanceM - hysteresisM;
  const dx = prop.x - cameraFocus.x;
  const dz = prop.z - cameraFocus.z;
  return dx * dx + dz * dz <= radius * radius;
}

export function shouldLoadPropModel(
  prop: { x: number; z: number },
  cameraFocus: { x: number; z: number },
) {
  const dx = prop.x - cameraFocus.x;
  const dz = prop.z - cameraFocus.z;
  return dx * dx + dz * dz <= PROP_MODEL_LOAD_DISTANCE_M * PROP_MODEL_LOAD_DISTANCE_M;
}
