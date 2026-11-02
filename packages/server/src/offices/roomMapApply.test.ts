import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { PlayerState, ROOM_PROP_CATALOG, isPositionWalkable } from "@gammyverse/shared";
import { OfficeRoom } from "./OfficeRoom.js";

const DECORATION = ROOM_PROP_CATALOG.find(item => item.collision === false && !item.interaction && !item.vehicleId && !item.wallMounted)!;
const BLOCKER = ROOM_PROP_CATALOG.find(item => item.collision === true && !item.interaction && !item.vehicleId && item.width >= 1.2)!;
const prop = (id: string, entry: typeof DECORATION, x: number, z: number) => ({ id, asset: entry.asset, x, z, width: entry.width, depth: entry.depth, rotation: 0, collision: entry.collision === true });
const config = (props: unknown[]) => ({ version: 1, layout: { version: 1, props, zones: [], walls: [], doors: [], dimensions: { width: 60, depth: 60 } } });

type Internals = {
  mapLayout: unknown; mapConfig: unknown; world: Parameters<typeof isPositionWalkable>[1];
  navigationGeometryRevision: number; worldVersion: number; autoRoutes: Map<string, { deskZoneId?: string }>;
  applyMapConfig(config: unknown, version: number): void;
};

function fixture() {
  const room = new OfficeRoom();
  const internals = room as unknown as Internals;
  const events: { event: string; payload: unknown }[] = [];
  mock.method(room, "broadcast", (event: string, payload: unknown) => { events.push({ event, payload }); });
  const initial = config([prop("sign", DECORATION, 10, 10)]);
  internals.applyMapConfig(initial, 1);
  events.length = 0;
  return { room, internals, events, cleanup() { room.clock.stop(); mock.restoreAll(); } };
}

test("saving a decoration keeps desk walks and routes alive but still broadcasts the new map", () => {
  const f = fixture();
  try {
    f.internals.autoRoutes.set("walker", { deskZoneId: "desk" });
    const revision = f.internals.navigationGeometryRevision;
    f.internals.applyMapConfig(config([prop("sign", DECORATION, 12, 10), prop("sign-2", DECORATION, -5, -5)]), 2);
    assert.equal(f.internals.autoRoutes.has("walker"), true, "a desk walk survives an unrelated decoration");
    assert.equal(f.internals.navigationGeometryRevision, revision, "route caches are not thrown away");
    assert.equal(f.events.filter(entry => entry.event === "office-map").length, 0, "the whole map is not resent for a props-only save");
    const patches = f.events.filter(entry => entry.event === "props-changed");
    assert.equal(patches.length, 1, "everyone still receives the change, as a patch");
    const patch = patches[0]!.payload as { baseRevision: number; revision: number; configVersion: number; upsert: { id: string }[]; removed: string[] };
    assert.deepEqual({ base: patch.baseRevision, revision: patch.revision, version: patch.configVersion, removed: patch.removed }, { base: 1, revision: 2, version: 2, removed: [] });
    assert.deepEqual(patch.upsert.map(item => item.id), ["sign", "sign-2"]);
  } finally { f.cleanup(); }
});

test("props-only saves that keep the same map configVersion still produce ordered patches", () => {
  // Regression: a props save does not change the map's configVersion, so patches must be ordered by revision.
  const f = fixture();
  try {
    f.internals.applyMapConfig(config([prop("sign", DECORATION, 10, 10), prop("a", DECORATION, 1, 1)]), 1);
    f.internals.applyMapConfig(config([prop("sign", DECORATION, 10, 10), prop("a", DECORATION, 1, 1), prop("b", DECORATION, 2, 2)]), 1);
    const patches = f.events.filter(entry => entry.event === "props-changed").map(entry => entry.payload as { baseRevision: number; revision: number; configVersion: number });
    assert.deepEqual(patches.map(patch => [patch.baseRevision, patch.revision, patch.configVersion]), [[1, 2, 1], [2, 3, 1]]);
  } finally { f.cleanup(); }
});

test("full map messages carry the room revision so clients can order later patches", () => {
  const f = fixture();
  try {
    const next = config([prop("sign", DECORATION, 10, 10)]);
    (next.layout as { walls: unknown[] }).walls = [{ id: "w1", axis: "horizontal", x: 0, z: 0, length: 4, thickness: 0.2, height: 2.4 }];
    f.internals.applyMapConfig(next, 2);
    const full = f.events.find(entry => entry.event === "office-map")!.payload as { revision: number; configVersion: number };
    assert.deepEqual([full.revision, full.configVersion], [2, 2]);
  } finally { f.cleanup(); }
});

test("saving anything besides props still sends the full map", () => {
  const f = fixture();
  try {
    const next = config([prop("sign", DECORATION, 10, 10)]);
    (next.layout as { walls: unknown[] }).walls = [{ id: "w1", axis: "horizontal", x: 0, z: 0, length: 4, thickness: 0.2, height: 2.4 }];
    f.internals.applyMapConfig(next, 2);
    assert.equal(f.events.filter(entry => entry.event === "office-map").length, 1);
    assert.equal(f.events.filter(entry => entry.event === "props-changed").length, 0);
  } finally { f.cleanup(); }
});

test("saving a blocking prop still cancels desk walks and bumps the navigation revision", () => {
  const f = fixture();
  try {
    f.internals.autoRoutes.set("walker", { deskZoneId: "desk" });
    const revision = f.internals.navigationGeometryRevision;
    f.internals.applyMapConfig(config([prop("sign", DECORATION, 10, 10), prop("wall", BLOCKER, 20, 20)]), 2);
    assert.equal(f.internals.autoRoutes.has("walker"), false);
    assert.equal(f.internals.navigationGeometryRevision, revision + 1);
  } finally { f.cleanup(); }
});

test("a player under a newly placed blocker steps aside nearby and is not disconnected", () => {
  const f = fixture();
  try {
    const left: unknown[] = [];
    const player = new PlayerState(); player.presence = "online"; player.x = 0; player.z = 0;
    f.room.state.players.set("walker", player);
    f.room.clients.push({ sessionId: "walker", send() {}, leave: (...args: unknown[]) => { left.push(args); } } as never);
    f.internals.applyMapConfig(config([prop("sign", DECORATION, 10, 10), prop("wall", BLOCKER, 0, 0)]), 2);
    assert.equal(left.length, 0, "no disconnect");
    assert.equal(f.room.state.players.has("walker"), true);
    assert.ok(Math.hypot(player.x, player.z) < 6, `moved only a short way, got (${player.x}, ${player.z})`);
    assert.equal(isPositionWalkable({ x: player.x, z: player.z }, f.internals.world), true);
  } finally { f.cleanup(); }
});
