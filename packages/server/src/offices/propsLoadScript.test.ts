import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { ROOM_PROP_CATALOG, type RoomLayoutProp } from "@gammyverse/shared";
import { applyOfficePropOps } from "./repository.js";

// The load-test script is plain ESM outside the TypeScript project, so load it dynamically.
const scriptUrl = new URL("../../../../scripts/props-load-test/propsEditorsCore.mjs", import.meta.url).href;

const floor = ROOM_PROP_CATALOG.find((item) => item.asset.startsWith("kit:") && !item.asset.includes("mirror") && item.placementClass === "floor" && !item.wallMounted && !item.vehicleId)!;
const seed = { id: "template", asset: floor.asset, x: 5, z: 5, rotation: 0, collision: floor.collision === true, width: floor.width, depth: floor.depth } as unknown as RoomLayoutProp;

class Seam {
  props: unknown[] = [seed]; version = 1;
  async query(sql: string, values: unknown[] = []) {
    if (sql.startsWith("SELECT config ")) return { rows: [{ config: { version: 1, layout: { dimensions: { width: 200, depth: 200 }, props: [] } } }] };
    if (sql.startsWith("SELECT props")) return { rows: [{ props: this.props, config_version: this.version }] };
    if (sql.startsWith("UPDATE app_office_props")) { this.props = JSON.parse(String(values[1])); this.version += 1; return { rows: [{ config_version: this.version }] }; }
    return { rows: [] };
  }
}

test("the load-test script's editors keep every private prop where they last saw it, with real conflicts on shared props, and clean up", async () => {
  const { runPropsEditorsLoad } = await import(scriptUrl) as { runPropsEditorsLoad(options: Record<string, unknown>): Promise<{ saves: number; conflicts: { changed: number }; verify: { ok: boolean; missing: number; wrongPosition: number } }> };
  const seam = new Seam();
  const dependencies = { store: { query: seam.query.bind(seam), connect: async () => ({ query: seam.query.bind(seam), release() {} }) } as unknown as Pool, role: async () => "user" };
  let lock: Promise<unknown> = Promise.resolve();
  const request = (_editor: number, method: string, path: string, body?: unknown) => {
    const run = lock.then(async () => {
      if (method === "GET") return { status: 200, body: { props: JSON.parse(JSON.stringify(seam.props)), configVersion: seam.version } };
      return { status: 200, body: await applyOfficePropOps("alice", "o", body, false, dependencies as never) };
    });
    lock = run.catch(() => undefined);
    return run;
  };
  const messages: string[] = [];
  const report = await runPropsEditorsLoad({ request, editors: 40, durationMs: 1_500, meanSaveIntervalMs: 60, hotProps: 4, hotShare: 0.5, seed: 7, runId: "t", log: (line: string) => messages.push(line) });
  assert.ok(report.saves > 200, `expected plenty of saves, got ${report.saves}`);
  assert.ok(report.conflicts.changed > 0, "stale edits of shared props must conflict");
  assert.deepEqual([report.verify.ok, report.verify.missing, report.verify.wrongPosition], [true, 0, 0]);
  assert.deepEqual((seam.props as RoomLayoutProp[]).map((prop) => prop.id), ["template"], "every test prop is removed afterwards");
  assert.ok(messages.some((line) => line.startsWith("cleanup:")));
});
