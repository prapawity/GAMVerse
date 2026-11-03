import assert from "node:assert/strict";
import test from "node:test";
import { writeProximityDomePoints } from "./proximityDomePoints";

type Player = { x: number; z: number; presence?: "online" | "away"; hasDetailedPosition?: boolean };

test("dome topology uses detailed online positions outside media zones only", () => {
  const players = new Map([
    ["local", { x: 0, z: 0, presence: "online" as const, hasDetailedPosition: true }],
    ["near", { x: 3, z: 0, presence: "online" as const, hasDetailedPosition: true }],
    ["coarse", { x: 0, z: 0, presence: "online" as const, hasDetailedPosition: false }],
    ["away", { x: 1, z: 0, presence: "away" as const, hasDetailedPosition: true }],
    ["meeting", { x: 2, z: 0, presence: "online" as const, hasDetailedPosition: true }],
  ]);
  const output = new Map<string, Player>([["stale", { x: 99, z: 99, hasDetailedPosition: true }]]);
  const points = writeProximityDomePoints(output, players, player => player.x === 2);
  assert.equal(points, output);
  assert.deepEqual([...points.keys()], ["local", "near"]);
});
