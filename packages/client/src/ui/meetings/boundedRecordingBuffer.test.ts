import assert from "node:assert/strict";
import test from "node:test";
import { BoundedRecordingBuffer, canStartRecording, RecordingCaptureEpoch, recordingCompletion } from "./boundedRecordingBuffer";

test("buffer stops before the hard byte cap and still accepts the recorder's final chunk", () => {
  const buffer = new BoundedRecordingBuffer(100, 20);
  const beforeStop = buffer.append(new Blob([new Uint8Array(80)]));
  assert.equal(beforeStop.accepted, true);
  assert.equal(beforeStop.shouldStop, true);

  const finalChunk = buffer.append(new Blob([new Uint8Array(20)]));
  assert.deepEqual(finalChunk, { accepted: true, shouldStop: true });
  assert.equal(buffer.sizeBytes, 100);
  assert.equal(buffer.toBlob("video/webm").size, 100);
});

test("oversized recorder slices are rejected without exceeding the hard cap", () => {
  const buffer = new BoundedRecordingBuffer(10, 2);
  assert.equal(buffer.append(new Blob([new Uint8Array(10)])).accepted, true);
  assert.deepEqual(buffer.append(new Blob([new Uint8Array(1)])), { accepted: false, shouldStop: true });
  assert.equal(buffer.sizeBytes, 10);
});

test("clear releases buffered chunks and resets byte accounting", () => {
  const buffer = new BoundedRecordingBuffer();
  buffer.append(new Blob([new Uint8Array(4)]));
  buffer.clear();
  assert.equal(buffer.sizeBytes, 0);
  assert.equal(buffer.toBlob("video/webm").size, 0);
});

test("a rejected oversized chunk is reported as a failed capture, not a successful partial download", () => {
  assert.deepEqual(recordingCompletion(true, 90, "bytes"), { kind: "failed" });
  assert.deepEqual(recordingCompletion(false, 0, null), { kind: "empty" });
  assert.deepEqual(recordingCompletion(false, 90, "duration"), { kind: "download", reason: "duration" });
});

test("a delayed stop callback from an invalidated capture cannot finalize over its replacement", () => {
  const epoch = new RecordingCaptureEpoch();
  const oldCapture = epoch.begin();
  epoch.invalidate();
  const replacement = epoch.begin();
  assert.equal(epoch.isCurrent(oldCapture), false);
  assert.equal(epoch.isCurrent(replacement), true);
});

test("a new recording waits for the previous recorder to finish its final chunk", () => {
  assert.equal(canStartRecording(true, true, false), false);
  assert.equal(canStartRecording(true, false, true), false);
  assert.equal(canStartRecording(false, false, false), false);
  assert.equal(canStartRecording(true, false, false), true);
});
