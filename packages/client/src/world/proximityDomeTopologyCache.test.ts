import assert from "node:assert/strict";
import test from "node:test";
import { ProximityDomeTopologyCache } from "./proximityDomeTopologyCache";
import { proximityDomeEntries, type GroundPoint } from "./proximityGroupShape";

const LINK_RADIUS_M = 10;
const points = () => new Map<string, GroundPoint>([["me", { x: 0, z: 0 }], ["near", { x: 8, z: 0 }], ["chain", { x: 16, z: 0 }], ["far", { x: 80, z: 0 }]]);

test("unchanged snapshots reuse topology without rebuilding, including replacement maps", () => {
  const cache = new ProximityDomeTopologyCache();
  const first = cache.update("me", points(), LINK_RADIUS_M, true);
  for (let frame = 0; frame < 100; frame++) assert.equal(cache.update("me", points(), LINK_RADIUS_M, true), first);
  assert.equal(cache.rebuildCount, 1);
  assert.deepEqual(first, proximityDomeEntries("me", points(), LINK_RADIUS_M, true));
});

test("in-place position mutation and membership changes invalidate cached geometry", () => {
  const cache = new ProximityDomeTopologyCache();
  const source = points();
  const first = cache.update("me", source, LINK_RADIUS_M, true);
  source.get("near")!.x = 60;
  const split = cache.update("me", source, LINK_RADIUS_M, true);
  assert.notEqual(split, first);
  assert.deepEqual(split, proximityDomeEntries("me", source, LINK_RADIUS_M, true));
  source.delete("far");
  cache.update("me", source, LINK_RADIUS_M, true);
  source.set("new", { x: 5, z: 0 });
  assert.deepEqual(cache.update("me", source, LINK_RADIUS_M, true), proximityDomeEntries("me", source, LINK_RADIUS_M, true));
  assert.equal(cache.rebuildCount, 4);
});

test("local identity, radius, own-group fallback and clear invalidate correctly", () => {
  const cache = new ProximityDomeTopologyCache();
  const source = new Map([["me", { x: 3, z: 4 }]]);
  assert.deepEqual(cache.update("me", source, LINK_RADIUS_M, false), []);
  assert.deepEqual(cache.update("me", source, LINK_RADIUS_M, true), proximityDomeEntries("me", source, LINK_RADIUS_M, true));
  assert.deepEqual(cache.update("me", source, LINK_RADIUS_M / 2, true), proximityDomeEntries("me", source, LINK_RADIUS_M / 2, true));
  assert.deepEqual(cache.update(null, source, LINK_RADIUS_M, true), []);
  const beforeClear = cache.update("me", source, LINK_RADIUS_M, true);
  cache.clear();
  const afterClear = cache.update("me", source, LINK_RADIUS_M, true);
  assert.notEqual(afterClear, beforeClear);
  assert.deepEqual(afterClear, beforeClear);
});

test("unchanged explicit revision avoids scanning the points, while a new revision checks content", () => {
  const cache = new ProximityDomeTopologyCache();
  const source = points();
  const first = cache.update("me", source, LINK_RADIUS_M, true, 1);
  const unreadable = new Proxy(source, { get() { throw new Error("points scanned on an unchanged revision"); } });
  assert.equal(cache.update("me", unreadable, LINK_RADIUS_M, true, 1), first);
  assert.equal(cache.update("me", points(), LINK_RADIUS_M, true, 2), first);
  source.get("near")!.z = 20;
  assert.notEqual(cache.update("me", source, LINK_RADIUS_M, true, 3), first);
  assert.equal(cache.rebuildCount, 2);
});

test("point order changes rebuild because the enclosing circle and entry order follow iteration order", () => {
  const cache = new ProximityDomeTopologyCache();
  const source = points();
  const first = cache.update("me", source, LINK_RADIUS_M, true);
  const reordered = new Map([...source].reverse());
  const second = cache.update("me", reordered, LINK_RADIUS_M, true);
  assert.notEqual(second, first);
  assert.deepEqual(second, proximityDomeEntries("me", reordered, LINK_RADIUS_M, true));
});
