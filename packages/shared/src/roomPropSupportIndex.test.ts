import assert from "node:assert/strict";
import test from "node:test";
import { createCampusOfficeDraft } from "./campusFurnishing.js";
import { createRoomPropSupportIndex, roomPropDefinition, roomPropPlacementSupport, ROOM_PROP_CATALOG, type RoomLayoutProp } from "./roomLayout.js";

const layout = createCampusOfficeDraft({ totalPeople: 60, peoplePerTeam: 6, teamCount: 10, seed: 3 }, "furnished").layout;

function summarize(support: ReturnType<typeof roomPropPlacementSupport>) {
  return support ? { id: support.prop.id, elevation: support.elevation, distance: support.distance } : null;
}

test("the catalog lookup returns the first entry for every asset, like Array.find", () => {
  for (const entry of ROOM_PROP_CATALOG) assert.equal(roomPropDefinition(entry.asset), ROOM_PROP_CATALOG.find((candidate) => candidate.asset === entry.asset));
  assert.equal(roomPropDefinition("no-such-asset"), undefined);
});

test("the support index matches the linear search for every placed prop and for random probes", () => {
  const props = layout.props;
  assert.ok(props.length > 1000);
  const index = createRoomPropSupportIndex(props);
  let compared = 0;
  let supported = 0;
  for (const prop of props) {
    const expected = summarize(roomPropPlacementSupport(props.filter((candidate) => candidate.id !== prop.id), prop.asset, prop.x, prop.z, prop.rotation));
    assert.deepEqual(summarize(index.find(prop.asset, prop.x, prop.z, prop.rotation, prop.id)), expected, prop.id);
    compared += 1;
    if (expected) supported += 1;
  }
  assert.ok(supported > 50, `expected some stacked props, got ${supported}`);
  // Probe every small/shelf asset over the occupied area, including rotated and off-surface points.
  const probes = ROOM_PROP_CATALOG.filter((entry) => entry.placementClass === "small" || entry.placementClass === "shelf").slice(0, 6);
  let seed = 12345;
  const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let n = 0; n < 1500; n += 1) {
    const anchor = props[Math.floor(random() * props.length)]!;
    const asset = probes[n % probes.length]!.asset;
    const x = anchor.x + (random() - 0.5) * 2;
    const z = anchor.z + (random() - 0.5) * 2;
    const rotation = random() * Math.PI * 2;
    assert.deepEqual(summarize(index.find(asset, x, z, rotation)), summarize(roomPropPlacementSupport(props, asset, x, z, rotation)));
    compared += 1;
  }
  assert.ok(compared > 2500);
});

test("the support index reads elevations live, so stacked shelves see updates made between queries", () => {
  const shelf = ROOM_PROP_CATALOG.find((entry) => entry.placementClass === "shelf")!;
  const lower: RoomLayoutProp = { id: "lower", asset: shelf.asset, x: 0, z: 0, rotation: 0, width: shelf.width, depth: shelf.depth, elevation: 0 } as RoomLayoutProp;
  const upper: RoomLayoutProp = { ...lower, id: "upper", elevation: 0 } as RoomLayoutProp;
  const props = [lower, upper];
  const index = createRoomPropSupportIndex(props);
  const before = index.find(shelf.asset, 0, 0, 0, "upper");
  assert.equal(before?.prop.id, "lower");
  props[0] = { ...lower, elevation: 1 };
  const after = index.find(shelf.asset, 0, 0, 0, "upper");
  assert.equal(after?.elevation, 1 + shelf.height);
  assert.deepEqual(summarize(after), summarize(roomPropPlacementSupport([props[0]!], shelf.asset, 0, 0, 0)));
});
