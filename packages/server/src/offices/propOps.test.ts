import assert from "node:assert/strict";
import test from "node:test";
import type { RoomLayoutProp } from "@gammyverse/shared";
import { MAX_PROP_OPS, mergePropOps, parsePropOps, samePropContent } from "./propOps.js";

const prop = (id: string, x = 0, extra: Record<string, unknown> = {}) => ({ id, asset: "kit:chair", x, z: 0, rotation: 0, collision: true, width: 1, depth: 1, ...extra }) as unknown as RoomLayoutProp;
const ids = (list: unknown[]) => list.map((item) => (item as { id: string }).id);

test("two members editing different props both land, with no conflict", () => {
  const current = [prop("a"), prop("b"), prop("c")];
  // Member 1 moved a and removed c; member 2 (still on the old copy) moved b and added d.
  const first = mergePropOps(current, parsePropOps([{ op: "upsert", prop: prop("a", 5), base: prop("a") }, { op: "remove", id: "c", base: prop("c") }]));
  const afterFirst = first.next as RoomLayoutProp[];
  const second = mergePropOps(afterFirst, parsePropOps([{ op: "upsert", prop: prop("b", 7), base: prop("b") }, { op: "upsert", prop: prop("d") }]));
  assert.deepEqual([first.conflicts, second.conflicts], [[], []]);
  assert.deepEqual(ids(second.next), ["a", "b", "d"]);
  assert.deepEqual((second.next as RoomLayoutProp[]).map((item) => item.x), [5, 7, 0]);
});

test("only the prop both members edited conflicts, and it reports the current version", () => {
  const afterOther = [prop("a", 9), prop("b")];
  const result = mergePropOps(afterOther, parsePropOps([{ op: "upsert", prop: prop("a", 3), base: prop("a") }, { op: "upsert", prop: prop("b", 4), base: prop("b") }]));
  assert.equal(result.applied, 1);
  assert.deepEqual(result.conflicts.map((item) => [item.id, item.reason, (item.current as RoomLayoutProp).x]), [["a", "changed", 9]]);
  assert.deepEqual((result.next as RoomLayoutProp[]).map((item) => item.x), [9, 4]);
});

test("editing something that was deleted, or deleting something that changed, conflicts; deleting twice does not", () => {
  const result = mergePropOps([prop("b", 2)], parsePropOps([
    { op: "upsert", prop: prop("a", 1), base: prop("a") },
    { op: "remove", id: "b", base: prop("b", 1) },
    { op: "remove", id: "gone", base: prop("gone") },
  ]));
  assert.deepEqual(result.conflicts.map((item) => [item.id, item.reason]), [["a", "removed"], ["b", "changed"]]);
  assert.equal(result.applied, 0);
});

test("sending the same request twice is harmless", () => {
  const ops = parsePropOps([{ op: "upsert", prop: prop("new", 3) }, { op: "upsert", prop: prop("a", 5), base: prop("a") }]);
  const once = mergePropOps([prop("a")], ops);
  const twice = mergePropOps(once.next as RoomLayoutProp[], ops);
  assert.deepEqual([twice.applied, twice.conflicts], [0, []]);
  assert.deepEqual(twice.next, once.next);
});

test("a new id that already exists with different content conflicts instead of overwriting", () => {
  const result = mergePropOps([prop("a", 1)], parsePropOps([{ op: "upsert", prop: prop("a", 2) }]));
  assert.deepEqual(result.conflicts.map((item) => item.reason), ["exists"]);
});

test("server-owned footprint fields and zero elevation do not count as differences", () => {
  assert.equal(samePropContent(prop("a", 0, { elevation: 0 }), { id: "a", asset: "kit:chair", x: 0, z: 0, rotation: 0 }), true);
  assert.equal(samePropContent(prop("a", 0, { elevation: 0.8 }), prop("a")), false);
});

test("malformed or oversized change lists are rejected", () => {
  assert.throws(() => parsePropOps([]));
  assert.throws(() => parsePropOps("x"));
  assert.throws(() => parsePropOps([{ op: "upsert", prop: { asset: "kit:chair" } }]));
  assert.throws(() => parsePropOps([{ op: "remove", id: "" }]));
  assert.throws(() => parsePropOps([{ op: "explode", id: "a" }]));
  assert.throws(() => parsePropOps(Array.from({ length: MAX_PROP_OPS + 1 }, () => ({ op: "remove", id: "a" }))));
});
