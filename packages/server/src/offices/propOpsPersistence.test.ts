import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { ROOM_PROP_CATALOG, type RoomLayoutProp } from "@gammyverse/shared";
import { applyOfficePropOps } from "./repository.js";

const floor = ROOM_PROP_CATALOG.find((item) => item.placementClass === "floor" && !item.wallMounted && !item.vehicleId)!;
const make = (id: string, x: number, z = 0) => ({ id, asset: floor.asset, x, z, rotation: 0, collision: floor.collision === true, width: floor.width, depth: floor.depth }) as unknown as RoomLayoutProp;

class Seam {
  props: unknown[]; version = 4; queries: string[] = [];
  constructor(initial: RoomLayoutProp[]) { this.props = initial; }
  async query(sql: string, values: unknown[] = []) {
    this.queries.push(sql.split(/\s+/)[0]!);
    if (sql.startsWith("SELECT config ")) return { rows: [{ config: { version: 1, layout: { dimensions: { width: 100, depth: 100 }, props: [] } } }] };
    if (sql.startsWith("SELECT props")) return { rows: [{ props: this.props, config_version: this.version }] };
    if (sql.startsWith("UPDATE app_office_props")) { this.props = JSON.parse(String(values[1])); this.version += 1; return { rows: [{ config_version: this.version }] }; }
    return { rows: [] };
  }
  dependencies() {
    const store = { query: this.query.bind(this), connect: async () => ({ query: this.query.bind(this), release() {} }) } as unknown as Pool;
    return { store, role: async () => "user" };
  }
}
const ids = (seam: Seam) => (seam.props as RoomLayoutProp[]).map((prop) => prop.id);

test("two members saving from the same old copy both succeed and the version moves once each", async () => {
  const seam = new Seam([make("a", 0), make("b", 3), make("c", 6)]);
  const a = await applyOfficePropOps("alice", "o", { ops: [{ op: "upsert", prop: make("a", 10), base: make("a", 0) }, { op: "remove", id: "c", base: make("c", 6) }] }, false, seam.dependencies());
  const b = await applyOfficePropOps("bob", "o", { ops: [{ op: "upsert", prop: make("b", 12), base: make("b", 3) }, { op: "upsert", prop: make("d", 20) }] }, false, seam.dependencies());
  assert.deepEqual([a.applied, a.conflicts.length, a.configVersion, b.applied, b.conflicts.length, b.configVersion], [2, 0, 5, 2, 0, 6]);
  assert.deepEqual(ids(seam), ["a", "b", "d"]);
  assert.deepEqual((seam.props as RoomLayoutProp[]).map((prop) => prop.x), [10, 12, 20]);
});

test("a conflicting edit is reported, the rest still saves, and an all-conflict request changes nothing", async () => {
  const seam = new Seam([make("a", 9), make("b", 3)]);
  const mixed = await applyOfficePropOps("bob", "o", { ops: [{ op: "upsert", prop: make("a", 1), base: make("a", 0) }, { op: "upsert", prop: make("b", 4), base: make("b", 3) }] }, false, seam.dependencies());
  assert.deepEqual([mixed.applied, mixed.conflicts.map((item) => item.id), mixed.configVersion], [1, ["a"], 5]);
  const version = seam.version;
  const none = await applyOfficePropOps("bob", "o", { ops: [{ op: "upsert", prop: make("a", 1), base: make("a", 0) }] }, false, seam.dependencies());
  assert.deepEqual([none.applied, none.configVersion, seam.version], [0, version, version], "no version bump when nothing applied");
});

test("the merged props still go through the full validation and a bad change saves nothing", async () => {
  const seam = new Seam([make("a", 0)]);
  const before = JSON.stringify(seam.props);
  await assert.rejects(applyOfficePropOps("bob", "o", { ops: [{ op: "upsert", prop: make("far", 5000) }] }, false, seam.dependencies()), /outside/);
  await assert.rejects(applyOfficePropOps("bob", "o", { ops: [{ op: "upsert", prop: { id: "x", asset: "no-such-asset", x: 0, z: 0, rotation: 0 } }] }, false, seam.dependencies()), /unsupported|malformed/);
  assert.equal(JSON.stringify(seam.props), before);
  assert.equal(seam.version, 4);
  assert.ok(seam.queries.includes("ROLLBACK"));
});

test("a stranger cannot apply changes", async () => {
  const seam = new Seam([make("a", 0)]);
  const dependencies = { ...seam.dependencies(), role: async () => null };
  await assert.rejects(applyOfficePropOps("eve", "o", { ops: [{ op: "remove", id: "a" }] }, false, dependencies as never), /access denied/);
});

// A pool of one connection: asking for a second connection while holding the first would
// hang forever, which is how the load test starved the real pool.
class SingleConnectionSeam extends Seam {
  held = false; commits = 0; maxQueued = 0; starved = false;
  override async query(sql: string, values: unknown[] = []) {
    if (sql.startsWith("COMMIT")) this.commits += 1;
    return super.query(sql, values);
  }
  override dependencies() {
    const direct = this.query.bind(this);
    const store = {
      query: async (sql: string, values?: unknown[]) => { if (this.held) { this.starved = true; throw new Error("pool starved"); } return direct(sql, values); },
      connect: async () => {
        if (this.held) { this.starved = true; throw new Error("pool starved"); }
        this.held = true;
        return { query: direct, release: () => { this.held = false; } };
      },
    } as unknown as Pool;
    return { store, role: async () => "user" };
  }
}

test("a crowd of simultaneous saves is committed in a few batches without starving the connection pool", async () => {
  const seam = new SingleConnectionSeam([make("shared", 0)]);
  const dependencies = seam.dependencies();
  const editors = Array.from({ length: 40 }, (_, index) => applyOfficePropOps(`u${index}`, "crowd", { ops: [
    { op: "upsert", prop: make(`own-${index}`, index) },
    ...(index % 4 === 0 ? [{ op: "upsert", prop: make("shared", 10 + index * 0.1), base: make("shared", 0) }] : []),
  ] }, false, dependencies as never));
  const results = await Promise.all(editors);
  assert.equal(seam.starved, false, "no request asked for a second connection while holding one");
  assert.ok(seam.commits <= 3, `expected a few group commits, got ${seam.commits}`);
  assert.equal((seam.props as RoomLayoutProp[]).length, 41);
  assert.equal(results.every((result) => result.applied >= 1), true);
  const conflicted = results.filter((result) => result.conflicts.length > 0).length;
  assert.equal(conflicted, 9, "ten editors tried to move the shared prop from the same copy; exactly one wins");
  assert.equal((seam.props as RoomLayoutProp[]).find((prop) => prop.id === "shared")!.x >= 10, true);
});

test("one invalid request in a batch fails alone and everyone else still saves", async () => {
  const seam = new SingleConnectionSeam([make("a", 0)]);
  const dependencies = seam.dependencies();
  const outcomes = await Promise.allSettled([
    applyOfficePropOps("u1", "mixed", { ops: [{ op: "upsert", prop: make("good-1", 1) }] }, false, dependencies as never),
    applyOfficePropOps("u2", "mixed", { ops: [{ op: "upsert", prop: make("far-away", 9999) }] }, false, dependencies as never),
    applyOfficePropOps("u3", "mixed", { ops: [{ op: "upsert", prop: make("good-3", 3) }] }, false, dependencies as never),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ["fulfilled", "rejected", "fulfilled"]);
  assert.deepEqual(ids(seam).sort(), ["a", "good-1", "good-3"]);
});
