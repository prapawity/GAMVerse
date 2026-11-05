import assert from "node:assert/strict";
import test from "node:test";
import { PlayerState, type Position } from "@gammyverse/shared";
import { OfficeRoom } from "./OfficeRoom.js";

test("follow reports the target while routing and matches their sprint and driving speeds", async (t) => {
  const room = new OfficeRoom();
  t.mock.method(room, "setMetadata", async () => {});
  t.mock.method(room, "setFixedTimestep", () => {});
  t.mock.method(room, "onMessage", () => () => {});
  t.mock.method(room, "broadcast", () => {});
  t.mock.method(console, "info", () => {});
  let nowMs = 1000;
  t.mock.method(performance, "now", () => nowMs);
  await room.onCreate({ officeId: "00000000-0000-4000-8000-000000000007" });
  t.after(() => { room.onDispose(); room.clock.stop(); });
  const internals = room as unknown as {
    applyMapConfig(config: unknown, version: number): void;
    startFollowing(followerId: string, targetId: string): void;
    stopFollowing(followerId: string): void;
    searchRoute(): Promise<Position[]>;
    routeSessionIsActive(): boolean;
    step(deltaSeconds: number): void;
    world: { movementSpeed: number };
    movementInputs: Map<string, { x: number; z: number; sprint: boolean; receivedAt: number }>;
    autoRoutes: Map<string, { points: Position[]; index: number; stalledTicks: number; driveSpeedMps?: number }>;
  };
  internals.applyMapConfig({ version: 1, layout: { version: 1, dimensions: { width: 50, depth: 50 }, props: [], zones: [], walls: [], doors: [] } }, 2);
  t.mock.method(internals, "routeSessionIsActive", () => true);
  let completeRoute!: (points: Position[]) => void;
  t.mock.method(internals, "searchRoute", () => new Promise<Position[]>(resolve => { completeRoute = resolve; }));
  const follower = new PlayerState();
  const target = new PlayerState();
  follower.presence = target.presence = "online";
  follower.x = follower.z = target.z = 0;
  target.displayName = "Rin";
  target.x = 15;
  room.state.players.set("follower", follower);
  room.state.players.set("target", target);
  const statuses: unknown[] = [];
  room.clients.push({ sessionId: "follower", send(event: string, payload: unknown) {
    if (event === "follow-status") statuses.push(payload);
  } } as never);

  target.vehicleId = "test-vehicle";
  internals.startFollowing("follower", "target");
  assert.deepEqual(statuses, [{ status: "started", targetSessionId: "target", targetName: "Rin" }]);
  nowMs += 200;
  target.x = 16;
  completeRoute([{ x: 0, z: 0 }, { x: 12, z: 0 }]);
  await Promise.resolve();
  target.vehicleId = "";
  internals.step(0.02);
  assert.equal(internals.autoRoutes.get("follower")?.index, 1);

  const assertStepSpeed = (speedMps: number) => {
    const before = follower.x;
    internals.step(0.02);
    assert.ok(Math.abs((follower.x - before) / 0.02 - speedMps) < 0.001);
  };
  const baseSpeed = internals.world.movementSpeed;
  assertStepSpeed(baseSpeed * 1.5);
  internals.movementInputs.set("target", { x: 1, z: 0, sprint: true, receivedAt: performance.now() });
  assertStepSpeed(baseSpeed * 3);
  target.vehicleId = "test-vehicle";
  assertStepSpeed(baseSpeed * 10);
  internals.autoRoutes.set("target", { points: [{ x: 20, z: 0 }], index: 0, stalledTicks: 0, driveSpeedMps: 24 });
  assertStepSpeed(24);
  target.vehicleId = "";
  internals.movementInputs.delete("target");
  assertStepSpeed(baseSpeed * 1.5);
  internals.stopFollowing("follower");
  assert.deepEqual(statuses.at(-1), { status: "stopped", targetSessionId: "target" });
  assert.equal(internals.autoRoutes.has("follower"), false);
});
