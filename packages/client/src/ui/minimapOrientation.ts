import { screenMovementToWorld } from "@gammyverse/shared";

const DEGREES_PER_HALF_TURN = 180;

/**
 * The camera at `yawRad` looks along world (-sin, -cos) with world (cos, -sin) on its right
 * (the same basis as `screenMovementToWorld`). The north-up map must turn clockwise by the yaw
 * so that the camera's forward direction ends up at the top of the minimap.
 */
export function minimapRotationRad(yawRad: number): number {
  return yawRad;
}

/** CSS rotation of the N/E/S/W rose: it turns with the map, so N always points at world north. */
export function compassRotationDeg(yawRad: number): number {
  return (minimapRotationRad(yawRad) * DEGREES_PER_HALF_TURN) / Math.PI;
}

/** Rotates a canvas point (y down) clockwise by `radians` around a centre, like `ctx.rotate`. */
export function rotateAroundCenter(point: { x: number; y: number }, center: { x: number; y: number }, radians: number): { x: number; y: number } {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** Where a world-space direction points on the rotated minimap (canvas coordinates, y down). */
export function worldDirectionOnMinimap(world: { x: number; z: number }, yawRad: number): { x: number; y: number } {
  const origin = { x: 0, y: 0 };
  return rotateAroundCenter({ x: world.x, y: world.z }, origin, minimapRotationRad(yawRad));
}

/** The world direction the camera faces at this yaw, for checking the minimap against the 3D view. */
export function cameraForwardWorld(yawRad: number): { x: number; z: number } {
  return screenMovementToWorld({ x: 0, z: 1 }, yawRad);
}
