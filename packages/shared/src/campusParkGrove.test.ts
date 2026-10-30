import assert from "node:assert/strict";
import test from "node:test";
import { groveCandidates } from "./campusParkGrove.js";

const BAND = { xMin: -100, xMax: 0, zMin: -30, zMax: 30 };

test("the grove covers the whole band, staggered and inside it plus jitter", () => {
  const candidates = groveCandidates([BAND]);
  assert.ok(candidates.length >= 30, `${candidates.length} candidates`);
  const xs = candidates.map(candidate => candidate.x);
  const zs = candidates.map(candidate => candidate.z);
  assert.ok(Math.min(...xs) < BAND.xMin + 15 && Math.max(...xs) > BAND.xMax - 15, "spans the band width");
  assert.ok(Math.min(...zs) < BAND.zMin + 5 && Math.max(...zs) > BAND.zMax - 12, "spans the band depth");
  assert.ok(Math.min(...xs) >= BAND.xMin - 2 && Math.max(...xs) <= BAND.xMax + 2, "stays within the jitter of the band");
});

test("trees keep a minimum separation so canopies do not merge", () => {
  const candidates = groveCandidates([BAND]);
  let closest = Infinity;
  for (let first = 0; first < candidates.length; first += 1) for (let second = first + 1; second < candidates.length; second += 1) {
    closest = Math.min(closest, Math.hypot(candidates[first]!.x - candidates[second]!.x, candidates[first]!.z - candidates[second]!.z));
  }
  assert.ok(closest >= 4, `closest pair is ${closest.toFixed(2)} m`);
});

test("the grove is deterministic and mixes several species clusters", () => {
  assert.deepEqual(groveCandidates([BAND]), groveCandidates([BAND]));
  assert.ok(new Set(groveCandidates([BAND]).map(candidate => candidate.speciesCluster)).size >= 5);
});
