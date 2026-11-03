import assert from "node:assert/strict";
import test from "node:test";
import type * as THREE from "three";
import { PortraitSnapshotQueue } from "./portraitSnapshotQueue";

test("portrait requests share one renderer and run serially with a frame yield", async () => {
  const calls: string[] = [];
  let created = 0;
  let disposed = 0;
  const renderer = {
    setSize: (width: number, height: number) => calls.push(`size:${width}x${height}`),
    dispose: () => { disposed += 1; },
    forceContextLoss: () => calls.push("context-lost"),
  } as unknown as THREE.WebGLRenderer;
  const queue = new PortraitSnapshotQueue(() => { created += 1; return renderer; });
  const completed: number[] = [];
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });
  const request = (id: number, delayMs: number) => ({
    widthPx: 40 + id,
    heightPx: 50 + id,
    active: () => true,
    prepare: async () => { calls.push(`prepare:${id}`); },
    render: async () => {
      calls.push(`start:${id}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      calls.push(`finish:${id}`);
      return null;
    },
    complete: () => {
      completed.push(id);
      if (completed.length === 2) resolveDone();
    },
  });

  queue.enqueue(request(1, 2));
  queue.enqueue(request(2, 0));
  await done;

  assert.equal(created, 1);
  assert.equal(disposed, 1);
  assert.deepEqual(completed, [1, 2]);
  assert.ok(calls.indexOf("finish:1") < calls.indexOf("start:2"));
  assert.ok(calls.indexOf("finish:1") < calls.indexOf("prepare:2"));
  assert.ok(calls.includes("size:41x51"));
  assert.ok(calls.includes("size:42x52"));
  assert.ok(calls.includes("context-lost"));
});

test("inactive portrait requests cancel before allocating WebGL", async () => {
  let created = 0;
  let cancelled = 0;
  let completed = false;
  const queue = new PortraitSnapshotQueue(() => {
    created += 1;
    throw new Error("renderer should not be allocated");
  });
  queue.enqueue({
    widthPx: 16,
    heightPx: 16,
    active: () => false,
    render: () => { throw new Error("inactive work must not render"); },
    cancel: () => { cancelled += 1; },
    complete: portrait => { completed = portrait === null; },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(created, 0);
  assert.equal(cancelled, 1);
  assert.equal(completed, true);
});
