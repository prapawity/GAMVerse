import assert from "node:assert/strict";
import test from "node:test";
import type { RoomLayout } from "@gammyverse/shared";
import { createTeamZoneLabels } from "./teamZoneLabels";

test("3D team plates share team names, sit over their rooms and use translucent backgrounds", () => {
  const layout = {
    zones: [
      { id: "team-1-office-01", name: "Design Office 01", kind: "private", x: 4, z: 6, width: 4, depth: 4, color: "#ffffff" },
      { id: "team-1-office-02", name: "Design Office 02", kind: "private", x: 8, z: 6, width: 4, depth: 4, color: "#ffffff" },
      { id: "meeting", name: "Meeting Room", kind: "meeting", x: 8, z: 16, width: 4, depth: 4, color: "#ffffff" },
    ],
    walls: [{ x: 4, z: 6, height: 3 }, { x: 8, z: 6, height: 4 }],
  } as RoomLayout;
  const fills: string[] = [];
  const context = {
    fillStyle: "",
    measureText: () => ({ width: 120 }),
    beginPath() {},
    roundRect() {},
    fill() { fills.push(this.fillStyle); },
    strokeText() {},
    fillText() {},
  };
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => context }) } });
  try {
    const labels = createTeamZoneLabels(layout, 100, 50);
    assert.equal(labels.length, 1);
    const [label] = labels;
    assert.equal(label.name, "Team zone: Design");
    assert.deepEqual(label.position.toArray(), [106, 24, 56]);
    assert.deepEqual(fills, ["rgba(126, 67, 22, 0.9)"]);
    assert.equal(label.material.transparent, true);
    assert.equal(label.material.depthWrite, false);
    label.material.map?.dispose();
    label.material.dispose();
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});
