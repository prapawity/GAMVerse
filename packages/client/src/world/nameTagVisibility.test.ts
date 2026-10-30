import assert from "node:assert/strict";
import test from "node:test";
import { FPP_NAME_TAG_MAX_DISTANCE_M, shouldShowNameTag, type NameTagContext } from "./nameTagVisibility";

const BASE: NameTagContext = { isLocal: false, map2d: false, firstPerson: false, covered: false, distanceToCameraM: 10 };

test("a friend's name is shown in first person", () => {
  assert.equal(shouldShowNameTag({ ...BASE, firstPerson: true }), true);
});

test("your own tag is hidden in first person but shown in third person", () => {
  assert.equal(shouldShowNameTag({ ...BASE, firstPerson: true, isLocal: true }), false);
  assert.equal(shouldShowNameTag({ ...BASE, isLocal: true }), true);
});

test("first person hides names that are too far away, third person does not", () => {
  const far = FPP_NAME_TAG_MAX_DISTANCE_M + 1;
  assert.equal(shouldShowNameTag({ ...BASE, firstPerson: true, distanceToCameraM: far }), false);
  assert.equal(shouldShowNameTag({ ...BASE, distanceToCameraM: far }), true);
  assert.equal(shouldShowNameTag({ ...BASE, firstPerson: true, distanceToCameraM: FPP_NAME_TAG_MAX_DISTANCE_M }), true);
});

test("tags in closed rooms and in the 2D map stay hidden in every view", () => {
  for (const firstPerson of [false, true]) {
    assert.equal(shouldShowNameTag({ ...BASE, firstPerson, covered: true }), false);
    assert.equal(shouldShowNameTag({ ...BASE, firstPerson, map2d: true }), false);
  }
});
