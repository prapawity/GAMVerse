import assert from "node:assert/strict";
import test from "node:test";
import { countMeetingRoomSeats } from "./meetingRoomCapacity.js";
import type { RoomLayoutZone } from "./roomLayout.js";
import type { RoomLayoutProp } from "./roomPropTypes.js";

const zones: RoomLayoutZone[] = [
  { id: "meeting-a", name: "Meeting A", kind: "meeting", x: 0, z: 0, width: 8, depth: 6, color: "#ddd" },
  { id: "office", name: "Office", kind: "private", x: 12, z: 0, width: 8, depth: 6, color: "#ddd" },
];
const props: RoomLayoutProp[] = [
  { id: "chair-1", asset: "kit:chair", x: -1, z: 0, rotation: 0, collision: true, width: 1, depth: 1 },
  { id: "sofa-1", asset: "kit:loungesofa", x: 1, z: 0, rotation: 0, collision: true, width: 3, depth: 1 },
  { id: "desk-chair", asset: "kit:chair", x: 12, z: 0, rotation: 0, collision: true, width: 1, depth: 1 },
  { id: "table", asset: "kit:table", x: 0, z: 1, rotation: 0, collision: true, width: 1, depth: 1 },
];

test("meeting room capacity counts seat anchors in meeting zones only", () => {
  const capacity = countMeetingRoomSeats(zones, props);
  assert.equal(capacity["meeting-a"], 4);
  assert.equal("office" in capacity, false);
});

test("meeting room capacity is zero when no seats are configured", () => {
  assert.deepEqual(countMeetingRoomSeats(zones, []), { "meeting-a": 0 });
});
