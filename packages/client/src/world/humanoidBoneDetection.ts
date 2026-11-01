type Point3 = { x: number; y: number; z: number };
export type SkeletonJoint = { parent: number | null; position: Point3 };
type Limb = { upper: number; lower: number; end: number; length: number };
export type HumanoidBones = { leftArm: Limb; rightArm: Limb; leftLeg: Limb; rightLeg: Limb };

const DETECTION = {
  maxBones: 512,
  minBones: 12,
  minSegmentHeightRatio: 0.08,
  maxPairPositionHeightRatio: 0.1,
  minPairLengthRatio: 0.7,
  ambiguousScoreRatio: 0.95,
  armMinHeightRatio: 0.58,
  armMaxHeightRatio: 0.9,
  armMinOffsetHeightRatio: 0.04,
  armMaxOffsetHeightRatio: 0.28,
  armMinExtensionHeightRatio: 0.07,
  armMaxRiseHeightRatio: 0.04,
  armMaxDropHeightRatio: 0.3,
  armMaxDepthLengthRatio: 0.5,
  legMinHeightRatio: 0.32,
  legMaxHeightRatio: 0.62,
  legMinOffsetHeightRatio: 0.025,
  legMaxOffsetHeightRatio: 0.22,
  legMinDropHeightRatio: 0.12,
  legMaxSideDriftHeightRatio: 0.12,
} as const;

/** Conservative fallback for upright, symmetric T/A-pose skeletons, independent of bone names. */
export function detectHumanoidBones(joints: readonly SkeletonJoint[]): HumanoidBones | null {
  // shortcut: inference needs direct upper/lower/end limb chains; use rig metadata for twist-heavy or nonhumanoid skeletons.
  if (joints.length < DETECTION.minBones || joints.length > DETECTION.maxBones
    || joints.some(joint => ![joint.position.x, joint.position.y, joint.position.z].every(Number.isFinite))) return null;
  const minY = Math.min(...joints.map(joint => joint.position.y));
  const height = Math.max(...joints.map(joint => joint.position.y)) - minY;
  if (!Number.isFinite(height) || height <= 0) return null;
  const centerX = (Math.min(...joints.map(joint => joint.position.x)) + Math.max(...joints.map(joint => joint.position.x))) / 2;
  const points = joints.map(({ position }) => ({ x: (position.x - centerX) / height, y: (position.y - minY) / height, z: position.z / height }));
  const children = joints.map(() => [] as number[]);
  joints.forEach((joint, index) => { if (joint.parent !== null) children[joint.parent]?.push(index); });
  const arms: Limb[] = [];
  const legs: Limb[] = [];
  const distance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  for (let upper = 0; upper < joints.length; upper++) {
    const a = points[upper];
    for (const lower of children[upper]) for (const end of children[lower]) {
      const b = points[lower];
      const c = points[end];
      const firstLength = distance(a, b);
      const secondLength = distance(b, c);
      if (Math.min(firstLength, secondLength) < DETECTION.minSegmentHeightRatio) continue;
      const limb = { upper, lower, end, length: firstLength + secondLength };
      const side = Math.sign(a.x);
      if (a.y > DETECTION.armMinHeightRatio && a.y < DETECTION.armMaxHeightRatio
        && Math.abs(a.x) > DETECTION.armMinOffsetHeightRatio && Math.abs(a.x) < DETECTION.armMaxOffsetHeightRatio
        && (b.x - a.x) * side > DETECTION.armMinExtensionHeightRatio && (c.x - b.x) * side > DETECTION.armMinExtensionHeightRatio
        && b.y <= a.y + DETECTION.armMaxRiseHeightRatio && c.y <= b.y + DETECTION.armMaxRiseHeightRatio
        && b.y > a.y - DETECTION.armMaxDropHeightRatio
        && Math.abs(b.z - a.z) < firstLength * DETECTION.armMaxDepthLengthRatio) arms.push(limb);
      if (a.y > DETECTION.legMinHeightRatio && a.y < DETECTION.legMaxHeightRatio
        && Math.abs(a.x) > DETECTION.legMinOffsetHeightRatio && Math.abs(a.x) < DETECTION.legMaxOffsetHeightRatio
        && b.y < a.y - DETECTION.legMinDropHeightRatio && c.y < b.y - DETECTION.legMinDropHeightRatio
        && Math.abs(b.x - a.x) < DETECTION.legMaxSideDriftHeightRatio && Math.abs(c.x - b.x) < DETECTION.legMaxSideDriftHeightRatio) legs.push(limb);
    }
  }
  const skeletonRoot = (index: number): number => {
    let remaining = joints.length;
    while (joints[index].parent !== null && remaining-- > 0) index = joints[index].parent!;
    return remaining > 0 ? index : -1;
  };
  const pair = (limbs: Limb[]): [Limb, Limb] | null => {
    const pairs: { left: Limb; right: Limb; score: number }[] = [];
    for (const left of limbs) for (const right of limbs) {
      const a = points[left.upper];
      const b = points[right.upper];
      if (a.x <= 0 || b.x >= 0 || skeletonRoot(left.upper) !== skeletonRoot(right.upper)) continue;
      if (Math.hypot(a.x + b.x, a.y - b.y, a.z - b.z) > DETECTION.maxPairPositionHeightRatio
        || Math.min(left.length, right.length) / Math.max(left.length, right.length) < DETECTION.minPairLengthRatio) continue;
      pairs.push({ left, right, score: left.length + right.length });
    }
    pairs.sort((a, b) => b.score - a.score);
    const best = pairs[0];
    const sameLimb = (a: Limb, b: Limb) => a.upper === b.upper && a.lower === b.lower && a.end === b.end;
    if (!best || pairs.some(candidate => (!sameLimb(candidate.left, best.left) || !sameLimb(candidate.right, best.right))
      && candidate.score >= best.score * DETECTION.ambiguousScoreRatio)) return null;
    return [best.left, best.right];
  };
  const armPair = pair(arms);
  const legPair = pair(legs);
  if (!armPair || !legPair || skeletonRoot(armPair[0].upper) !== skeletonRoot(legPair[0].upper)) return null;
  return { leftArm: armPair[0], rightArm: armPair[1], leftLeg: legPair[0], rightLeg: legPair[1] };
}
