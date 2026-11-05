import type { Vector3Like } from "three";

export type AvatarArm = {
  side: -1 | 1;
  centerX: number;
  shoulder: Vector3Like;
  hand: Vector3Like;
  radius: number;
};

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function center(points: readonly Vector3Like[]): Vector3Like {
  return {
    x: median(points.map(point => point.x)),
    y: median(points.map(point => point.y)),
    z: median(points.map(point => point.z)),
  };
}

/** Look for paired shoulders and lateral arm surfaces below the head of an upright avatar. */
export function inferAvatarArms(points: readonly Vector3Like[], width: number): AvatarArm[] {
  const head = points.filter(point => point.y >= 0.84);
  if (head.length < 12) return [];
  const centerX = center(head).x;
  const inner = Math.max(0.065, width * 0.12);
  const arms: AvatarArm[] = [];
  for (const side of [-1, 1] as const) {
    const shoulders = points.filter(point => point.y >= 0.68 && point.y < 0.81 &&
      (point.x - centerX) * side >= inner && (point.x - centerX) * side <= width * 0.39);
    const lower = points.filter(point => point.y >= 0.40 && point.y <= 0.66 &&
      (point.x - centerX) * side >= inner * 1.55);
    if (shoulders.length < 12 || lower.length < 16) return [];
    const shoulder = center(shoulders);
    const outerEdge = median(lower.map(point => (point.x - centerX) * side));
    const hand = center(lower.filter(point => (point.x - centerX) * side >= outerEdge));
    if (shoulder.y - hand.y < 0.09 || Math.abs(hand.z - shoulder.z) > 0.28) return [];
    arms.push({ side, centerX, shoulder, hand, radius: Math.min(0.13, Math.max(0.055, width * 0.15)) });
  }
  return arms;
}
