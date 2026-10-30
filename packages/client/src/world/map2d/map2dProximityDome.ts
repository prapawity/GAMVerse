import { PROXIMITY_DOME_OPACITY, PROXIMITY_DOME_OTHER_OPACITY } from "../proximityDome";
import type { DomeEntry } from "../proximityGroupShape";
import { worldToScreen, type Map2dProjection } from "./map2dProjection";

const DOME_FILL_RGB = "159, 216, 238";
const DOME_CENTER_OPACITY_RATIO = 0.4;
const DOME_EDGE_STROKE_OPACITY = 0.6;
const DOME_OTHER_EDGE_STROKE_OPACITY = 0.35;
const DOME_EDGE_STROKE_WIDTH_PX = 2;
const FULL_CIRCLE_RAD = Math.PI * 2;

/** Top-down view of the proximity domes: soft discs, clearer toward the edge so the map underneath stays readable. Your own group draws last. */
export function drawMap2dProximityDomes(ctx: CanvasRenderingContext2D, projection: Map2dProjection, entries: readonly DomeEntry[]): void {
  const ordered = [...entries].sort((a, b) => Number(a.own) - Number(b.own));
  ctx.save();
  for (const { shape, own } of ordered) {
    const center = worldToScreen(projection, shape);
    const radiusPx = shape.radius * projection.pxPerM;
    const edgeOpacity = own ? PROXIMITY_DOME_OPACITY : PROXIMITY_DOME_OTHER_OPACITY;
    const fill = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radiusPx);
    fill.addColorStop(0, `rgba(${DOME_FILL_RGB}, ${edgeOpacity * DOME_CENTER_OPACITY_RATIO})`);
    fill.addColorStop(1, `rgba(${DOME_FILL_RGB}, ${edgeOpacity})`);
    ctx.fillStyle = fill;
    ctx.strokeStyle = `rgba(${DOME_FILL_RGB}, ${own ? DOME_EDGE_STROKE_OPACITY : DOME_OTHER_EDGE_STROKE_OPACITY})`;
    ctx.lineWidth = DOME_EDGE_STROKE_WIDTH_PX;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, FULL_CIRCLE_RAD);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
