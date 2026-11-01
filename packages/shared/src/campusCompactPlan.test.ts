import assert from "node:assert/strict";
import test from "node:test";
import { generateCampusMap } from "./campusMapGenerator.js";
import { compactCivicLots, planCompactCampus } from "./campusCompactPlan.js";
import { roomZoneEntranceIssues } from "./index.js";

const overlaps = (a: { x: number; z: number; width: number; depth: number }, b: { x: number; z: number; width: number; depth: number }) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.01 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 0.01;

test("the compact plan keeps the map proportionate for 5 to 10 teams", () => {
  for (const teamCount of [5, 6, 7, 8, 9, 10]) for (const peoplePerTeam of [4, 10, 15]) {
    const plan = planCompactCampus(teamCount, peoplePerTeam);
    assert.ok(plan, `${teamCount} teams of ${peoplePerTeam} get a compact plan`);
    const ratio = plan.width / plan.depth;
    assert.ok(ratio >= 0.8 && ratio <= (peoplePerTeam < 10 ? 1.6 : 1.5), `${teamCount}×${peoplePerTeam}: ratio ${ratio.toFixed(2)}`);
  }
  assert.equal(planCompactCampus(4, 15), null, "four teams keep the original layout");
  assert.equal(planCompactCampus(10, 16), null, "sixteen-person teams keep the original layout");
});

test("every compact campus is clear of overlaps, has a clear entrance on every room and a park and field lot", () => {
  for (const teamCount of [5, 6, 7, 8, 9, 10]) for (const peoplePerTeam of [4, 15]) {
    const { layout } = generateCampusMap({ totalPeople: teamCount * peoplePerTeam, peoplePerTeam, teamCount });
    const plan = planCompactCampus(teamCount, peoplePerTeam)!;
    assert.deepEqual(layout.dimensions, { width: plan.width, depth: plan.depth });
    for (const a of layout.zones) {
      assert.ok(Math.abs(a.x) + a.width / 2 <= plan.width / 2 && Math.abs(a.z) + a.depth / 2 <= plan.depth / 2, `${a.id} is inside the map`);
      for (const b of layout.zones) if (a.id < b.id) assert.ok(!overlaps(a, b), `${a.id} / ${b.id}`);
      for (const road of layout.roadways ?? []) assert.ok(!overlaps(a, road), `${a.id} / ${road.id}`);
    }
    assert.deepEqual(roomZoneEntranceIssues(layout), [], `${teamCount}×${peoplePerTeam} entrances`);
    const lots = compactCivicLots(layout);
    assert.ok(lots && lots.park.width >= 30 && lots.field.width >= 40, `${teamCount}×${peoplePerTeam} lots`);
    assert.equal(layout.props.filter((prop) => prop.id.startsWith("campus-vehicle-")).length, 20);
  }
});
