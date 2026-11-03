const COMPACT_PROP_ENTER_PX = 12;
const COMPACT_PROP_EXIT_PX = 16;
const COMPACT_PROP_INITIAL_PX = 14;

const compactByPropId = new Map<string, boolean>();

/** Keep the small-detail LOD from flapping when zoom rests around its boundary. */
export function map2dPropUsesCompactLod(propId: string, footprintPx: number): boolean {
  const previous = compactByPropId.get(propId);
  const compact = previous === undefined
    ? footprintPx < COMPACT_PROP_INITIAL_PX
    : previous ? footprintPx < COMPACT_PROP_EXIT_PX : footprintPx < COMPACT_PROP_ENTER_PX;
  compactByPropId.set(propId, compact);
  return compact;
}

export function pruneMap2dPropLod(activePropIds: ReadonlySet<string>): void {
  for (const propId of compactByPropId.keys()) if (!activePropIds.has(propId)) compactByPropId.delete(propId);
}
