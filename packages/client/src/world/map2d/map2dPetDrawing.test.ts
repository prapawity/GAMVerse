import assert from "node:assert/strict";
import test from "node:test";
import { drawMap2dDynamic, type Map2dSceneActor } from "./map2dDynamicLayer";
import { map2dPetActor } from "./map2dPetDrawing";
import type { Map2dPlayer } from "./map2dAvatarVisual";
import { PET_SPRITE_TILE_SIZE_PX } from "./petSpriteGeometry";

const projection = { center: { x: 0, z: 0 }, pxPerM: 12, widthPx: 800, heightPx: 600, dpr: 1 };
function actorsFor(players: ReadonlyMap<string, Map2dPlayer>): Map2dSceneActor[] {
  let actors: Map2dSceneActor[] = [];
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, key) => key === "measureText" ? () => ({ width: 0 }) : () => {},
    set: () => true,
  });
  drawMap2dDynamic(context, projection, players, "local", new Set(), [], 0, undefined,
    "immersive", [], undefined, [], value => { actors = [...value]; });
  return actors;
}
const owner = { x: 0, z: 0, rotation: 0, username: "alice", displayName: "Alice" };

test("2D scene includes one ground-level pet actor beside its owner", () => {
  const actors = actorsFor(new Map([["local", { ...owner, petId: "gobkit-pet-animal-corgi" }]]));
  assert.equal(actors.length, 2);
  assert.ok(Math.abs(actors[1].x - owner.x) > 0);
  assert.ok(Math.hypot(actors[1].x - owner.x, actors[1].z - owner.z) < 2);
  assert.equal(actors[1].elevation, 0);
});

test("missing pets and far-away owners add no pet actors", () => {
  assert.equal(actorsFor(new Map([["local", owner]])).length, 1);
  assert.equal(actorsFor(new Map([["remote", { ...owner, x: 200, petId: "cat" }]])).length, 0);
});

test("pet follows owner movement/rotation and disappears on deselection", () => {
  const players = new Map([["local", { ...owner, petId: "cat" }]]);
  const first = actorsFor(players)[1];
  players.set("local", { ...owner, x: 8, z: 4, rotation: Math.PI / 2, petId: "cat" });
  const moved = actorsFor(players)[1];
  assert.ok(Math.hypot(moved.x - 8, moved.z - 4) < 2);
  assert.notEqual(moved.x - 8, first.x);
  players.set("local", { ...owner, petId: "" });
  assert.equal(actorsFor(players).length, 1);
});

test("2D pet actor draws a transparent full-body sprite row for its facing", () => {
  const sprite = {} as HTMLCanvasElement;
  const sourceRects: number[][] = [];
  let circles = 0;
  let clips = 0;
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, key) => key === "drawImage" ? (...args: number[]) => sourceRects.push(args.slice(1, 5))
      : key === "arc" ? () => { circles += 1; }
        : key === "clip" ? () => { clips += 1; } : () => {},
    set: () => true,
  });
  const actor = map2dPetActor("local", { ...owner, rotation: Math.PI / 2, petId: "gobkit-pet-animal-corgi",
    visual: { motion: "walking", stridePhaseRad: Math.PI } }, { get: () => sprite });
  assert.ok(actor);
  actor.draw(context, projection);
  assert.deepEqual(sourceRects, [[3 * PET_SPRITE_TILE_SIZE_PX, 2 * PET_SPRITE_TILE_SIZE_PX,
    PET_SPRITE_TILE_SIZE_PX, PET_SPRITE_TILE_SIZE_PX]]);
  assert.equal(circles, 0);
  assert.equal(clips, 0);
});

test("pet actor draws different atlas cells over time while its owner walks", () => {
  const sprite = {} as HTMLCanvasElement;
  const drawAt = (nowMs: number) => {
    const sourceRects: number[][] = [];
    const context = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, key) => key === "drawImage" ? (...args: number[]) => sourceRects.push(args.slice(1, 5)) : () => {},
      set: () => true,
    });
    const actor = map2dPetActor("local", { ...owner, petId: "corgi",
      visual: { motion: "walking", stridePhaseRad: 0 } }, { get: () => sprite }, nowMs);
    actor?.draw(context, projection);
    return sourceRects[0]?.[0];
  };
  assert.notEqual(drawAt(0), drawAt(700));
});
