import assert from "node:assert/strict";
import test from "node:test";
import { proximityDomeComponents, proximityDomeNeighborGraph } from "./proximityDomeNeighbors";

function bruteForce(points: ReadonlyMap<string, { x: number; z: number }>, radius: number) {
  const neighbors = new Map(Array.from(points.keys(), id => [id, new Set<string>()]));
  const entries = Array.from(points);
  for (let first = 0; first < entries.length; first += 1) {
    const [firstId, a] = entries[first]!;
    for (let second = first + 1; second < entries.length; second += 1) {
      const [secondId, b] = entries[second]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) > radius) continue;
      neighbors.get(firstId)!.add(secondId);
      neighbors.get(secondId)!.add(firstId);
    }
  }
  return neighbors;
}

test("spatial buckets preserve exact-radius edges and transitive components", () => {
  const points = new Map([
    ["a", { x: -10, z: 0 }],
    ["b", { x: 0, z: 0 }],
    ["c", { x: 10, z: 0 }],
    ["boundary", { x: 0, z: 10 }],
    ["outside", { x: 0, z: 10.0001 }],
  ]);
  const graph = proximityDomeNeighborGraph(points, 10);
  assert.deepEqual(graph.neighbors, bruteForce(points, 10));
  assert.equal(graph.neighbors.get("b")!.has("outside"), false);
  assert.deepEqual(proximityDomeComponents(graph.neighbors), [["a", "b", "c", "boundary", "outside"]]);
});

test("sparse buckets reduce candidate checks while dense groups retain all required pairs", () => {
  const sparse = new Map(Array.from({ length: 200 }, (_, index) => [String(index), { x: index * 20, z: 0 }]));
  const sparseGraph = proximityDomeNeighborGraph(sparse, 5);
  assert.equal(sparseGraph.possiblePairCount, 19_900);
  assert.equal(sparseGraph.candidatePairCount, 0);

  const dense = new Map(Array.from(sparse.keys(), id => [id, { x: 0, z: 0 }]));
  const denseGraph = proximityDomeNeighborGraph(dense, 5);
  assert.equal(denseGraph.candidatePairCount, denseGraph.possiblePairCount);
});

test("bucket boundaries work across negative coordinates", () => {
  const points = new Map([["left", { x: -5, z: -5 }], ["right", { x: 0, z: -5 }]]);
  assert.deepEqual(proximityDomeNeighborGraph(points, 5).neighbors, bruteForce(points, 5));
});
