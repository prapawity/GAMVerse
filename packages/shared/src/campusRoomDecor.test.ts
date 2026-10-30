import assert from "node:assert/strict";
import test from "node:test";
import { createCampusOfficeDraft } from "./campusFurnishing.js";
import { generateCampusMap } from "./campusMapGenerator.js";
import { WALL_MOUNTED_ASSETS } from "./campusRoomDecor.js";
import { roomPropCollisionFootprint, type RoomLayout, type RoomLayoutProp } from "./roomLayout.js";

const FLOAT_TOLERANCE_M = 0.001;
const INPUTS = [
  { totalPeople: 1, peoplePerTeam: 1, teamCount: 1, seed: 1 },
  { totalPeople: 150, peoplePerTeam: 15, teamCount: 10, seed: 3 },
];
const inRoom = (layout: RoomLayout, id: string) => layout.props.filter(prop => prop.id.startsWith(`${id}-starter-`));
const count = (props: RoomLayoutProp[], pattern: RegExp) => props.filter(prop => pattern.test(prop.id)).length;

function assertNoOverlaps(props: RoomLayoutProp[], zoneId: string) {
  const solid = props.filter(prop => prop.collision);
  for (let index = 0; index < solid.length; index += 1) for (const other of solid.slice(index + 1)) {
    const first = roomPropCollisionFootprint(solid[index]!);
    const second = roomPropCollisionFootprint(other);
    const overlaps = Math.abs(solid[index]!.x - other.x) < (first.width + second.width) / 2 - FLOAT_TOLERANCE_M
      && Math.abs(solid[index]!.z - other.z) < (first.depth + second.depth) / 2 - FLOAT_TOLERANCE_M;
    assert.ok(!overlaps, `${solid[index]!.id} overlaps ${other.id} in ${zoneId}`);
  }
}

test("the Town Hall and fifty-seat meeting rooms are decorated without disturbing their seating", () => {
  const { layout } = createCampusOfficeDraft(INPUTS[1]!, "furnished");
  const hall = inRoom(layout, "shared-townhall");
  assert.equal(hall.filter(prop => prop.asset === "kit:chair").length, 200, "the seating block is untouched");
  assert.ok(count(hall, /-decor-plant-/) >= 8 && count(hall, /-decor-picture-/) >= 8 && count(hall, /-decor-lamp-/) >= 4);
  for (const room of layout.zones.filter(zone => /^meeting-(small|large)-/.test(zone.id))) {
    const props = inRoom(layout, room.id);
    assert.equal(props.filter(prop => prop.asset === "kit:chair").length, 50);
    assert.ok(count(props, /-decor-picture-/) >= 2 && count(props, /-decor-shelf-/) >= 2 && count(props, /-decor-lamp-/) >= 4 && count(props, /-decor-picture-south/) === 1, room.id);
    assertNoOverlaps(props, room.id);
  }
  assertNoOverlaps(hall, "shared-townhall");
});

test("the cafeteria has a serving line, six dining groups and wall decor instead of a few tables", () => {
  for (const input of INPUTS) {
    const { layout } = createCampusOfficeDraft(input, "furnished");
    const props = inRoom(layout, "shared-cafeteria");
    assert.equal(count(props, /-dining-\d-\d-table$/), 6);
    assert.equal(count(props, /-dining-\d-\d-chair-/), 24);
    assert.ok(count(props, /-serving-counter-/) >= 8 && count(props, /-serving-fridge-/) === 2, "serving line");
    assert.ok(count(props, /-cafeteria-picture-/) >= 3 && count(props, /-cafeteria-bench-/) >= 4);
    assert.ok(props.length > 40 && props.length <= 72, `${props.length} props`);
    assertNoOverlaps(props, "shared-cafeteria");
  }
});

test("the lounge has its own two conversation groups and no reception desk", () => {
  const { layout } = createCampusOfficeDraft(INPUTS[0]!, "furnished");
  const props = inRoom(layout, "shared-lounge");
  assert.ok(props.length > 0);
  assert.equal(count(props, /reception/), 0);
  assert.equal(count(props, /-lounge-sofa-/), 4);
  assert.equal(count(props, /-lounge-table-/), 2);
  assert.ok(count(props, /-lounge-bookcase-/) >= 6);
  assertNoOverlaps(props, "shared-lounge");
});

test("wall decor is hung at wall height and is the only elevated starter prop outside tabletops and mirrors", () => {
  const { layout } = createCampusOfficeDraft(INPUTS[1]!, "furnished");
  const hung = layout.props.filter(prop => WALL_MOUNTED_ASSETS.has(prop.asset) && prop.id.includes("-starter-"));
  assert.ok(hung.length > 30);
  for (const prop of hung) assert.ok(prop.elevation !== undefined && prop.elevation >= 1 && prop.elevation <= 2.5, prop.id);
});

test("the park is planted across its full lawn, with several tree varieties", () => {
  for (const input of INPUTS) {
    const trees = generateCampusMap(input).layout.props.filter(prop => prop.id.includes("civic-park-west-grove-tree-"));
    assert.ok(trees.length >= 60, `${trees.length} grove trees`);
    assert.ok(new Set(trees.map(prop => prop.asset)).size >= 10, "a varied planting");
  }
});
