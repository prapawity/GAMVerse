import assert from "node:assert/strict";
import test from "node:test";
import { drawMap2dProximityDomes } from "./map2dProximityDome";

test("2D proximity domes draw scaled translucent discs with the local group on top", () => {
  const arcs: Array<[number, number, number]> = [];
  const stops: string[][] = [];
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, key) => {
      if (key === "createRadialGradient") return () => {
        const gradientStops: string[] = [];
        stops.push(gradientStops);
        return { addColorStop: (_offset: number, color: string) => gradientStops.push(color) };
      };
      if (key === "arc") return (x: number, y: number, radius: number) => arcs.push([x, y, radius]);
      return () => {};
    },
    set: () => true,
  });
  drawMap2dProximityDomes(context, { center: { x: 0, z: 0 }, pxPerM: 10, widthPx: 800, heightPx: 600, dpr: 1 }, [
    { key: "remote", own: false, shape: { x: -2, z: 1, radius: 3 } },
    { key: "own", own: true, shape: { x: 2, z: -1, radius: 4 } },
  ]);

  assert.deepEqual(arcs, [[380, 310, 30], [420, 290, 40]]);
  assert.equal(stops.length, 2);
  assert.ok(stops[0]![1]!.includes("0.2"));
  assert.ok(stops[1]![1]!.includes("0.35"));
});
