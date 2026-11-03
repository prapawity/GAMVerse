import assert from "node:assert/strict";
import test from "node:test";
import { PET_SPRITE_ATLAS_HEIGHT_PX, PET_SPRITE_ATLAS_WIDTH_PX } from "./petSpriteGeometry";
import { QUATERNIUS_PETS } from "../../assets/characterAssets";
import { PetSpriteAtlases } from "./petSpriteAtlases";
import { drawPetFallbackAtlas, petThumbnailSource } from "./petSpriteFallback";

test("WebGL failure falls back to an existing pet image instead of a circle or blank marker", async () => {
  const fallbackSprite = {} as HTMLCanvasElement;
  const atlases = new PetSpriteAtlases(
    request => request.complete(null),
    async () => fallbackSprite,
    () => true,
  );
  atlases.setActivePets(["animal-cat"]);
  assert.equal(atlases.get("animal-cat"), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(atlases.get("animal-cat"), fallbackSprite);
  assert.equal(atlases.revision, 1);
  atlases.dispose();
});

test("failed GLB atlas generation also loads the non-WebGL preview fallback", async () => {
  const fallbackSprite = {} as HTMLCanvasElement;
  const atlases = new PetSpriteAtlases(
    request => request.complete(null),
    async () => fallbackSprite,
    () => false,
  );
  atlases.setActivePets(["gobkit-pet-animal-corgi"]);
  assert.equal(atlases.get("gobkit-pet-animal-corgi"), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(atlases.get("gobkit-pet-animal-corgi"), fallbackSprite);
  assert.equal(atlases.revision, 1);
  atlases.dispose();
});

test("healthy GLB atlas requests do not bake a fallback while their queue job is pending", () => {
  let fallbackCalls = 0;
  const atlases = new PetSpriteAtlases(
    () => {},
    async () => { fallbackCalls += 1; return {} as HTMLCanvasElement; },
    () => false,
  );
  atlases.setActivePets(["animal-cat"]);
  atlases.get("animal-cat");
  atlases.get("animal-cat");
  assert.equal(fallbackCalls, 0);
  atlases.dispose();
});

test("a failed active fallback does not retry on every map redraw", async () => {
  let fallbackCalls = 0;
  const atlases = new PetSpriteAtlases(
    () => {},
    async () => { fallbackCalls += 1; throw new Error("preview unavailable"); },
    () => true,
  );
  atlases.setActivePets(["gobkit-pet-animal-corgi"]);
  atlases.get("gobkit-pet-animal-corgi");
  await new Promise(resolve => setTimeout(resolve, 0));
  atlases.get("gobkit-pet-animal-corgi");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fallbackCalls, 1);
  atlases.setActivePets([]);
  atlases.setActivePets(["gobkit-pet-animal-corgi"]);
  atlases.get("gobkit-pet-animal-corgi");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fallbackCalls, 2);
  atlases.dispose();
});

test("existing thumbnail sources crop GobKit atlas cells, named Quaternius faces and Kenney previews", () => {
  const gobkit = petThumbnailSource("gobkit-pet-animal-corgi", 1024, 792);
  assert.equal(gobkit.url, "/assets/external/pets/gobkit/gobkit-pet-thumbnails.png");
  assert.deepEqual(gobkit.source, { x: 256, y: 88, width: 128, height: 88 });
  const kenney = petThumbnailSource("animal-cat", 256, 256);
  assert.equal(kenney.url, "/assets/kenney/cube-pets/Previews/animal-cat.png");
  assert.deepEqual(kenney.source, { x: 0, y: 0, width: 256, height: 256 });
  const quaterniusIds = Object.keys(QUATERNIUS_PETS);
  const quaterniusSources = quaterniusIds.map(id => petThumbnailSource(id, 1920, 1080));
  assert.equal(new Set(quaterniusSources.map(({ source }) => `${source.x}:${source.y}`)).size, quaterniusIds.length);
  assert.equal(quaterniusSources.length, 21);
  assert.ok(quaterniusSources.every(({ source }) => source.width > 0 && source.height > 0
    && source.x >= 0 && source.y >= 0 && source.x + source.width <= 1920 && source.y + source.height <= 1080));
  assert.deepEqual(quaterniusSources[0]?.source, { x: 980, y: 600, width: 260, height: 240 });
  assert.deepEqual(quaterniusSources[20]?.source, { x: 75, y: 85, width: 220, height: 210 });
});

test("the 2D fallback bakes a full directional atlas with animated walk poses", () => {
  const draws: number[][] = [];
  const transforms: string[] = [];
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, key) => {
      if (key === "drawImage") return (...args: number[]) => draws.push(args.slice(1));
      if (key === "rotate") return (angle: number) => { transforms.push(`r:${angle}`); };
      if (key === "scale") return (x: number, y: number) => { transforms.push(`s:${x}:${y}`); };
      return () => {};
    },
  });
  drawPetFallbackAtlas(context, {} as CanvasImageSource, { x: 0, y: 0, width: 128, height: 88 });
  assert.equal(draws.length, 8 * 5);
  assert.equal(draws[0]![4], -draws[0]![6] / 2);
  assert.ok(transforms.filter(value => value.startsWith("r:")).every(value => Math.abs(Number(value.slice(2))) <= 0.1));
  assert.ok(transforms.some(value => value === "s:-1:1"));
  assert.ok(transforms.some(value => value === "s:1:0.94"));
  assert.equal(PET_SPRITE_ATLAS_WIDTH_PX, 5 * 64);
  assert.equal(PET_SPRITE_ATLAS_HEIGHT_PX, 8 * 64);
});
