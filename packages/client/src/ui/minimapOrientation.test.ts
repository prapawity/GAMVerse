import assert from "node:assert/strict";
import test from "node:test";
import { screenMovementToWorld } from "@gammyverse/shared";
import { cameraForwardWorld, compassRotationDeg, rotateAroundCenter, worldDirectionOnMinimap } from "./minimapOrientation";

const YAWS = [0, 0.7, Math.PI / 2, 2.4, Math.PI, -1.1, 4.5];
const CLOSE = 1e-9;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < CLOSE, `${actual} vs ${expected}`);

test("the direction the camera faces is always straight up on the minimap", () => {
  for (const yaw of YAWS) {
    const onMap = worldDirectionOnMinimap(cameraForwardWorld(yaw), yaw);
    near(onMap.x, 0);
    near(onMap.y, -1);
  }
});

test("what is to the camera's right is always to the right on the minimap", () => {
  for (const yaw of YAWS) {
    const onMap = worldDirectionOnMinimap(screenMovementToWorld({ x: 1, z: 0 }, yaw), yaw);
    near(onMap.x, 1);
    near(onMap.y, 0);
  }
});

test("the compass turns with the map, so north stays on world north", () => {
  for (const yaw of YAWS) {
    const north = worldDirectionOnMinimap({ x: 0, z: -1 }, yaw);
    // The rose draws N at the top and CSS rotates clockwise, like the canvas.
    const rose = rotateAroundCenter({ x: 0, y: -1 }, { x: 0, y: 0 }, (compassRotationDeg(yaw) * Math.PI) / 180);
    near(rose.x, north.x);
    near(rose.y, north.y);
  }
});

test("at yaw 0 the map is north-up", () => {
  near(compassRotationDeg(0), 0);
  const north = worldDirectionOnMinimap({ x: 0, z: -1 }, 0);
  near(north.x, 0);
  near(north.y, -1);
});
