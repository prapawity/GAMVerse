import { ROOM_PROP_CATALOG, type RoomLayoutProp } from "@gammyverse/shared";
import { worldToScreen, type Map2dProjection } from "./map2dProjection";
import { MAP2D_DETAIL_PALETTE, map2dPropStyle } from "./map2dStaticDetail";
import { drawMap2dProjectedModelImage, drawMap2dPropImage } from "./map2dPropImageDrawing";
import { map2dPropDetailVisible, map2dPropKind, type Map2dPropKind } from "./map2dPropVisual";
import { hasTopdownPropImage, propPreviewImages } from "./propPreviewImages";
import { map2dPropModelImages } from "./map2dPropModelImages";
import { map2dPropUsesCompactLod } from "./map2dPropLod";

const PROP_DEFINITIONS = new Map(ROOM_PROP_CATALOG.map(item => [item.asset, item]));
const OUTLINE_WIDTH_PX = 1;
const FULL_CIRCLE_RAD = Math.PI * 2;
const SHADOW_OFFSET_RATIO = 0.045;
const EDGE_RADIUS_RATIO = 0.065;
const HALF_RATIO = 0.5;
const INTERACTION_GLYPH = "↗";
const INTERACTION_FONT_PX = 10;
const INTERACTION_BADGE_RADIUS_PX = 7;
const INTERACTION_BADGE_OFFSET_MAX_PX = 16;
const INTERACTION_BADGE_OFFSET_RATIO = 0.3;
const INTERACTION_BADGE_BACKGROUND = "#f9f6e9";
const INTERACTION_BADGE_INK = "#38534c";
const COMPACT_LANDMARK_MIN_HEIGHT_PX = 8;
const COMPACT_LANDMARK_MAX_HEIGHT_PX = 32;
const COMPACT_PROP_MAX_SIZE_PX = 10;
const COMPACT_PROP_MIN_SIZE_PX = 3.5;
const SURFACE = {
  wood: "#c7a37d", woodEdge: "#927455", woodLight: "#e1c6a1", grain: "#b58d65",
  cloth: "#79918e", clothEdge: "#4e6967", cushion: "#a8bab1", highlight: "#d5dace",
  monitor: "#3f5059", screen: "#97bfc6", screenLight: "#c6dfe0", shadow: "#263d3824",
  pot: "#bc886b", soil: "#665849", leaf: "#618c58", leafLight: "#8ba870", leafDark: "#426e49",
  bedding: "#d8d8ee", blanket: "#8ea2c6", bathroom: "#edf2ec", bathEdge: "#8aa6a3",
  appliance: "#c7d2d4", applianceEdge: "#657b80", rug: "#c3a8bd", rugEdge: "#896f89",
  rubber: "#607177", stone: "#858d89", stoneLight: "#a7aeaa", screenDark: "#243b43",
  books: ["#bd8679", "#8caaa4", "#d2b67c", "#8695a4", "#a6ad89"],
} as const;
type LocalRect = readonly [xRatio: number, yRatio: number, widthRatio: number, depthRatio: number];
const FULL_RECT_RATIO: LocalRect = [-0.5, -0.5, 1, 1];
const TABLE_INSET_RATIO: LocalRect = [-0.44, -0.43, 0.88, 0.82];
const TABLE_HIGHLIGHT_RATIO: LocalRect = [-0.41, -0.4, 0.82, 0.035];
const TABLE_GRAIN_RECTS_RATIO: readonly LocalRect[] = [[-0.34, -0.12, 0.53, 0.012], [-0.12, 0.18, 0.44, 0.012]];
const SEAT_CUSHION_RATIO: LocalRect = [-0.36, -0.18, 0.72, 0.57];
const SEAT_BACK_RATIO: LocalRect = [-0.46, -0.46, 0.92, 0.23];
const SEAT_HIGHLIGHT_RATIO: LocalRect = [-0.35, -0.4, 0.7, 0.035];
const SOFA_ARM_RECTS_RATIO: readonly LocalRect[] = [[-0.46, -0.2, 0.13, 0.62], [0.33, -0.2, 0.13, 0.62]];
const SOFA_SEAM_RATIO: LocalRect = [-0.009, -0.12, 0.018, 0.43];
const BENCH_SLATS_RATIO: readonly LocalRect[] = [[-0.44, -0.32, 0.88, 0.025], [-0.44, 0, 0.88, 0.025], [-0.44, 0.32, 0.88, 0.025]];
const MONITOR_SCREEN_RATIO: LocalRect = [-0.42, -0.38, 0.84, 0.6];
const MONITOR_STAND_RATIO: LocalRect = [-0.19, 0.27, 0.38, 0.16];
const SCREEN_REFLECTION_RATIO: LocalRect = [-0.34, -0.28, 0.45, 0.055];
const STORAGE_INSET_RATIO: LocalRect = [-0.43, -0.32, 0.86, 0.65];
const STORAGE_PANEL_RATIO: LocalRect = [-0.43, -0.4, 0.86, 0.75];
const STORAGE_HANDLE_RATIO: LocalRect = [-0.14, 0.28, 0.28, 0.05];
const BOOK_START_X_RATIO = -0.36;
const BOOK_STEP_X_RATIO = 0.15;
const BOOK_WIDTH_RATIO = 0.11;
const BOOK_TOP_Y_RATIO = -0.26;
const BOOK_DEPTH_RATIO = 0.5;
const POT_RADIUS_RATIO = 0.39;
const SOIL_RADIUS_RATIO = 0.3;
const CANOPY_RADIUS_RATIO = 0.46;
const LEAF_RADIUS_RATIO = 0.23;
const LEAF_CENTERS_RATIO = [[-0.2, -0.08], [0.06, -0.23], [0.22, 0.02], [0.02, 0.19], [-0.17, 0.17]] as const;
const LEAF_COLORS = [SURFACE.leaf, SURFACE.leafLight, SURFACE.leaf, SURFACE.leafDark, SURFACE.leafLight];

