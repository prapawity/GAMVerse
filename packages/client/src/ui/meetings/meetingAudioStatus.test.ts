import assert from "node:assert/strict";
import test from "node:test";
import { meetingAudioStatus, meetingAudioStatusLabel } from "./meetingAudioStatus";

test("meeting audio reports its connection and recovery states accurately", () => {
  assert.equal(meetingAudioStatus({ connected: false, retryExhausted: false, error: false }), "connecting");
  assert.equal(meetingAudioStatus({ connected: false, retryExhausted: false, error: true }), "reconnecting");
  assert.equal(meetingAudioStatus({ connected: false, retryExhausted: true, error: true }), "unavailable");
  assert.equal(meetingAudioStatus({ connected: true, retryExhausted: false, error: false }), "connected");
  assert.equal(meetingAudioStatusLabel("connected"), "Audio connected");
});
