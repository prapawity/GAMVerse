const PROXIMITY_DOME_MEMBER_MARGIN_M = 3;
const PROXIMITY_DOME_MIN_RADIUS_M = 4;
const PROXIMITY_DOME_SMOOTHING_PER_SECOND = 8;
const MS_PER_SECOND = 1_000;
const MAX_SMOOTHING_STEP_S = 0.25;

export type GroundPoint = { x: number; z: number };
export type DomeShape = { x: number; z: number; radius: number };

/** Everyone reachable from `startId` through hops of at most `linkRadiusM`, the same chaining the server uses for proximity groups. */
export function proximityGroupMembers(startId: string, points: ReadonlyMap<string, GroundPoint>, linkRadiusM: number): string[] {
  if (!points.has(startId)) return [];
  const members = new Set([startId]);
  const queue = [startId];
  for (let head = 0; head < queue.length; head++) {
    const from = points.get(queue[head]!)!;
    for (const [id, point] of points) {
      if (members.has(id) || Math.hypot(point.x - from.x, point.z - from.z) > linkRadiusM) continue;
      members.add(id);
      queue.push(id);
    }
  }
  return [...members];
}

/** Ritter's bounding circle: close to minimal, which is plenty for a decorative dome. */
export function enclosingCircle(points: readonly GroundPoint[]): DomeShape | null {
  const first = points[0];
  if (!first) return null;
  const farthestFrom = (from: GroundPoint) => points.reduce((best, point) => Math.hypot(point.x - from.x, point.z - from.z) > Math.hypot(best.x - from.x, best.z - from.z) ? point : best, from);
  const a = farthestFrom(first);
  const b = farthestFrom(a);
  let circle: DomeShape = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, radius: Math.hypot(a.x - b.x, a.z - b.z) / 2 };
  for (const point of points) {
    const distance = Math.hypot(point.x - circle.x, point.z - circle.z);
    if (distance <= circle.radius) continue;
    const radius = (circle.radius + distance) / 2;
    const shift = (distance - radius) / distance;
    circle = { x: circle.x + (point.x - circle.x) * shift, z: circle.z + (point.z - circle.z) * shift, radius };
  }
  return circle;
}

function shapeForMembers(memberIds: readonly string[], points: ReadonlyMap<string, GroundPoint>): DomeShape {
  const circle = enclosingCircle(memberIds.map(id => points.get(id)!))!;
  return { ...circle, radius: Math.max(PROXIMITY_DOME_MIN_RADIUS_M, circle.radius + PROXIMITY_DOME_MEMBER_MARGIN_M) };
}

/** One shared dome around the whole proximity group; alone (group info not yet known) it falls back to a dome around the player. */
export function groupDomeShape(localId: string, points: ReadonlyMap<string, GroundPoint>, linkRadiusM: number): DomeShape | null {
  const memberIds = proximityGroupMembers(localId, points, linkRadiusM);
  const local = points.get(localId);
  if (!local || !memberIds.length) return null;
  if (memberIds.length === 1) return { x: local.x, z: local.z, radius: linkRadiusM };
  return shapeForMembers(memberIds, points);
}

export type DomeEntry = { key: string; shape: DomeShape; own: boolean };

/**
 * A dome for every proximity group of two or more people, with the local player's flagged `own`.
 * `inOwnGroup` keeps a fallback dome around the player while the server says they are grouped but neighbors are not visible yet.
 */
export function proximityDomeEntries(localId: string | null, points: ReadonlyMap<string, GroundPoint>, linkRadiusM: number, inOwnGroup: boolean): DomeEntry[] {
  const seen = new Set<string>();
  const entries: DomeEntry[] = [];
  for (const id of points.keys()) {
    if (seen.has(id)) continue;
    const memberIds = proximityGroupMembers(id, points, linkRadiusM);
    memberIds.forEach(member => seen.add(member));
    if (memberIds.length < 2) continue;
    entries.push({ key: [...memberIds].sort()[0]!, shape: shapeForMembers(memberIds, points), own: localId !== null && memberIds.includes(localId) });
  }
  const local = localId ? points.get(localId) : undefined;
  if (inOwnGroup && local && !entries.some(entry => entry.own)) entries.push({ key: `own:${localId}`, shape: { x: local.x, z: local.z, radius: linkRadiusM }, own: true });
  return entries;
}

/** Eases each dome toward its target so it glides as people walk; both the 3D and 2D views draw the same shapes. */
export function createDomeSmoothers(): (entries: readonly DomeEntry[], nowMs: number) => DomeEntry[] {
  const byKey = new Map<string, { current: DomeShape; lastMs: number }>();
  return (entries, nowMs) => {
    const live = new Set(entries.map(entry => entry.key));
    for (const key of byKey.keys()) if (!live.has(key)) byKey.delete(key);
    return entries.map(entry => {
      const state = byKey.get(entry.key);
      if (!state) { byKey.set(entry.key, { current: entry.shape, lastMs: nowMs }); return entry; }
      const blend = 1 - Math.exp(-PROXIMITY_DOME_SMOOTHING_PER_SECOND * Math.min(MAX_SMOOTHING_STEP_S, (nowMs - state.lastMs) / MS_PER_SECOND));
      const { current } = state;
      state.current = { x: current.x + (entry.shape.x - current.x) * blend, z: current.z + (entry.shape.z - current.z) * blend, radius: current.radius + (entry.shape.radius - current.radius) * blend };
      state.lastMs = nowMs;
      return { ...entry, shape: state.current };
    });
  };
}
