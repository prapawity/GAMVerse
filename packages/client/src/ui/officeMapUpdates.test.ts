import assert from "node:assert/strict";
import test from "node:test";
import { buildMapPropsPatch, type RoomLayout } from "@gammyverse/shared";
import { createLeadingTrailingScheduler, resolvePropsPatch, sameRoomLayout } from "./officeMapUpdates.js";

const layout = (x = 0): RoomLayout => ({ version: 1, props: [{ id: "p", asset: "a", x, z: 0, width: 1, depth: 1, rotation: 0, collision: false }] as never, zones: [], walls: [], doors: [] });

function fakeTimers() {
  const queue: Array<{ id: number; callback: () => void }> = [];
  let next = 1;
  return {
    timers: { set: (callback: () => void) => { const id = next++; queue.push({ id, callback }); return id; }, clear: (handle: unknown) => { const index = queue.findIndex(entry => entry.id === handle); if (index >= 0) queue.splice(index, 1); } },
    fire() { queue.shift()?.callback(); },
    get waiting() { return queue.length; },
  };
}

test("identical layouts keep the old object so the scene is not rebuilt", () => {
  assert.equal(sameRoomLayout(layout(), layout()), true);
  assert.equal(sameRoomLayout(layout(0), layout(1)), false);
  assert.equal(sameRoomLayout(null, layout()), false);
  assert.equal(sameRoomLayout(null, null), true);
});

test("a single update applies immediately with no added delay", () => {
  const clock = fakeTimers(); const applied: number[] = [];
  const scheduler = createLeadingTrailingScheduler<number>(value => applied.push(value), 300, clock.timers);
  scheduler.push(1);
  assert.deepEqual(applied, [1]);
  clock.fire();
  scheduler.push(2);
  assert.deepEqual(applied, [1, 2], "an idle window starts again immediately");
});

test("a burst collapses to the first and the latest update", () => {
  const clock = fakeTimers(); const applied: number[] = [];
  const scheduler = createLeadingTrailingScheduler<number>(value => applied.push(value), 300, clock.timers);
  for (const value of [1, 2, 3, 4, 5]) scheduler.push(value);
  assert.deepEqual(applied, [1]);
  clock.fire();
  assert.deepEqual(applied, [1, 5], "100 saves inside one window cost two rebuilds, not 100");
  clock.fire();
  assert.equal(clock.waiting, 0, "no timer is left running when the burst ends");
});

test("cancel drops pending updates and stops the timer", () => {
  const clock = fakeTimers(); const applied: number[] = [];
  const scheduler = createLeadingTrailingScheduler<number>(value => applied.push(value), 300, clock.timers);
  scheduler.push(1); scheduler.push(2);
  scheduler.cancel();
  assert.equal(clock.waiting, 0);
  assert.deepEqual(applied, [1]);
  scheduler.push(3);
  assert.deepEqual(applied, [1, 3]);
});

const mapOf = (...ids: string[]) => ({ version: 1, layout: { props: ids.map((id) => ({ id, asset: "kit:chair", x: 0, z: 0, rotation: 0 })), zones: [], walls: [] } });

test("props patches apply in revision order even though the map configVersion never changes", () => {
  // Regression: saved props did not appear until a refresh because patches with an unchanged configVersion were dropped.
  const base = { config: mapOf("a"), configVersion: 7, revision: 1 };
  const patch1 = buildMapPropsPatch(mapOf("a"), mapOf("a", "b"), 1, 2, 7);
  const patch2 = buildMapPropsPatch(mapOf("a", "b"), mapOf("a", "b", "c"), 2, 3, 7);
  const first = resolvePropsPatch(base, patch1);
  assert.equal(first.kind, "apply");
  const second = resolvePropsPatch(first.kind === "apply" ? first.next : null, patch2);
  assert.equal(second.kind, "apply");
  if (second.kind === "apply") assert.deepEqual(second.next.config, mapOf("a", "b", "c"));
});

test("an old patch is ignored, and a gap or unknown base asks for the full map", () => {
  const base = { config: mapOf("a", "b"), configVersion: 7, revision: 5 };
  assert.equal(resolvePropsPatch(base, buildMapPropsPatch(mapOf("a"), mapOf("a", "b"), 4, 5, 7)).kind, "stale");
  assert.equal(resolvePropsPatch(base, buildMapPropsPatch(mapOf("a", "b"), mapOf("a", "b", "c"), 6, 7, 7)).kind, "resync");
  assert.equal(resolvePropsPatch(null, buildMapPropsPatch(mapOf("a"), mapOf("a", "b"), 1, 2, 7)).kind, "resync");
  assert.equal(resolvePropsPatch({ config: mapOf("a"), configVersion: 7 }, buildMapPropsPatch(mapOf("a"), mapOf("a", "b"), 1, 2, 7)).kind, "resync");
  assert.equal(resolvePropsPatch(base, { nonsense: true }).kind, "resync");
});
