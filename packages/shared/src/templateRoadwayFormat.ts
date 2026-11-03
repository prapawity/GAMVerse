import type { RoomLayoutRoadway } from "./roomLayout.js";

const MAX_PARALLEL_SMALL_ROAD_GAP_M = 4;
const MIN_PARALLEL_ROAD_OVERLAP_RATIO = 0.8;

function intervalOverlap(aCenter: number, aLength: number, bCenter: number, bLength: number) {
  return Math.max(0, Math.min(aCenter + aLength / 2, bCenter + bLength / 2) - Math.max(aCenter - aLength / 2, bCenter - bLength / 2));
}

/** Merge a close, parallel pair of small template streets into one major street. */
export function formatTemplateRoadways(roadways: readonly RoomLayoutRoadway[]): RoomLayoutRoadway[] {
  const formatted = roadways.map((road) => ({ ...road }));
  for (let firstIndex = 0; firstIndex < formatted.length; firstIndex += 1) {
    const first = formatted[firstIndex]!;
    if (first.kind !== "small") continue;
    const firstHorizontal = first.width >= first.depth;
    const firstAlong = firstHorizontal ? first.width : first.depth;
    const firstAcross = firstHorizontal ? first.depth : first.width;

    for (let secondIndex = firstIndex + 1; secondIndex < formatted.length; secondIndex += 1) {
      const second = formatted[secondIndex]!;
      if (second.kind !== "small" || (second.width >= second.depth) !== firstHorizontal) continue;
      const secondAlong = firstHorizontal ? second.width : second.depth;
      const secondAcross = firstHorizontal ? second.depth : second.width;
      const alongCenterA = firstHorizontal ? first.x : first.z;
      const alongCenterB = firstHorizontal ? second.x : second.z;
      const alongOverlap = intervalOverlap(alongCenterA, firstAlong, alongCenterB, secondAlong);
      if (alongOverlap / Math.min(firstAlong, secondAlong) < MIN_PARALLEL_ROAD_OVERLAP_RATIO) continue;

      const acrossCenterA = firstHorizontal ? first.z : first.x;
      const acrossCenterB = firstHorizontal ? second.z : second.x;
      const gap = Math.abs(acrossCenterA - acrossCenterB) - (firstAcross + secondAcross) / 2;
      if (gap < -0.25 || gap > MAX_PARALLEL_SMALL_ROAD_GAP_M) continue;

      const alongMin = Math.min(alongCenterA - firstAlong / 2, alongCenterB - secondAlong / 2);
      const alongMax = Math.max(alongCenterA + firstAlong / 2, alongCenterB + secondAlong / 2);
      const acrossMin = Math.min(acrossCenterA - firstAcross / 2, acrossCenterB - secondAcross / 2);
      const acrossMax = Math.max(acrossCenterA + firstAcross / 2, acrossCenterB + secondAcross / 2);
      if (firstHorizontal) {
        first.x = (alongMin + alongMax) / 2;
        first.z = (acrossMin + acrossMax) / 2;
        first.width = alongMax - alongMin;
        first.depth = acrossMax - acrossMin;
      } else {
        first.x = (acrossMin + acrossMax) / 2;
        first.z = (alongMin + alongMax) / 2;
        first.width = acrossMax - acrossMin;
        first.depth = alongMax - alongMin;
      }
      first.kind = "major";
      formatted.splice(secondIndex, 1);
      break;
    }
  }
  return formatted;
}
