import assert from "node:assert/strict";
import test from "node:test";
import { type RoomLayout } from "@gammyverse/shared";
import { drawMap2dWalls } from "./map2dWallDrawing";

// Walls are drawn as 2.5D faces raised by height * ratio (a2b30fcf); the ground shadow stays on the footprint.
const WALL_HEIGHT_PROJECTION_RATIO = 0.62;
const WALL_HEIGHT_M = 2;
const DOOR_FRAME_WIDTH_M = 0.12;

test("vertical doorway stays clear of solid wall fills and shadows at play and minimap scales", () => {
  const layout: RoomLayout = { version: 1, props: [], zones: [],
    walls: [{ id: "wall", axis: "vertical", x: 0, z: 0, length: 10, thickness: 0.2, height: WALL_HEIGHT_M, color: "#63bbd0" }],
    doors: [{ id: "opening", wallId: "wall", offset: 0, width: 2, kind: "opening" }] };
  for (const pxPerM of [2, 12]) {
    const fills: Array<{ top: number; bottom: number; color: string }> = [];
    let fillStyle = "";
    const ctx = { get fillStyle() { return fillStyle; }, set fillStyle(value: string) { fillStyle = value; }, save() {}, restore() {}, strokeRect() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
      fillRect(_x: number, y: number, _width: number, height: number) { fills.push({ top: y, bottom: y + height, color: fillStyle }); },
    } as unknown as CanvasRenderingContext2D;
    drawMap2dWalls(ctx, { center: { x: 0, z: 0 }, pxPerM, widthPx: 200, heightPx: 200, dpr: 1 }, layout);
    const raisedPx = WALL_HEIGHT_M * pxPerM * WALL_HEIGHT_PROJECTION_RATIO;
    const groundOpening = { top: 100 - pxPerM, bottom: 100 + pxPerM };
    assert.ok(fills.length > 0, "solid spans are rendered");
    assert.ok(fills.some((fill) => fill.color === "#63bbd0"), "wall uses its saved room color");
    // Door jambs and their shadows are DOOR_FRAME_WIDTH_M thick and sit on the opening edge by design; only wall spans must stay clear.
    const isDoorJamb = (fill: { top: number; bottom: number }) => fill.bottom - fill.top <= DOOR_FRAME_WIDTH_M * pxPerM + 0.01;
    for (const fill of fills.filter(item => !isDoorJamb(item))) {
      const raised = fill.color === "#63bbd0";
      const opening = raised ? { top: groundOpening.top - raisedPx, bottom: groundOpening.bottom - raisedPx } : groundOpening;
      assert.ok(fill.bottom <= opening.top || fill.top >= opening.bottom,
        `${raised ? "wall face" : "shadow"} fill at ${pxPerM}px/m intrudes into doorway`);
    }
    assert.ok(fills.some((fill) => fill.color !== "#63bbd0"), "ground shadow fills are checked too");
  }
});
