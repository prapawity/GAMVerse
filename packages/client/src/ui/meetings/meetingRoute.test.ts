import assert from "node:assert/strict";
import test from "node:test";
import { createMeetingRoomUrl, getMeetingRouteOfficeId, getMeetingRouteZoneId, shouldPreserveMeetingRoute } from "./meetingRoute";

const OFFICE_ID = "123e4567-e89b-12d3-a456-426614174000";

test("meeting links retain their office identity across route handling", () => {
  assert.equal(getMeetingRouteOfficeId(`/meeting/${OFFICE_ID}`), OFFICE_ID);
  assert.equal(getMeetingRouteOfficeId(`/meeting/${OFFICE_ID.toUpperCase()}/`), OFFICE_ID);
  assert.equal(getMeetingRouteOfficeId(`/office/${OFFICE_ID}`), null);
  assert.equal(getMeetingRouteOfficeId("/meeting/not-an-office-id"), null);
});

test("an active matching meeting route survives office selection for refresh-safe joins", () => {
  assert.equal(shouldPreserveMeetingRoute(`/meeting/${OFFICE_ID}`, OFFICE_ID), true);
  assert.equal(shouldPreserveMeetingRoute(`/meeting/${OFFICE_ID}`, "123e4567-e89b-12d3-a456-426614174001"), false);
  assert.equal(shouldPreserveMeetingRoute(`/office/${OFFICE_ID}`, OFFICE_ID), false);
});

test("room-specific meeting links preserve a validated zone and encode it in the URL", () => {
  assert.equal(getMeetingRouteZoneId("?room=team%20meeting"), "team meeting");
  assert.equal(getMeetingRouteZoneId(`?room=${"x".repeat(129)}`), null);
  assert.equal(getMeetingRouteZoneId("?room=%0A"), null);
  assert.equal(createMeetingRoomUrl("https://gammyverse.example", OFFICE_ID, "team meeting"), `https://gammyverse.example/meeting/${OFFICE_ID}?room=team+meeting`);
});
