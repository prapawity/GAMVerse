import assert from "node:assert/strict";
import test from "node:test";
import { applyMapPropsPatch, buildMapPropsPatch, MAP_PROPS_PATCH_MAX_CHANGES } from "./mapPropsPatch.js";

const prop = (id: string, x = 0) => ({ id, asset: "kit:chair", x, z: 0, rotation: 0 });
const config = (props: unknown[], extra: Record<string, unknown> = {}) => ({ version: 1, layout: { props, zones: [{ id: "z1", name: "Z" }], walls: [], ...extra } });
const applied = (base: unknown, revision: number | undefined, patch: unknown, configVersion = 7) => applyMapPropsPatch({ config: base, configVersion, revision }, patch);
// The map's configVersion stays 7 for props-only saves; the revision is what moves.
const build = (before: unknown, after: unknown, baseRevision: number, revision: number) => buildMapPropsPatch(before, after, baseRevision, revision, 7);

test("a patch for added, moved and removed props rebuilds the next config exactly, in order", () => {
  const before = config([prop("a"), prop("b"), prop("c")]);
  const after = config([prop("a"), prop("b", 5), prop("d")]);
  const patch = build(before, after, 4, 5)!;
  assert.deepEqual(patch.removed, ["c"]);
  assert.deepEqual(patch.upsert.map((item) => (item as { id: string }).id), ["b", "d"]);
  assert.deepEqual(applied(before, 4, patch), { config: after, configVersion: 7, revision: 5 });
});

test("consecutive props-only saves apply even though the map's configVersion never changes", () => {
  // Regression: clients once ignored patches whose configVersion was not higher, so a saved prop only showed after a refresh.
  const v0 = config([prop("a")]);
  const v1 = config([prop("a"), prop("b")]);
  const v2 = config([prop("a"), prop("b"), prop("c")]);
  const first = applied(v0, 1, build(v0, v1, 1, 2))!;
  const second = applied(first.config, first.revision, build(v1, v2, 2, 3), first.configVersion)!;
  assert.deepEqual([first.configVersion, second.configVersion, second.revision], [7, 7, 3]);
  assert.deepEqual(second.config, v2);
});

test("a patch carries only what changed", () => {
  const props = Array.from({ length: 5000 }, (_, index) => prop(`p${index}`, index));
  const before = config(props);
  const after = config([...props, prop("new")]);
  const patch = build(before, after, 1, 2)!;
  assert.ok(JSON.stringify(patch).length < 400);
  assert.ok(JSON.stringify(before).length > 200_000);
});

test("no patch when anything besides props changed, or ids repeat, or order changes", () => {
  const before = config([prop("a"), prop("b")]);
  assert.equal(build(before, config([prop("a"), prop("b")], { walls: [{ id: "w" }] }), 1, 2), null);
  assert.equal(build(before, config([prop("b"), prop("a")]), 1, 2), null);
  assert.equal(build(config([prop("a"), prop("a")]), before, 1, 2), null);
  assert.equal(build(before, { version: 1 }, 1, 2), null);
  assert.equal(build(before, before, 3, 3), null);
});

test("no patch when too many props changed", () => {
  const many = Array.from({ length: MAP_PROPS_PATCH_MAX_CHANGES + 1 }, (_, index) => prop(`p${index}`));
  assert.equal(build(config([]), config(many), 1, 2), null);
});

test("a patch only applies on top of the revision it was built for", () => {
  const before = config([prop("a")]);
  const patch = build(before, config([prop("a"), prop("b")]), 4, 5)!;
  assert.equal(applied(before, 3, patch), null);
  assert.equal(applied(before, 5, patch), null);
  assert.equal(applied(before, undefined, patch), null, "a map received without a revision cannot take patches");
  assert.equal(applyMapPropsPatch(null, patch), null);
  assert.equal(applied(before, 4, { ...patch, upsert: "nope" }), null);
  assert.equal(applied(before, 4, { ...patch, upsert: [{ asset: "no-id" }] }), null);
});

test("a no-op save yields an empty patch that keeps the config", () => {
  const before = config([prop("a")]);
  const patch = build(before, config([prop("a")]), 2, 3)!;
  assert.deepEqual(patch.upsert, []);
  assert.deepEqual(applied(before, 2, patch)?.config, before);
});
