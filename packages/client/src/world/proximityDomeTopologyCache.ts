import { proximityDomeEntries, type DomeEntry, type GroundPoint } from "./proximityGroupShape";

/** Decorative topology cache; keep per-frame smoothing separate.
 * Optional revisions must change with eligible membership, iteration order or
 * positions. Without one, numeric comparison costs O(N), without string signatures.
 */
export class ProximityDomeTopologyCache {
  rebuildCount = 0;
  private localId: string | null | undefined;
  private radiusM: number | undefined;
  private inOwnGroup: boolean | undefined;
  private revision: unknown;
  private points = new Map<string, GroundPoint>();
  private entries: readonly DomeEntry[] = [];

  update(localId: string | null, points: ReadonlyMap<string, GroundPoint>, radiusM: number, inOwnGroup: boolean, revision?: unknown): readonly DomeEntry[] {
    const sameContext = this.localId === localId && this.radiusM === radiusM && this.inOwnGroup === inOwnGroup;
    if (revision !== undefined && sameContext && this.revision === revision) return this.entries;

    let changed = !sameContext || this.points.size !== points.size;
    if (!changed) {
      const previousIds = this.points.keys();
      for (const [id, point] of points) {
        const previous = this.points.get(id);
        if (previousIds.next().value !== id || !previous || previous.x !== point.x || previous.z !== point.z) { changed = true; break; }
      }
    }
    this.localId = localId;
    this.radiusM = radiusM;
    this.inOwnGroup = inOwnGroup;
    this.revision = revision;
    if (!changed) return this.entries;

    this.points = new Map(Array.from(points, ([id, point]) => [id, { x: point.x, z: point.z }]));
    this.entries = proximityDomeEntries(localId, this.points, radiusM, inOwnGroup);
    this.rebuildCount++;
    return this.entries;
  }

  clear(): void {
    this.localId = undefined;
    this.radiusM = undefined;
    this.inOwnGroup = undefined;
    this.revision = undefined;
    this.points.clear();
    this.entries = [];
  }
}
