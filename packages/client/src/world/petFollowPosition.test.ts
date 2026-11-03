import assert from "node:assert/strict";
import test from "node:test";
import { petFollowSide, petFollowTarget, updatePetFollowPosition } from "./petFollowPosition";

test("pet follow motion eases normally but snaps to its current owner after 2D", () => {
  const current = { x: 0, z: 0 };
  updatePetFollowPosition(current, { x: 10, z: -4 }, 1 / 60, false);
  assert.deepEqual(current, { x: 1.2, z: -0.48 });
  updatePetFollowPosition(current, { x: 80, z: 32 }, 0.05, true);
  assert.deepEqual(current, { x: 80, z: 32 });
});

test("2D and 3D pet targets use the same stable side and follow distance", () => {
  const id = "session-123";
  const side = petFollowSide(id);
  const target = petFollowTarget({ x: 4, z: -2 }, Math.PI / 2, id);
  assert.equal(Math.sign(target.z + 2), -side);
  assert.ok(Math.abs(Math.hypot(target.x - 4, target.z + 2) - 1.3) < 1e-9);
});