function rect(ctx: CanvasRenderingContext2D, bounds: LocalRect, color: string, outline = false) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(...bounds, EDGE_RADIUS_RATIO);
  ctx.fill();
  if (outline) ctx.stroke();
}
function circle(ctx: CanvasRenderingContext2D, xRatio: number, yRatio: number, radiusRatio: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(xRatio, yRatio, radiusRatio, 0, FULL_CIRCLE_RAD); ctx.fill();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number, color: string, outline?: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, y, radiusX, radiusY, 0, 0, FULL_CIRCLE_RAD); ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.stroke(); }
}
function drawTable(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.woodEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.wood, true);
  if (!detail) return;
  rect(ctx, TABLE_INSET_RATIO, SURFACE.woodLight);
  rect(ctx, TABLE_HIGHLIGHT_RATIO, SURFACE.highlight);
  for (const grain of TABLE_GRAIN_RECTS_RATIO) rect(ctx, grain, SURFACE.grain);
}
function drawSeat(ctx: CanvasRenderingContext2D, detail: boolean, sofa: boolean) {
  ctx.strokeStyle = SURFACE.clothEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.cloth, true);
  if (!detail) return;
  rect(ctx, SEAT_CUSHION_RATIO, SURFACE.cushion, true);
  rect(ctx, SEAT_BACK_RATIO, SURFACE.cloth);
  rect(ctx, SEAT_HIGHLIGHT_RATIO, SURFACE.highlight);
  if (!sofa) return;
  for (const arm of SOFA_ARM_RECTS_RATIO) rect(ctx, arm, SURFACE.cloth);
  rect(ctx, SOFA_SEAM_RATIO, SURFACE.cloth);
}
function drawBench(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.woodEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.wood, true);
  if (!detail) return;
  for (const slat of BENCH_SLATS_RATIO) rect(ctx, slat, SURFACE.woodLight);
}
function drawMonitor(ctx: CanvasRenderingContext2D, detail: boolean) {
  rect(ctx, FULL_RECT_RATIO, SURFACE.monitor);
  if (!detail) return;
  rect(ctx, MONITOR_SCREEN_RATIO, SURFACE.screen);
  rect(ctx, MONITOR_STAND_RATIO, SURFACE.monitor);
  rect(ctx, SCREEN_REFLECTION_RATIO, SURFACE.screenLight);
}
function drawStorage(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.woodEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.wood, true);
  if (!detail) return;
  rect(ctx, STORAGE_PANEL_RATIO, SURFACE.woodLight);
  rect(ctx, STORAGE_HANDLE_RATIO, SURFACE.woodEdge);
}
function drawBookcase(ctx: CanvasRenderingContext2D, detail: boolean) {
  drawStorage(ctx, false);
  if (!detail) return;
  rect(ctx, STORAGE_INSET_RATIO, SURFACE.woodEdge);
  SURFACE.books.forEach((color, index) => {
    rect(ctx, [BOOK_START_X_RATIO + index * BOOK_STEP_X_RATIO, BOOK_TOP_Y_RATIO, BOOK_WIDTH_RATIO, BOOK_DEPTH_RATIO], color);
  });
}
function drawFoliage(ctx: CanvasRenderingContext2D, detail: boolean, plant: boolean) {
  if (plant) {
    circle(ctx, 0, 0, POT_RADIUS_RATIO, SURFACE.pot);
    circle(ctx, 0, 0, SOIL_RADIUS_RATIO, SURFACE.soil);
  } else circle(ctx, 0, 0, CANOPY_RADIUS_RATIO, SURFACE.leafDark);
  if (!detail) {
    circle(ctx, 0, 0, SOIL_RADIUS_RATIO, SURFACE.leaf);
    return;
  }
  LEAF_CENTERS_RATIO.forEach(([x, y], index) => circle(ctx, x, y, LEAF_RADIUS_RATIO, LEAF_COLORS[index]));
}
function drawBed(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.woodEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.wood, true);
  rect(ctx, [-0.43, -0.43, 0.86, 0.86], SURFACE.bedding, true);
  rect(ctx, [-0.4, 0.02, 0.8, 0.4], SURFACE.blanket);
  rect(ctx, [-0.38, 0.04, 0.76, 0.035], SURFACE.highlight);
  if (!detail) {
    rect(ctx, [-0.34, -0.36, 0.68, 0.23], "#f7f5f1");
    return;
  }
  rect(ctx, [-0.35, -0.36, 0.32, 0.22], "#f7f5f1");
  rect(ctx, [0.03, -0.36, 0.32, 0.22], "#f7f5f1");
  rect(ctx, [-0.3, 0.12, 0.6, 0.018], "#c2c8df");
  rect(ctx, [-0.3, 0.24, 0.6, 0.012], "#c2c8df");
}
function drawRug(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.rugEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.rug, true);
  rect(ctx, [-0.42, -0.42, 0.84, 0.84], "#d6c4d2", true);
  if (!detail) return;
  rect(ctx, [-0.34, -0.34, 0.68, 0.68], "#c7b0c6", true);
  for (const offset of [-0.2, 0, 0.2]) rect(ctx, [-0.27, offset - 0.006, 0.54, 0.012], "#a98ca8");
  circle(ctx, 0, 0, 0.07, "#efe4ed");
}
function drawLamp(ctx: CanvasRenderingContext2D, detail: boolean) {
  circle(ctx, 0, 0, 0.46, "#e6dbbd");
  circle(ctx, 0, 0, 0.36, SURFACE.woodLight);
  circle(ctx, 0, 0, 0.17, "#f7edcf");
  circle(ctx, 0, 0, 0.075, SURFACE.woodEdge);
  if (detail) circle(ctx, -0.08, -0.09, 0.035, "#fffaf0");
}
function drawAppliance(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.applianceEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.appliance, true);
  rect(ctx, [-0.4, -0.4, 0.8, 0.8], "#e7ecea", true);
  if (!detail) return;
  rect(ctx, [-0.37, -0.05, 0.74, 0.012], SURFACE.applianceEdge);
  rect(ctx, [0.27, -0.32, 0.035, 0.2], SURFACE.applianceEdge);
  rect(ctx, [0.27, 0.08, 0.035, 0.2], SURFACE.applianceEdge);
}
function drawToilet(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.bathEdge;
  rect(ctx, [-0.34, -0.44, 0.68, 0.3], SURFACE.bathroom, true);
  ellipse(ctx, 0, 0.17, 0.4, 0.33, SURFACE.bathroom, SURFACE.bathEdge);
  ellipse(ctx, 0, 0.17, 0.22, 0.18, "#d3e0de", detail ? "#9eb7b4" : undefined);
  if (detail) rect(ctx, [-0.12, -0.36, 0.24, 0.035], "#b8cbc8");
}
function drawSink(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.bathEdge;
  rect(ctx, FULL_RECT_RATIO, "#d6e2df", true);
  ellipse(ctx, 0, 0.02, 0.36, 0.34, SURFACE.bathroom, SURFACE.bathEdge);
  ellipse(ctx, 0, 0.02, 0.075, 0.06, "#9cbab5");
  if (detail) {
    circle(ctx, 0, -0.35, 0.045, SURFACE.applianceEdge);
    rect(ctx, [-0.025, -0.34, 0.05, 0.16], SURFACE.applianceEdge);
  }
}
function drawBathtub(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.bathEdge;
  rect(ctx, FULL_RECT_RATIO, "#cbdcda", true);
  rect(ctx, [-0.42, -0.42, 0.84, 0.84], SURFACE.bathroom, true);
  rect(ctx, [-0.35, -0.35, 0.7, 0.7], "#dce9e6", true);
  circle(ctx, 0.25, 0.25, detail ? 0.06 : 0.04, "#9cbab5");
}
function drawBin(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.applianceEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.rubber, true);
  rect(ctx, [-0.4, -0.4, 0.8, 0.8], "#91a1a0");
  rect(ctx, [-0.32, -0.3, 0.64, 0.08], "#687b7c");
  if (detail) {
    rect(ctx, [-0.25, -0.1, 0.025, 0.42], "#687b7c");
    rect(ctx, [-0.01, -0.1, 0.025, 0.42], "#687b7c");
    rect(ctx, [0.23, -0.1, 0.025, 0.42], "#687b7c");
  }
}
function drawRock(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.fillStyle = SURFACE.stone;
  ctx.strokeStyle = "#68736e";
  ctx.beginPath();
  ctx.moveTo(-0.45, -0.08); ctx.lineTo(-0.3, -0.39); ctx.lineTo(0.06, -0.46); ctx.lineTo(0.4, -0.24);
  ctx.lineTo(0.46, 0.16); ctx.lineTo(0.19, 0.43); ctx.lineTo(-0.2, 0.4); ctx.lineTo(-0.45, 0.12); ctx.closePath();
  ctx.fill(); ctx.stroke();
  if (!detail) return;
  ctx.fillStyle = SURFACE.stoneLight;
  ctx.beginPath(); ctx.moveTo(-0.3, -0.35); ctx.lineTo(0.04, -0.42); ctx.lineTo(-0.01, -0.02); ctx.lineTo(-0.4, 0.08); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#727c78";
  ctx.beginPath(); ctx.moveTo(0.04, -0.42); ctx.lineTo(0.4, -0.2); ctx.lineTo(0.39, 0.13); ctx.lineTo(-0.01, -0.02); ctx.closePath(); ctx.fill();
}
function drawTelevision(ctx: CanvasRenderingContext2D, detail: boolean) {
  ctx.strokeStyle = SURFACE.applianceEdge;
  rect(ctx, FULL_RECT_RATIO, SURFACE.monitor, true);
  rect(ctx, [-0.42, -0.42, 0.84, 0.72], SURFACE.screenDark, true);
  if (detail) {
    rect(ctx, [-0.34, -0.32, 0.66, 0.035], "#547078");
    circle(ctx, 0.31, 0.39, 0.025, "#e3c57e");
  }
}
const PROP_DRAWERS: Record<Exclude<Map2dPropKind, "fallback">, (ctx: CanvasRenderingContext2D, detail: boolean) => void> = {
  table: drawTable, bench: drawBench, monitor: drawMonitor, storage: drawStorage, bookcase: drawBookcase,
  chair: (ctx, detail) => drawSeat(ctx, detail, false),
  sofa: (ctx, detail) => drawSeat(ctx, detail, true),
  bed: drawBed, rug: drawRug, lamp: drawLamp, appliance: drawAppliance,
  toilet: drawToilet, sink: drawSink, bathtub: drawBathtub, bin: drawBin, rock: drawRock, television: drawTelevision,
  plant: (ctx, detail) => drawFoliage(ctx, detail, true),
  tree: (ctx, detail) => drawFoliage(ctx, detail, false),
};
function drawFallback(ctx: CanvasRenderingContext2D, prop: RoomLayoutProp, widthPx: number, depthPx: number) {
  const definition = PROP_DEFINITIONS.get(prop.asset);
  const style = map2dPropStyle(definition?.group ?? "", prop.asset);
  ctx.fillStyle = style.color;
  ctx.strokeStyle = MAP2D_DETAIL_PALETTE.border;
  ctx.beginPath();
  if (style.circle) ctx.arc(0, 0, Math.min(widthPx, depthPx) * HALF_RATIO, 0, FULL_CIRCLE_RAD);
  else if (Math.max(widthPx, depthPx) < 14) ctx.ellipse(0, 0, Math.max(2, widthPx * HALF_RATIO), Math.max(2, depthPx * HALF_RATIO), 0, 0, FULL_CIRCLE_RAD);
  else ctx.roundRect(-widthPx * HALF_RATIO, -depthPx * HALF_RATIO, widthPx, depthPx, Math.min(widthPx, depthPx) * 0.18);
  ctx.fill(); ctx.stroke();
}
type UprightLandmarkKind = "tree" | "lamp" | "pole";
function isTallLandmark(kind: Map2dPropKind, heightM: number, asset: string, label = ""): UprightLandmarkKind | null {
  const identity = `${asset} ${label}`;
  if (kind === "tree" || (/(?:tree|pine|sapling)/i.test(identity) && !/(?:stump|fallen|log)/i.test(identity))) return "tree";
  if (kind === "lamp" && heightM >= 1.8) return "lamp";
  if (heightM >= 1.8 && /(?:pole|street.?light|street.?lamp|power.?line)/i.test(identity)) return "pole";
  return null;
}
function drawCompactLandmark(ctx: CanvasRenderingContext2D, kind: UprightLandmarkKind, widthPx: number, heightM: number, pxPerM: number, asset: string): void {
  const heightCapPx = pxPerM < 14 ? COMPACT_LANDMARK_MAX_HEIGHT_PX : 72;
  const heightPx = Math.max(COMPACT_LANDMARK_MIN_HEIGHT_PX, Math.min(heightCapPx, heightM * pxPerM * 0.55));
  const width = Math.max(3, Math.min(pxPerM < 14 ? 10 : 24, widthPx * 0.58));
  ctx.save();
  if (kind === "lamp" || kind === "pole") {
    ctx.strokeStyle = "#526468";
    ctx.lineWidth = Math.max(1, Math.min(2, width * 0.18));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -heightPx + 2); ctx.stroke();
    if (kind === "lamp") {
      ctx.fillStyle = "#f1cd79";
      ctx.beginPath(); ctx.roundRect(-width * 0.48, -heightPx, width * 0.96, Math.max(3, width * 0.55), width * 0.25); ctx.fill();
      ctx.fillStyle = "rgba(245, 213, 134, 0.16)";
      ctx.beginPath(); ctx.ellipse(0, -heightPx + 2, width * 0.9, width * 0.65, 0, 0, FULL_CIRCLE_RAD); ctx.fill();
    } else {
      ctx.strokeStyle = "#687779";
      ctx.lineWidth = Math.max(1, width * 0.16);
      ctx.beginPath(); ctx.moveTo(-width * 0.45, -heightPx * 0.74); ctx.lineTo(width * 0.45, -heightPx * 0.74); ctx.stroke();
      ctx.fillStyle = "#d6bd83";
      ctx.fillRect(-width * 0.55, -heightPx * 0.82, width * 0.16, Math.max(2, width * 0.16));
      ctx.fillRect(width * 0.39, -heightPx * 0.82, width * 0.16, Math.max(2, width * 0.16));
    }
  } else {
    ctx.fillStyle = "#795943";
    ctx.fillRect(-Math.max(1, width * 0.12), -heightPx * 0.42, Math.max(2, width * 0.24), heightPx * 0.42);
    ctx.fillStyle = SURFACE.leafDark;
    ctx.beginPath();
    if (/pine|conifer/i.test(asset)) {
      ctx.moveTo(0, -heightPx); ctx.lineTo(width * 0.48, -heightPx * 0.28); ctx.lineTo(-width * 0.48, -heightPx * 0.28); ctx.closePath();
      ctx.moveTo(0, -heightPx * 0.68); ctx.lineTo(width * 0.42, -heightPx * 0.08); ctx.lineTo(-width * 0.42, -heightPx * 0.08); ctx.closePath();
    } else {
      ctx.ellipse(0, -heightPx * 0.67, width * 0.48, heightPx * 0.3, 0, 0, FULL_CIRCLE_RAD);
    }
    ctx.fill();
    ctx.fillStyle = SURFACE.leafLight;
    ctx.beginPath(); ctx.ellipse(-width * 0.12, -heightPx * 0.73, width * 0.2, heightPx * 0.12, -0.28, 0, FULL_CIRCLE_RAD); ctx.fill();
  }
  ctx.restore();
}
function drawCompactProp(ctx: CanvasRenderingContext2D, prop: RoomLayoutProp, kind: Map2dPropKind,
  widthPx: number, depthPx: number, definition?: (typeof ROOM_PROP_CATALOG)[number]): void {
  const size = Math.max(COMPACT_PROP_MIN_SIZE_PX, Math.min(COMPACT_PROP_MAX_SIZE_PX, Math.max(widthPx, depthPx)));
  const aspect = Math.max(0.62, Math.min(1.5, widthPx / Math.max(depthPx, 0.01)));
  const w = size * Math.sqrt(aspect);
  const h = size / Math.sqrt(aspect);
  const style = map2dPropStyle(definition?.group ?? "", prop.asset);
  ctx.save();
  ctx.fillStyle = "rgba(37, 49, 48, 0.18)";
  ctx.beginPath(); ctx.ellipse(1, 1.5, w * 0.52, h * 0.38, 0, 0, FULL_CIRCLE_RAD); ctx.fill();
  ctx.fillStyle = kind === "plant" ? SURFACE.leaf : style.color;
  ctx.beginPath();
  if (kind === "rock") {
    ctx.moveTo(-w * 0.48, 0); ctx.lineTo(-w * 0.24, -h * 0.42); ctx.lineTo(w * 0.18, -h * 0.46);
    ctx.lineTo(w * 0.48, -h * 0.12); ctx.lineTo(w * 0.3, h * 0.4); ctx.lineTo(-w * 0.32, h * 0.38); ctx.closePath();
  } else if (kind === "plant") {
    ctx.ellipse(0, 0, w * 0.48, h * 0.46, 0, 0, FULL_CIRCLE_RAD);
  } else {
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2);
  }
  ctx.fill();
  if (kind === "lamp") {
    ctx.fillStyle = "#f3d587";
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, Math.min(w, h) * 0.16), 0, FULL_CIRCLE_RAD); ctx.fill();
  }
  ctx.restore();
}
function drawInteractionBadge(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, widthPx: number, depthPx: number) {
  const offsetPx = Math.min(INTERACTION_BADGE_OFFSET_MAX_PX, Math.max(widthPx, depthPx) * INTERACTION_BADGE_OFFSET_RATIO);
  const xPx = screenX + offsetPx;
  const yPx = screenY - offsetPx;
  ctx.save();
  circle(ctx, xPx, yPx, INTERACTION_BADGE_RADIUS_PX, INTERACTION_BADGE_BACKGROUND);
  ctx.fillStyle = INTERACTION_BADGE_INK;
  ctx.font = `600 ${INTERACTION_FONT_PX}px system-ui`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(INTERACTION_GLYPH, xPx, yPx);
  ctx.restore();
}
/** Local normalized shapes retain the authoritative saved footprint and rotation. */
export function drawMap2dProp(ctx: CanvasRenderingContext2D, p: Map2dProjection, prop: RoomLayoutProp): void {
  const ground = worldToScreen(p, prop);
  const elevationPx = (prop.elevation ?? 0) * p.pxPerM;
  const screen = { x: ground.x, y: ground.y - elevationPx };
  const widthPx = prop.width * p.pxPerM;
  const depthPx = prop.depth * p.pxPerM;
  const definition = PROP_DEFINITIONS.get(prop.asset);
  const kind = map2dPropKind(prop.asset, definition?.label);
  const tallLandmark = isTallLandmark(kind, definition?.height ?? 0, prop.asset, definition?.label);
  const detailVisible = map2dPropDetailVisible(widthPx, depthPx);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  // A ground-plane yaw must not tip upright tree and streetlight sprites onto their sides.
  if (!tallLandmark) ctx.rotate(-prop.rotation);
  ctx.lineWidth = OUTLINE_WIDTH_PX;
  const useCompactLod = map2dPropUsesCompactLod(prop.id, Math.max(widthPx, depthPx));
  const topdownImage = hasTopdownPropImage(definition) ? propPreviewImages.get(definition) : null;
  const modelImage = tallLandmark || useCompactLod || topdownImage ? null : map2dPropModelImages.get(definition);
  // Trees and poles are read by their upright silhouette in this oblique map.
  // A footprint-fitted top-down/model thumbnail turns them into flat tiles when
  // zoomed out, so keep their landmark LOD at every zoom level.
  if (tallLandmark)
    drawCompactLandmark(ctx, tallLandmark, widthPx, definition?.height ?? 1.8, p.pxPerM, prop.asset);
  else if (useCompactLod) drawCompactProp(ctx, prop, kind, widthPx, depthPx, definition);
  else if (!useCompactLod && (topdownImage || modelImage)) {
    if (modelImage && definition)
      drawMap2dProjectedModelImage(ctx, modelImage, widthPx, depthPx, definition.height * p.pxPerM);
    else drawMap2dPropImage(ctx, topdownImage!, widthPx, depthPx);
  } else if (kind === "fallback") drawFallback(ctx, prop, widthPx, depthPx);
  else {
    ctx.scale(widthPx, depthPx);
    ctx.lineWidth = OUTLINE_WIDTH_PX / Math.min(widthPx, depthPx);
    ctx.save(); ctx.translate(SHADOW_OFFSET_RATIO, SHADOW_OFFSET_RATIO);
    if (kind === "plant" || kind === "tree") circle(ctx, 0, 0, CANOPY_RADIUS_RATIO, SURFACE.shadow);
    else rect(ctx, FULL_RECT_RATIO, SURFACE.shadow);
    ctx.restore();
    PROP_DRAWERS[kind](ctx, detailVisible);
  }
  ctx.restore();
  if (prop.interaction) drawInteractionBadge(ctx, screen.x, screen.y, widthPx, depthPx);
}
