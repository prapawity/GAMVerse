import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_PROP_CATALOG, type RoomLayout, type RoomLayoutProp } from "@gammyverse/shared";
import { classifyMapChange, findNearestWalkable, worldGeometrySignature } from "./mapChangeImpact.js";
import { coalescedByKey } from "./coalescedRefresh.js";

const definition = (predicate: (item: (typeof ROOM_PROP_CATALOG)[number]) => boolean) => ROOM_PROP_CATALOG.find(predicate)!;
const DECORATION = definition(item => item.collision === false && !item.interaction && !item.vehicleId && !item.wallMounted);
const BLOCKER = definition(item => item.collision === true && !item.interaction && !item.vehicleId);
const SEAT = definition(item => item.interaction === "sit");
const prop = (id: string, entry: { asset: string; width: number; depth: number; collision?: boolean }, x = 0, z = 0): RoomLayoutProp =>
  ({ id, asset: entry.asset, x, z, width: entry.width, depth: entry.depth, rotation: 0, collision: entry.collision === true });
const layout = (props: RoomLayoutProp[], extra: Partial<RoomLayout> = {}): RoomLayout => ({ version: 1, props, zones: [], walls: [], doors: [], ...extra });

test("moving or adding a non-colliding decoration changes the world but not navigation or seats", () => {
  const before = layout([prop("a", DECORATION)]);
  const moved = classifyMapChange(before, layout([prop("a", DECORATION, 3, 3)]));
  assert.deepEqual(moved, { worldGeometryChanged: true, navigationChanged: false, seatsChanged: false, changedPropIds: ["a"] });
  const added = classifyMapChange(before, layout([prop("a", DECORATION), prop("b", DECORATION, 1, 1)]));
  assert.equal(added.navigationChanged, false);
  assert.deepEqual(added.changedPropIds, ["b"]);
});

test("colliding props, seats, walls and zones invalidate navigation", () => {
  const empty = layout([]);
  assert.equal(classifyMapChange(empty, layout([prop("wall", BLOCKER)])).navigationChanged, true);
  assert.equal(classifyMapChange(layout([prop("wall", BLOCKER)]), empty).navigationChanged, true, "removing a blocker also reopens routes");
  const seat = classifyMapChange(empty, layout([prop("chair", SEAT)]));
  assert.equal(seat.seatsChanged, true);
  assert.equal(seat.navigationChanged, true);
  const zone = { id: "z", kind: "meeting" as const, name: "Z", x: 0, z: 0, width: 2, depth: 2, color: "#fff" };
  assert.equal(classifyMapChange(empty, layout([], { zones: [zone] })).navigationChanged, true);
  const reassigned = classifyMapChange(layout([], { zones: [{ ...zone, kind: "private", ownerUsername: "alice" }] }), layout([], { zones: [{ ...zone, kind: "private", ownerUsername: "bob" }] }));
  assert.equal(reassigned.navigationChanged, true, "a desk changing owner cancels desk walks");
  assert.equal(reassigned.worldGeometryChanged, false, "but it is not a geometry change");
});

test("an identical layout is a no-op and agrees with the geometry signature", () => {
  const same = layout([prop("a", DECORATION), prop("b", BLOCKER, 2, 2)]);
  const copy = layout([prop("b", BLOCKER, 2, 2), prop("a", DECORATION)]);
  assert.deepEqual(classifyMapChange(same, copy), { worldGeometryChanged: false, navigationChanged: false, seatsChanged: false, changedPropIds: [] });
  assert.equal(worldGeometrySignature(same), worldGeometrySignature(copy), "prop order must not matter");
  const changed = layout([prop("a", DECORATION, 1, 0), prop("b", BLOCKER, 2, 2)]);
  assert.notEqual(worldGeometrySignature(same), worldGeometrySignature(changed));
  assert.equal(classifyMapChange(same, changed).worldGeometryChanged, true);
});

test("nearest walkable point stays close, avoids occupied spots and gives up when boxed in", () => {
  const open = { width: 40, depth: 40, playerRadius: 0.4, proximityRadius: 4, spawnPoints: [{ x: -15, z: -15 }], walls: [], obstacles: [] } as never;
  const found = findNearestWalkable({ x: 0, z: 0 }, [], open);
  assert.ok(found && Math.hypot(found.x, found.z) <= 1, "first free ring is used");
  const crowded = findNearestWalkable({ x: 0, z: 0 }, [found!], open);
  assert.ok(crowded && Math.hypot(crowded.x - found!.x, crowded.z - found!.z) >= 0.9);
  const sealed = { ...(open as object), obstacles: [{ x: 0, z: 0, width: 80, depth: 80 }] } as never;
  assert.equal(findNearestWalkable({ x: 0, z: 0 }, [], sealed), null);
});

test("coalesced refresh: one run in flight, one trailing run for a burst, later callers see later data", async () => {
  const starts: string[] = [];
  const gates: Array<() => void> = [];
  const refresh = coalescedByKey<string>((key) => new Promise<void>((resolve) => { starts.push(key); gates.push(resolve); }));
  const first = refresh("office");
  const burst = [refresh("office"), refresh("office"), refresh("office")];
  const other = refresh("other-office");
  await Promise.resolve();
  assert.deepEqual(starts, ["office", "other-office"], "burst has not started a second run yet");
  gates[0]!(); await first;
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(starts, ["office", "other-office", "office"], "exactly one trailing run serves the whole burst");
  gates[2]!(); await Promise.all(burst);
  gates[1]!(); await other;
  assert.equal(starts.length, 3);
  const again = refresh("office");
  await Promise.resolve();
  assert.equal(starts.length, 4, "idle key starts immediately");
  gates[3]!(); await again;
});

test("coalesced refresh: failures reach their own waiters and do not wedge the key", async () => {
  let calls = 0;
  const refresh = coalescedByKey<string>(async () => { calls += 1; if (calls === 1) throw new Error("db down"); });
  await assert.rejects(refresh("office"), /db down/);
  await refresh("office");
  assert.equal(calls, 2);
});
