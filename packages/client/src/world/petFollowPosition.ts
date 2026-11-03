const PET_FOLLOW_RESPONSE_PER_FRAME = 0.12;
const REFERENCE_FRAME_RATE_HZ = 60;
export const PET_FOLLOW_DISTANCE_M = 1.3;

type HorizontalPosition = { x: number; z: number };

export function petFollowSide(sessionId: string): -1 | 1 {
  const seed = [...sessionId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return seed % 2 === 0 ? -1 : 1;
}

export function petFollowTarget(owner: HorizontalPosition, rotation: number, sessionId: string): HorizontalPosition {
  const side = petFollowSide(sessionId);
  return {
    x: owner.x + Math.cos(rotation) * side * PET_FOLLOW_DISTANCE_M,
    z: owner.z - Math.sin(rotation) * side * PET_FOLLOW_DISTANCE_M,
  };
}

/** Smooths the pet beside its owner, snapping after the 2D view hid its 3D position. */
export function updatePetFollowPosition(
  current: HorizontalPosition,
  target: HorizontalPosition,
  deltaS: number,
  snap: boolean,
): void {
  if (snap) {
    current.x = target.x;
    current.z = target.z;
    return;
  }
  const blend = 1 - Math.pow(1 - PET_FOLLOW_RESPONSE_PER_FRAME, deltaS * REFERENCE_FRAME_RATE_HZ);
  current.x += (target.x - current.x) * blend;
  current.z += (target.z - current.z) * blend;
}
