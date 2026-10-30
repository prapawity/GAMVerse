import { screenMovementToWorld, shortestAngleDelta, type MovementInput } from "@gammyverse/shared";

/** About 150 degrees per second: a full turn in under two and a half seconds, the usual range for steering a character with keys. */
export const CHARACTER_TURN_RATE_RAD_PER_S = 2.6;
/** A tap lasts one frame at least, so it still turns by a small, visible amount. */
export const CHARACTER_TURN_FIRST_FRAME_S = 1 / 60;
/** A stalled tab must not turn the character by the whole time it was away. */
const MAX_TURN_FRAME_S = 0.1;
const MS_PER_SECOND = 1000;
const TURN_INTENT_HOLD_MS = 1000;

export type LockedTurnState = {
  rotationRad: number;
  direction: -1 | 0 | 1;
  /** Time of the last update; the turn integrates from here, so the rate does not depend on the frame rate. */
  lastStepAtMs: number;
  backwardHeld?: boolean;
};

export function isLockedBackwardHeld(keys: ReadonlySet<string>): boolean {
  return (keys.has("KeyS") || keys.has("ArrowDown")) && !(keys.has("KeyW") || keys.has("ArrowUp"));
}

/**
 * Turns the heading at a constant angular speed while A/D is held, integrating over the elapsed time of each frame.
 * Quantised 45 degree steps looked like a ratchet: the avatar, the walking path and the camera all jumped five times a second.
 * In this world +X is to the avatar's left when facing +Z.
 */
export function advanceLockedTurn(state: LockedTurnState | null, direction: -1 | 0 | 1, currentRotationRad: number, nowMs: number): LockedTurnState | null {
  if (direction === 0) return state ? { ...state, direction: 0 } : null;
  const holding = state !== null && nowMs - state.lastStepAtMs < TURN_INTENT_HOLD_MS;
  const rotationRad = holding ? state.rotationRad : currentRotationRad;
  const elapsedS = holding && state.direction !== 0 ? Math.min(MAX_TURN_FRAME_S, Math.max(0, (nowMs - state.lastStepAtMs) / MS_PER_SECOND)) : CHARACTER_TURN_FIRST_FRAME_S;
  return { rotationRad: shortestAngleDelta(0, rotationRad - direction * CHARACTER_TURN_RATE_RAD_PER_S * elapsedS), direction, lastStepAtMs: nowMs, backwardHeld: state?.backwardHeld };
}

export function recentLockedRotation(state: LockedTurnState | null, nowMs: number): number | null {
  return state && nowMs - state.lastStepAtMs < TURN_INTENT_HOLD_MS ? state.rotationRad : null;
}

/** Resolve tank-style input while the camera stays behind the character. */
export function lockedMovementInput(
  forward: number,
  currentRotationRad: number,
  heldRotationRad: number | null,
  sprint: boolean,
): MovementInput {
  const rotationRad = heldRotationRad ?? currentRotationRad;
  const movement = screenMovementToWorld({ x: 0, z: forward }, rotationRad + Math.PI);
  return { ...movement, sprint, facingYaw: rotationRad };
}
