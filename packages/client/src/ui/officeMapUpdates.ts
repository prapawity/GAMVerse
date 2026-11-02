import { applyMapPropsPatch, type RoomLayout, type ServerMapState } from "@gammyverse/shared";

/** Bursts of `office-map` messages inside this window are applied as one scene rebuild. */
export const OFFICE_MAP_APPLY_WINDOW_MS = 300;

const signatureByLayout = new WeakMap<RoomLayout, string>();

function layoutSignature(layout: RoomLayout) {
  let signature = signatureByLayout.get(layout);
  if (signature === undefined) {
    signature = JSON.stringify(layout);
    signatureByLayout.set(layout, signature);
  }
  return signature;
}

/**
 * True when two parsed layouts render identically. The world canvas rebuilds its
 * whole scene whenever the layout object changes, so an update that carries
 * nothing new must keep the previous object.
 */
export function sameRoomLayout(first: RoomLayout | null, second: RoomLayout | null) {
  if (first === second) return true;
  if (!first || !second) return false;
  return layoutSignature(first) === layoutSignature(second);
}

type Timers = { set(callback: () => void, delayMs: number): unknown; clear(handle: unknown): void };
const BROWSER_TIMERS: Timers = { set: (callback, delayMs) => setTimeout(callback, delayMs), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/**
 * First value applies immediately so a single edit shows up with no added delay.
 * Values pushed while the window is open are collapsed to the latest one, applied
 * when the window closes, so a burst of N updates costs at most one apply per window.
 */
export function createLeadingTrailingScheduler<Value>(apply: (value: Value) => void, windowMs: number, timers: Timers = BROWSER_TIMERS) {
  let handle: unknown;
  let open = false;
  let pending: { value: Value } | undefined;

  const openWindow = () => {
    open = true;
    handle = timers.set(() => {
      open = false;
      handle = undefined;
      if (!pending) return;
      const { value } = pending;
      pending = undefined;
      apply(value);
      openWindow();
    }, windowMs);
  };

  return {
    push(value: Value) {
      if (open) { pending = { value }; return; }
      apply(value);
      openWindow();
    },
    /** Drop anything not yet applied, for example when the connection ends. */
    cancel() {
      if (handle !== undefined) timers.clear(handle);
      handle = undefined;
      open = false;
      pending = undefined;
    },
  };
}

export type PropsPatchOutcome =
  | { kind: "apply"; next: ServerMapState & { revision: number } }
  | { kind: "stale" }
  | { kind: "resync" };

/**
 * Decide what to do with a props-changed message. Patches are ordered by the room's
 * revision, never by configVersion: a props-only save leaves the map's configVersion
 * unchanged, so comparing it would silently drop every saved prop until a refresh.
 */
export function resolvePropsPatch(known: ServerMapState | null, payload: unknown): PropsPatchOutcome {
  const revision = typeof payload === "object" && payload !== null && "revision" in payload ? payload.revision : undefined;
  if (typeof revision !== "number" || !Number.isInteger(revision)) return { kind: "resync" };
  if (known?.revision !== undefined && revision <= known.revision) return { kind: "stale" };
  const next = applyMapPropsPatch(known, payload);
  return next ? { kind: "apply", next } : { kind: "resync" };
}
