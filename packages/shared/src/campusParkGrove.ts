export type GroveBand = { xMin: number; xMax: number; zMin: number; zMax: number };
export type GroveCandidate = { x: number; z: number; rotationQuarterTurns: number; speciesCluster: number };

const GROVE_SPACING_X_M = 8;
const GROVE_SPACING_Z_M = 7;
const GROVE_JITTER_M = 1.2;
const STAGGER_RATIO = 0.5;
const CLUSTER_SIZE = 3;
const QUARTER_TURNS = 4;
const HASH_SCALE = 0x1_0000_0000;

function hash(x: number, z: number, salt: number): number {
  let value = Math.imul(Math.round(x * 4) ^ 0x9e3779b1, 2246822519) ^ Math.imul(Math.round(z * 4) ^ salt, 3266489917);
  value = Math.imul(value ^ (value >>> 15), 2246822519);
  value = Math.imul(value ^ (value >>> 13), 3266489917);
  return ((value ^ (value >>> 16)) >>> 0) / HASH_SCALE;
}

/**
 * Staggered rows of trees with a small deterministic jitter, so a lawn reads as planted rather than gridded.
 * Neighbouring candidates share a species cluster, giving stands of one kind with natural variety between stands.
 */
export function groveCandidates(bands: readonly GroveBand[]): GroveCandidate[] {
  const candidates: GroveCandidate[] = [];
  for (const band of bands) {
    for (let row = 0, z = band.zMin; z <= band.zMax; row += 1, z += GROVE_SPACING_Z_M) {
      const stagger = row % 2 === 0 ? 0 : GROVE_SPACING_X_M * STAGGER_RATIO;
      for (let column = 0, x = band.xMin + stagger; x <= band.xMax; column += 1, x += GROVE_SPACING_X_M) {
        const jitterX = (hash(x, z, 1) - 0.5) * 2 * GROVE_JITTER_M;
        const jitterZ = (hash(x, z, 2) - 0.5) * 2 * GROVE_JITTER_M;
        candidates.push({
          x: x + jitterX, z: z + jitterZ,
          rotationQuarterTurns: Math.floor(hash(x, z, 3) * QUARTER_TURNS),
          speciesCluster: Math.floor(column / CLUSTER_SIZE) + Math.floor(row / 2) * 7,
        });
      }
    }
  }
  return candidates;
}
