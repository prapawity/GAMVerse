import assert from "node:assert/strict";
import test from "node:test";
import { createDomeSmoothers, enclosingCircle, groupDomeShape, proximityDomeEntries, proximityGroupMembers } from "./proximityGroupShape";

const LINK_RADIUS_M = 10;
const points = (entries: Record<string, [number, number]>) => new Map(Object.entries(entries).map(([id, [x, z]]) => [id, { x, z }]));

test("group members chain through hops and exclude people out of reach", () => {
  const all = points({ me: [0, 0], b: [8, 0], c: [16, 0], far: [60, 0] });
  assert.deepEqual(proximityGroupMembers("me", all, LINK_RADIUS_M).sort(), ["b", "c", "me"]);
  assert.deepEqual(proximityGroupMembers("nobody", all, LINK_RADIUS_M), []);
});

test("the enclosing circle contains every point", () => {
  const cloud = [{ x: 0, z: 0 }, { x: 12, z: 3 }, { x: -4, z: 9 }, { x: 5, z: -8 }, { x: 7, z: 7 }];
  const circle = enclosingCircle(cloud)!;
  for (const point of cloud) assert.ok(Math.hypot(point.x - circle.x, point.z - circle.z) <= circle.radius + 1e-9);
  assert.equal(enclosingCircle([]), null);
});

test("one shared dome covers the whole group, not just the local player", () => {
  const shape = groupDomeShape("me", points({ me: [0, 0], b: [8, 0], c: [16, 0], far: [60, 0] }), LINK_RADIUS_M)!;
  assert.ok(Math.abs(shape.x - 8) < 1e-9);
  for (const x of [0, 8, 16]) assert.ok(Math.abs(x - shape.x) < shape.radius);
  assert.ok(Math.abs(60 - shape.x) > shape.radius);
});

test("alone, the dome falls back to a circle around the player", () => {
  assert.deepEqual(groupDomeShape("me", points({ me: [3, 4], far: [90, 90] }), LINK_RADIUS_M), { x: 3, z: 4, radius: LINK_RADIUS_M });
});

test("every group of two or more gets a dome and only the local player's is own", () => {
  const all = points({ me: [0, 0], b: [8, 0], x: [60, 0], y: [66, 0], loner: [-80, 0] });
  const entries = proximityDomeEntries("me", all, LINK_RADIUS_M, true);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => entry.own), [true, false]);
  assert.ok(entries.every(entry => entry.key !== "loner"));
});

test("a grouped player with no visible neighbors still gets a fallback own dome", () => {
  const entries = proximityDomeEntries("me", points({ me: [3, 4], far: [90, 90] }), LINK_RADIUS_M, true);
  assert.deepEqual(entries.map(entry => [entry.own, entry.shape.radius]), [[true, LINK_RADIUS_M]]);
  assert.deepEqual(proximityDomeEntries("me", points({ me: [3, 4], far: [90, 90] }), LINK_RADIUS_M, false), []);
});

test("smoothers snap new domes, glide existing ones and forget dissolved groups", () => {
  const smooth = createDomeSmoothers();
  const at = (x: number, radius: number) => [{ key: "a", own: true, shape: { x, z: 0, radius } }];
  assert.deepEqual(smooth(at(0, 10), 0)[0]!.shape, { x: 0, z: 0, radius: 10 });
  const next = smooth(at(10, 20), 16)[0]!.shape;
  assert.ok(next.x > 0 && next.x < 10 && next.radius > 10 && next.radius < 20);
  assert.deepEqual(smooth([], 32), []);
  assert.deepEqual(smooth(at(5, 6), 48)[0]!.shape, { x: 5, z: 0, radius: 6 });
});
