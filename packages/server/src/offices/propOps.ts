import type { RoomLayoutProp } from "@gammyverse/shared";

/**
 * Delta saves for office props. A client sends only the props it added, changed
 * or removed, together with the version of each prop it started from (`base`).
 * The server merges them into the current props, so two members editing
 * different props never conflict. Only an edit of a prop that someone else
 * changed in the meantime is refused, and it is refused on its own.
 */
export const MAX_PROP_OPS = 500;

export type PropOp =
  | { op: "upsert"; prop: Record<string, unknown>; base?: Record<string, unknown> }
  | { op: "remove"; id: string; base?: Record<string, unknown> };

export type PropOpConflict = { id: string; reason: "exists" | "changed" | "removed"; current: RoomLayoutProp | null };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128;
}

export function parsePropOps(value: unknown): PropOp[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PROP_OPS) throw new Error(`Send between 1 and ${MAX_PROP_OPS} prop changes at a time.`);
  return value.map((item): PropOp => {
    if (!isRecord(item)) throw new Error("Office prop change is invalid.");
    if (item.base !== undefined && !isRecord(item.base)) throw new Error("Office prop change is invalid.");
    const base = item.base as Record<string, unknown> | undefined;
    if (item.op === "upsert") {
      if (!isRecord(item.prop) || !validId(item.prop.id)) throw new Error("Every office prop needs a unique ID.");
      return { op: "upsert", prop: item.prop, ...(base ? { base } : {}) };
    }
    if (item.op === "remove") {
      if (!validId(item.id)) throw new Error("Every office prop needs a unique ID.");
      return { op: "remove", id: item.id, ...(base ? { base } : {}) };
    }
    throw new Error("Office prop change is invalid.");
  });
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** The server owns collision and footprint, so they never decide whether two copies match. */
function editable(prop: unknown) {
  if (!isRecord(prop)) return prop;
  const { collision: _collision, width: _width, depth: _depth, ...rest } = prop;
  void _collision; void _width; void _depth;
  return { ...rest, elevation: typeof rest.elevation === "number" && rest.elevation > 0 ? rest.elevation : undefined };
}

export const samePropContent = (first: unknown, second: unknown) => stable(editable(first)) === stable(editable(second));

export function mergePropOps(current: readonly RoomLayoutProp[], ops: readonly PropOp[]): { next: unknown[]; applied: number; conflicts: PropOpConflict[] } {
  // Map iteration keeps insertion order, so replaced props keep their slot and new ones append.
  const working = new Map<string, unknown>(current.map((prop) => [prop.id, prop]));
  const conflicts: PropOpConflict[] = [];
  let applied = 0;
  const currentOf = (id: string) => (working.get(id) as RoomLayoutProp | undefined) ?? null;
  for (const op of ops) {
    if (op.op === "upsert") {
      const id = op.prop.id as string;
      const existing = currentOf(id);
      if (!op.base) {
        if (!existing) { working.set(id, op.prop); applied += 1; continue; }
        // The same request sent twice must not conflict with itself.
        if (!samePropContent(existing, op.prop)) conflicts.push({ id, reason: "exists", current: existing });
        continue;
      }
      if (!existing) { conflicts.push({ id, reason: "removed", current: null }); continue; }
      if (!samePropContent(existing, op.base)) {
        if (!samePropContent(existing, op.prop)) conflicts.push({ id, reason: "changed", current: existing });
        continue;
      }
      if (samePropContent(existing, op.prop)) continue;
      working.set(id, op.prop);
      applied += 1;
    } else {
      const existing = currentOf(op.id);
      if (!existing) continue;
      if (op.base && !samePropContent(existing, op.base)) { conflicts.push({ id: op.id, reason: "changed", current: existing }); continue; }
      working.delete(op.id);
      applied += 1;
    }
  }
  return { next: [...working.values()], applied, conflicts };
}
