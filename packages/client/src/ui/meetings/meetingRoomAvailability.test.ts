import assert from "node:assert/strict";
import test from "node:test";
import { isMeetingRoomAvailable } from "./meetingRoomAvailability.js";

const reservations = [
  { zoneId: "room-a", startsAt: "2026-11-03T10:00:00.000Z", endsAt: "2026-11-03T11:00:00.000Z" },
  { zoneId: "room-b", startsAt: "2026-11-03T10:00:00.000Z", endsAt: "2026-11-03T11:00:00.000Z" },
];

test("meeting room availability detects partial and exact overlaps only for the booked room", () => {
  assert.equal(isMeetingRoomAvailable("room-a", "2026-11-03T10:30:00Z", "2026-11-03T11:30:00Z", reservations), false);
  assert.equal(isMeetingRoomAvailable("room-a", "2026-11-03T09:30:00Z", "2026-11-03T10:15:00Z", reservations), false);
  assert.equal(isMeetingRoomAvailable("room-c", "2026-11-03T10:30:00Z", "2026-11-03T11:30:00Z", reservations), true);
});

test("back-to-back meetings are available and invalid intervals are rejected", () => {
  assert.equal(isMeetingRoomAvailable("room-a", "2026-11-03T11:00:00Z", "2026-11-03T12:00:00Z", reservations), true);
  assert.equal(isMeetingRoomAvailable("room-a", "bad", "2026-11-03T12:00:00Z", reservations), false);
  assert.equal(isMeetingRoomAvailable("room-a", "2026-11-03T12:00:00Z", "2026-11-03T12:00:00Z", reservations), false);
});
