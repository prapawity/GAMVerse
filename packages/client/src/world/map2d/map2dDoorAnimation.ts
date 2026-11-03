import type { Map2dActorPoint } from "./map2dWallDrawing";

const DOOR_TRIGGER_RADIUS_M = 1.65;
const DOOR_HOLD_OPEN_MS = 700;
const DOOR_OPEN_EASING_PER_SECOND = 8;
const DOOR_CLOSE_EASING_PER_SECOND = 5;
const DOOR_ANIMATION_EPSILON = 0.012;

type DoorMotion = { progress: number; openUntilMs: number; lastUpdateMs: number };
const doorMotions = new Map<string, DoorMotion>();

export function map2dDoorProgress(doorId: string, x: number, z: number,
  actors: readonly Map2dActorPoint[], nowMs: number): { progress: number; animating: boolean } {
  let motion = doorMotions.get(doorId);
  if (!motion) {
    motion = { progress: 0, openUntilMs: 0, lastUpdateMs: nowMs };
    doorMotions.set(doorId, motion);
  }
  const radiusSq = DOOR_TRIGGER_RADIUS_M * DOOR_TRIGGER_RADIUS_M;
  const nearby = actors.some(actor => {
    const dx = actor.x - x;
    const dz = actor.z - z;
    return dx * dx + dz * dz <= radiusSq;
  });
  if (nearby) motion.openUntilMs = nowMs + DOOR_HOLD_OPEN_MS;
  const shouldOpen = nearby || nowMs < motion.openUntilMs;
  const target = shouldOpen ? 1 : 0;
  const deltaS = Math.max(0, Math.min(0.1, (nowMs - motion.lastUpdateMs) / 1000));
  const rate = shouldOpen ? DOOR_OPEN_EASING_PER_SECOND : DOOR_CLOSE_EASING_PER_SECOND;
  motion.progress += (target - motion.progress) * (1 - Math.exp(-deltaS * rate));
  motion.lastUpdateMs = nowMs;
  if (Math.abs(target - motion.progress) <= DOOR_ANIMATION_EPSILON) motion.progress = target;
  const waitingToClose = !nearby && motion.openUntilMs > nowMs;
  return { progress: motion.progress, animating: motion.progress !== target || waitingToClose };
}

export function pruneMap2dDoorAnimations(activeDoorIds: ReadonlySet<string>): void {
  for (const doorId of doorMotions.keys()) if (!activeDoorIds.has(doorId)) doorMotions.delete(doorId);
}
