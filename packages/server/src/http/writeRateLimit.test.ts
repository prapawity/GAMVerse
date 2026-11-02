import assert from "node:assert/strict";
import test from "node:test";
import { createWriteRateLimiter } from "./writeRateLimit.js";

test("allows the limit per window, then reports how long to wait, then recovers", () => {
  let time = 1_000;
  const limiter = createWriteRateLimiter(3, 10_000, () => time);
  assert.deepEqual([1, 2, 3].map(() => limiter.check("alice")), [0, 0, 0]);
  assert.equal(limiter.check("alice"), 10);
  time += 4_000;
  assert.equal(limiter.check("alice"), 6);
  assert.equal(limiter.check("bob"), 0, "other people are unaffected");
  time += 6_000;
  assert.equal(limiter.check("alice"), 0);
});
