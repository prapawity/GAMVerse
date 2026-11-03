import assert from "node:assert/strict";
import test from "node:test";
import { buildMeetingCalendarEvent, meetingCalendarFilename } from "./meetingCalendarEvent.js";

test("calendar export uses UTC times, escapes text and keeps one VEVENT", () => {
  const calendar = buildMeetingCalendarEvent({
    id: "42", title: "Planning, review; next\\steps\nIgnore:BEGIN:VEVENT", zoneName: "Room A",
    startsAt: "2026-11-03T10:00:00+07:00", endsAt: "2026-11-03T11:00:00+07:00",
  }, "GAMVerse Office", new Date("2026-11-01T01:02:03.000Z"), "https://gammyverse.example/meeting/office?room=meeting-1");
  assert.match(calendar, /DTSTART:20261103T030000Z/);
  assert.match(calendar, /DTEND:20261103T040000Z/);
  assert.match(calendar, /SUMMARY:Planning\\, review\\; next\\\\steps\\nIgnore:BEGIN:VEVENT/);
  assert.match(calendar, /URL:https:\/\/gammyverse\.example\/meeting\/office\?room=meeting-1/);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.equal((calendar.match(/END:VEVENT/g) ?? []).length, 1);
  assert.ok(calendar.endsWith("\r\n"));
});

test("calendar export folds long UTF-8 lines and produces a safe filename", () => {
  const calendar = buildMeetingCalendarEvent({ id: "1", title: "宇宙".repeat(40), zoneName: "Room", startsAt: "2026-11-03T03:00:00Z", endsAt: "2026-11-03T04:00:00Z" }, "Office");
  for (const line of calendar.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(meetingCalendarFilename("Plan: Q4 / team"), "Plan-Q4-team.ics");
  assert.equal(meetingCalendarFilename("宇宙 meeting"), "宇宙-meeting.ics");
});
