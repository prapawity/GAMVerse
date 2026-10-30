import assert from "node:assert/strict";
import test from "node:test";
import { resolveHeldMovement, type HeldMovementFrame } from "./heldMovement";
import { CHARACTER_TURN_FIRST_FRAME_S, CHARACTER_TURN_RATE_RAD_PER_S, advanceLockedTurn } from "./lockedMovement";

const TEST_CAMERA_YAW_RAD = Math.PI / 2;
const TEST_NOW_MS = 100;
const ROTATION_TOLERANCE_RAD = 1e-9;
const FRAME: HeldMovementFrame = {
  keys: new Set(["KeyW"]), map2d: false, firstPerson: false, behindCharacter: true,
  cameraYawRad: TEST_CAMERA_YAW_RAD, playerRotationRad: 0, driving: false,
  nowMs: TEST_NOW_MS, lockedTurn: null,
};

test("2D movement is north-up even when 3D camera is locked behind character", () => {
  const north = resolveHeldMovement({ ...FRAME, map2d: true });
  assert.equal(north.input.x, 0);
  assert.equal(north.input.z, -1);
  assert.equal(north.input.facingYaw, undefined);
  const east = resolveHeldMovement({ ...FRAME, keys: new Set(["KeyD"]), map2d: true });
  assert.equal(east.input.x, 1);
  assert.ok(Math.abs(east.input.z) < ROTATION_TOLERANCE_RAD);
  assert.equal(east.lockedTurn, null);
});

test("locked 3D walks along heading and A/D turns it", () => {
  const walking = resolveHeldMovement(FRAME);
  assert.ok(Math.abs(walking.input.x) < ROTATION_TOLERANCE_RAD);
  assert.equal(walking.input.z, 1);
  assert.equal(walking.input.facingYaw, 0);
  const turning = resolveHeldMovement({ ...FRAME, keys: new Set(["KeyD"]) });
  assert.ok(Math.abs((turning.input.facingYaw ?? 0) + CHARACTER_TURN_RATE_RAD_PER_S * CHARACTER_TURN_FIRST_FRAME_S) < ROTATION_TOLERANCE_RAD);
  assert.equal(turning.input.x, 0);
  assert.equal(turning.input.z, 0);
  assert.ok(turning.lockedTurn);
});

test("unlocked 3D stays camera-relative and FPP retains aim yaw", () => {
  const free = resolveHeldMovement({ ...FRAME, behindCharacter: false });
  assert.equal(free.input.x, -1);
  assert.ok(Math.abs(free.input.z) < ROTATION_TOLERANCE_RAD);
  assert.equal(free.input.facingYaw, undefined);
  const fpp = resolveHeldMovement({ ...FRAME, firstPerson: true });
  assert.equal(fpp.input.facingYaw, TEST_CAMERA_YAW_RAD + Math.PI);
  assert.equal(fpp.lockedTurn, null);
});


test("driving stays camera-relative while behind-character mode is enabled", () => {
  const driving = resolveHeldMovement({ ...FRAME, driving: true, keys: new Set(["KeyD"]) });
  assert.ok(Math.abs(driving.input.x) < ROTATION_TOLERANCE_RAD);
  assert.equal(driving.input.z, -1);
  assert.equal(driving.input.facingYaw, undefined);
  assert.equal(driving.lockedTurn, null);
});

function holdTurn(direction: -1 | 1, frameMs: number, durationMs: number) {
  let state = null as ReturnType<typeof advanceLockedTurn>;
  for (let elapsedMs = 0; elapsedMs <= durationMs; elapsedMs += frameMs) state = advanceLockedTurn(state, direction, 0, TEST_NOW_MS + elapsedMs);
  return state!;
}

test("holding a turn key rotates at a constant rate, whatever the frame rate", () => {
  const turned = (frameMs: number) => Math.abs(holdTurn(1, frameMs, 500).rotationRad);
  const expected = CHARACTER_TURN_RATE_RAD_PER_S * 0.5 + CHARACTER_TURN_RATE_RAD_PER_S * CHARACTER_TURN_FIRST_FRAME_S;
  for (const frameMs of [8, 16, 33, 50]) assert.ok(Math.abs(turned(frameMs) - expected) < CHARACTER_TURN_RATE_RAD_PER_S * 0.05, `${frameMs} ms frames`);
});

test("a turn is smooth: no frame moves the heading by more than the rate allows", () => {
  let state = null as ReturnType<typeof advanceLockedTurn>;
  let previous = 0;
  for (let frame = 0; frame < 60; frame += 1) {
    state = advanceLockedTurn(state, -1, 0, TEST_NOW_MS + frame * 16);
    assert.ok(Math.abs(state!.rotationRad - previous) <= CHARACTER_TURN_RATE_RAD_PER_S * 0.02, `frame ${frame}`);
    previous = state!.rotationRad;
  }
  assert.ok(previous > 2, "the heading keeps advancing while the key is held");
});

test("releasing the key keeps the heading, reversing turns the other way, and a long stall cannot spin the character", () => {
  const held = holdTurn(1, 16, 400);
  assert.equal(advanceLockedTurn(held, 0, 0, TEST_NOW_MS + 450)!.rotationRad, held.rotationRad);
  const back = advanceLockedTurn(held, -1, 0, held.lastStepAtMs + 16)!;
  assert.ok(back.rotationRad > held.rotationRad);
  const stalled = advanceLockedTurn(held, 1, 0, held.lastStepAtMs + 900)!;
  assert.ok(Math.abs(stalled.rotationRad - held.rotationRad) <= CHARACTER_TURN_RATE_RAD_PER_S * 0.1 + 1e-9);
});
