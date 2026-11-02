/**
 * Props-only map updates. A save that only adds, edits or removes a few props is
 * broadcast as a patch instead of the whole map config, so every connected player
 * receives a few hundred bytes rather than the full prop list.
 *
 * The patch is exact: applying it to the previous config reproduces the next
 * config, including prop order. Anything that cannot be expressed that way
 * (other parts of the config changed, many props changed, duplicate or missing
 * ids, reordered props) yields no patch and callers send the full config.
 */
export type MapPropsPatch = {
  /**
   * Revision the patch applies on top of. A revision counts every map broadcast a room
   * makes. The map's configVersion cannot order patches: a props-only save does not
   * change it, so two different maps can share one configVersion.
   */
  baseRevision: number;
  /** Revision after applying the patch. */
  revision: number;
  /** The map's config version at that point (informational). */
  configVersion: number;
  /** Props that are new or changed. New ones are appended; changed ones keep their slot. */
  upsert: unknown[];
  /** Ids of props that no longer exist. */
  removed: string[];
};

/** More changed props than this is cheaper and safer as a full map. */
export const MAP_PROPS_PATCH_MAX_CHANGES = 400;

type ConfigRecord = Record<string, unknown>;

const propJsonCache = new WeakMap<object, string>();
const restJsonCache = new WeakMap<object, string>();

function isRecord(value: unknown): value is ConfigRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function propsOf(config: unknown): unknown[] | null {
  if (!isRecord(config) || !isRecord(config.layout)) return null;
  return Array.isArray(config.layout.props) ? config.layout.props : null;
}

function propJson(prop: unknown) {
  if (typeof prop !== "object" || prop === null) return JSON.stringify(prop);
  let json = propJsonCache.get(prop);
  if (json === undefined) {
    json = JSON.stringify(prop);
    propJsonCache.set(prop, json);
  }
  return json;
}

/** Everything in the config except layout.props, which the patch carries separately. */
function restJson(config: ConfigRecord) {
  let json = restJsonCache.get(config);
  if (json === undefined) {
    const layout = config.layout as ConfigRecord;
    json = JSON.stringify({ ...config, layout: { ...layout, props: null } });
    restJsonCache.set(config, json);
  }
  return json;
}

function propId(prop: unknown) {
  return isRecord(prop) && typeof prop.id === "string" ? prop.id : null;
}

/** Apply a patch to a config. Returns null when the patch does not fit the config. */
export type ServerMapState = { config: unknown; configVersion: number; revision?: number };

export function applyMapPropsPatch(base: ServerMapState | null, patch: unknown): (ServerMapState & { revision: number }) | null {
  if (!base || !isRecord(base.config) || !isRecord(base.config.layout) || !isRecord(patch)) return null;
  const { baseRevision, revision, configVersion, upsert, removed } = patch;
  if (!Number.isInteger(baseRevision) || !Number.isInteger(revision) || !Number.isInteger(configVersion) || !Array.isArray(upsert) || !Array.isArray(removed)) return null;
  if (base.revision === undefined || baseRevision !== base.revision || (revision as number) <= (baseRevision as number)) return null;
  const current = propsOf(base.config);
  if (!current) return null;
  const removedIds = new Set<string>();
  for (const id of removed) {
    if (typeof id !== "string") return null;
    removedIds.add(id);
  }
  const upserts = new Map<string, unknown>();
  for (const prop of upsert) {
    const id = propId(prop);
    if (id === null || upserts.has(id)) return null;
    upserts.set(id, prop);
  }
  const next: unknown[] = [];
  const seen = new Set<string>();
  for (const prop of current) {
    const id = propId(prop);
    if (id === null) return null;
    seen.add(id);
    if (removedIds.has(id)) continue;
    next.push(upserts.has(id) ? upserts.get(id) : prop);
  }
  for (const [id, prop] of upserts) if (!seen.has(id)) next.push(prop);
  return { config: { ...base.config, layout: { ...base.config.layout, props: next } }, configVersion: configVersion as number, revision: revision as number };
}

/** Build the smallest exact patch from `previous` to `next`, or null when a full map must be sent. */
export function buildMapPropsPatch(previous: unknown, next: unknown, baseRevision: number, revision: number, configVersion: number): MapPropsPatch | null {
  const before = propsOf(previous);
  const after = propsOf(next);
  if (!before || !after || !isRecord(previous) || !isRecord(next)) return null;
  if (!Number.isInteger(baseRevision) || !Number.isInteger(revision) || !Number.isInteger(configVersion) || revision <= baseRevision) return null;
  if (restJson(previous) !== restJson(next)) return null;
  const beforeById = new Map<string, unknown>();
  for (const prop of before) {
    const id = propId(prop);
    if (id === null || beforeById.has(id)) return null;
    beforeById.set(id, prop);
  }
  const afterIds = new Set<string>();
  const upsert: unknown[] = [];
  for (const prop of after) {
    const id = propId(prop);
    if (id === null || afterIds.has(id)) return null;
    afterIds.add(id);
    const old = beforeById.get(id);
    if (old === undefined || propJson(old) !== propJson(prop)) upsert.push(prop);
    if (upsert.length > MAP_PROPS_PATCH_MAX_CHANGES) return null;
  }
  const removed = [...beforeById.keys()].filter((id) => !afterIds.has(id));
  if (upsert.length + removed.length > MAP_PROPS_PATCH_MAX_CHANGES) return null;
  const patch: MapPropsPatch = { baseRevision, revision, configVersion, upsert, removed };
  // Prove the patch is exact, including order, before anyone relies on it.
  const rebuilt = propsOf(applyMapPropsPatch({ config: previous, configVersion, revision: baseRevision }, patch)?.config);
  if (!rebuilt || rebuilt.length !== after.length) return null;
  for (let index = 0; index < after.length; index += 1) if (propId(rebuilt[index]) !== propId(after[index]) || propJson(rebuilt[index]) !== propJson(after[index])) return null;
  return patch;
}
