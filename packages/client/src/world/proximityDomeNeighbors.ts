export type ProximityPoint = { x: number; z: number };
export type ProximityNeighborGraph = {
  neighbors: Map<string, Set<string>>;
  candidatePairCount: number;
  possiblePairCount: number;
};

/** Exact-radius spatial hash for decorative dome topology; dense outputs may still be quadratic. */
export function proximityDomeNeighborGraph(
  points: ReadonlyMap<string, ProximityPoint>,
  linkRadiusM: number,
): ProximityNeighborGraph {
  const people = Array.from(points);
  const cellSizeM = Math.max(linkRadiusM, Number.EPSILON);
  const cellKey = (x: number, z: number) => `${x},${z}`;
  const buckets = new Map<string, number[]>();
  const neighbors = new Map(people.map(([id]) => [id, new Set<string>()]));
  let candidatePairCount = 0;

  for (let index = 0; index < people.length; index += 1) {
    const point = people[index]![1];
    const key = cellKey(Math.floor(point.x / cellSizeM), Math.floor(point.z / cellSizeM));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
  }

  for (let index = 0; index < people.length; index += 1) {
    const [id, point] = people[index]!;
    const cellX = Math.floor(point.x / cellSizeM);
    const cellZ = Math.floor(point.z / cellSizeM);
    const candidates: number[] = [];
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let z = cellZ - 1; z <= cellZ + 1; z += 1) {
        for (const other of buckets.get(cellKey(x, z)) ?? []) if (other > index) candidates.push(other);
      }
    }
    candidates.sort((a, b) => a - b);
    for (const otherIndex of candidates) {
      const [otherId, other] = people[otherIndex]!;
      candidatePairCount += 1;
      if (Math.hypot(point.x - other.x, point.z - other.z) > linkRadiusM) continue;
      neighbors.get(id)!.add(otherId);
      neighbors.get(otherId)!.add(id);
    }
  }

  return { neighbors, candidatePairCount, possiblePairCount: people.length * (people.length - 1) / 2 };
}

export function proximityComponent(startId: string, neighbors: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  if (!neighbors.has(startId)) return [];
  const members = new Set([startId]);
  const queue = [startId];
  for (let head = 0; head < queue.length; head += 1) {
    for (const id of neighbors.get(queue[head]!) ?? []) {
      if (members.has(id)) continue;
      members.add(id);
      queue.push(id);
    }
  }
  return queue;
}

export function proximityDomeComponents(neighbors: ReadonlyMap<string, ReadonlySet<string>>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const [id, adjacent] of neighbors) {
    if (visited.has(id)) continue;
    const component = proximityComponent(id, neighbors);
    for (const member of component) visited.add(member);
    if (adjacent.size) components.push(component);
  }
  return components;
}
