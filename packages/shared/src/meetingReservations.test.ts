import assert from "node:assert/strict";
import test from "node:test";
import { isCreateMeetingReservation } from "./meetingReservations.js";

const NOW = Date.parse("2026-11-03T00:00:00Z");
const VALID = { zoneId: "meeting-1", title: "Weekly sync", startsAt: "2026-11-03T01:00:00+01:00", endsAt: "2026-11-03T01:30:00+01:00" };

test("meeting reservations accept a future, bounded slot with an explicit timezone", () => {
  assert.equal(isCreateMeetingReservation(VALID, NOW), true);
});

test("meeting reservations reject past, too-far, too-short, and too-long slots", () => {
  assert.equal(isCreateMeetingReservation({ ...VALID, startsAt: "2026-11-02T23:00:00Z", endsAt: "2026-11-02T23:30:00Z" }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, startsAt: "2027-03-01T00:00:00Z", endsAt: "2027-03-01T00:30:00Z" }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, startsAt: "2026-11-03T01:00:00Z", endsAt: "2026-11-03T01:04:00Z" }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, startsAt: "2026-11-03T01:00:00Z", endsAt: "2026-11-03T06:00:00Z" }, NOW), false);
});

test("meeting reservations reject malformed values and timezone-free datetimes", () => {
  assert.equal(isCreateMeetingReservation(null, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, startsAt: "2026-11-03T01:00:00" }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, zoneId: "" }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, title: " " }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, endsAt: "not a date" }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, attendeeCount: 0 }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, attendeeCount: 501 }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, attendeeCount: 2.5 }, NOW), false);
  assert.equal(isCreateMeetingReservation({ ...VALID, attendeeCount: 8 }, NOW), true);
});
