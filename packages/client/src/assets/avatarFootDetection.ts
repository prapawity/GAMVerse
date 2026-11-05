import type { Vector3Like } from "three";

type Footprint = { x: number; z: number };
export type AvatarFoot = Footprint & { phase: number };

function cluster(points: readonly Vector3Like[], seeds: readonly Footprint[]) {
  let centers = seeds;
  let groups: Vector3Like[][] = [];
  for (let iteration = 0; iteration < 8; iteration++) {
    groups = centers.map(() => []);
    for (const point of points) {
      let nearest = 0;
      let distance = Infinity;
      centers.forEach((center, index) => {
        const candidate = (point.x - center.x) ** 2 + (point.z - center.z) ** 2;
        if (candidate < distance) { distance = candidate; nearest = index; }
      });
      groups[nearest].push(point);
    }
    centers = groups.map((group, index) => group.length ? {
      x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
      z: group.reduce((sum, point) => sum + point.z, 0) / group.length,
    } : centers[index]);
  }
  const minimum = Math.max(6, points.length * 0.09);
  if (groups.some(group => group.length < minimum)) return null;
  for (const [index, center] of centers.entries()) {
    const separation = Math.min(...centers.filter((_, other) => other !== index)
      .map(other => Math.hypot(other.x - center.x, other.z - center.z)));
    const spread = Math.sqrt(groups[index].reduce((sum, point) =>
      sum + (point.x - center.x) ** 2 + (point.z - center.z) ** 2, 0) / groups[index].length);
    if (separation < 0.095 || spread > separation * 0.65) return null;
  }
  return centers;
}

/** Points are centered in X/Z, relative to the floor and expressed in model heights. */
export function inferAvatarFeet(points: readonly Vector3Like[], width: number, depth: number): AvatarFoot[] | null {
  const ground = points.filter(point => point.y <= 0.115);
  if (ground.length < 24 || ground.length > points.length * 0.65) return null;
  if (depth >= 0.85 && width >= 0.24) {
    const four = cluster(ground, [
      { x: -width / 4, z: -depth / 4 }, { x: width / 4, z: -depth / 4 },
      { x: -width / 4, z: depth / 4 }, { x: width / 4, z: depth / 4 },
    ]);
    if (four && Math.abs((four[0].z + four[1].z - four[2].z - four[3].z) / 2) >= 0.27 &&
        Math.abs((four[0].x + four[2].x - four[1].x - four[3].x) / 2) >= 0.14) {
      return four.map((foot, index) => ({ ...foot, phase: [0, Math.PI, Math.PI, 0][index] }));
    }
  }
  if (depth > 0.9 || width > 1.45) return null;
  const two = cluster(ground, [{ x: -width / 4, z: 0 }, { x: width / 4, z: 0 }]);
  if (!two || Math.abs(two[0].x - two[1].x) < Math.abs(two[0].z - two[1].z) * 0.65) return null;
  return two.map((foot, index) => ({ ...foot, phase: index * Math.PI }));
}
