import { GOBKIT_PET_THUMBNAIL_ATLAS, gobkitPetThumbnailPosition, petPreviewUrl, quaterniusPetPreviewCrop } from "../../assets/characterAssets";
import { PET_SPRITE_ATLAS_HEIGHT_PX, PET_SPRITE_ATLAS_WIDTH_PX, PET_SPRITE_DIRECTION_COUNT, PET_SPRITE_POSE_COUNT,
  PET_SPRITE_TILE_SIZE_PX, PET_SPRITE_WALK_FRAME_COUNT, petSpriteWalkRootPose } from "./petSpriteGeometry";

const PET_THUMBNAIL_COLUMNS = 8;
const PET_THUMBNAIL_ROWS = 9;
const PET_THUMBNAIL_INSET_RATIO = 0.76;
const imageCache = new Map<string, Promise<HTMLImageElement>>();

export type PetThumbnailSource = { x: number; y: number; width: number; height: number };

export function petThumbnailSource(petId: string, imageWidth: number, imageHeight: number): { url: string; source: PetThumbnailSource } {
  const position = gobkitPetThumbnailPosition(petId);
  if (position) {
    const tileWidth = imageWidth / PET_THUMBNAIL_COLUMNS;
    const tileHeight = imageHeight / PET_THUMBNAIL_ROWS;
    return { url: GOBKIT_PET_THUMBNAIL_ATLAS,
      source: { x: position.x * tileWidth, y: position.y * tileHeight, width: tileWidth, height: tileHeight } };
  }
  const monsterCrop = quaterniusPetPreviewCrop(petId);
  if (monsterCrop) {
    const scaleX = imageWidth / 1920;
    const scaleY = imageHeight / 1080;
    return { url: petPreviewUrl(petId), source: {
      x: monsterCrop.x * scaleX, y: monsterCrop.y * scaleY,
      width: monsterCrop.width * scaleX, height: monsterCrop.height * scaleY,
    } };
  }
  return { url: petPreviewUrl(petId), source: { x: 0, y: 0, width: imageWidth, height: imageHeight } };
}

export function drawPetFallbackAtlas(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  source: PetThumbnailSource,
): void {
  const fitScale = Math.min(PET_SPRITE_TILE_SIZE_PX * PET_THUMBNAIL_INSET_RATIO / source.width,
    PET_SPRITE_TILE_SIZE_PX * PET_THUMBNAIL_INSET_RATIO / source.height);
  const width = source.width * fitScale;
  const height = source.height * fitScale;
  for (let direction = 0; direction < PET_SPRITE_DIRECTION_COUNT; direction += 1) {
    for (let pose = 0; pose < PET_SPRITE_POSE_COUNT; pose += 1) {
      const frame = pose === 0 ? null : petSpriteWalkRootPose(pose - 1);
      context.save();
      context.translate(
        pose * PET_SPRITE_TILE_SIZE_PX + PET_SPRITE_TILE_SIZE_PX / 2,
        direction * PET_SPRITE_TILE_SIZE_PX + PET_SPRITE_TILE_SIZE_PX / 2 - (frame?.liftM ?? 0) / 1.1 * PET_SPRITE_TILE_SIZE_PX,
      );
      context.rotate(frame?.leanRad ?? 0);
      context.scale(direction >= 3 && direction <= 5 ? -1 : 1, frame?.verticalScale ?? 1);
      context.drawImage(image, source.x, source.y, source.width, source.height, -width / 2, -height / 2, width, height);
      context.restore();
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  let image = imageCache.get(url);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Could not load pet fallback image: ${url}`));
      element.src = url;
    });
    imageCache.set(url, image);
    void image.catch(() => imageCache.delete(url));
  }
  return image;
}

/** Bake existing pet artwork into the map atlas without requiring WebGL. */
export async function createPetFallbackAtlas(petId: string): Promise<HTMLCanvasElement | null> {
  const preview = petPreviewUrl(petId);
  const gobkitPosition = gobkitPetThumbnailPosition(petId);
  const image = await loadImage(gobkitPosition ? GOBKIT_PET_THUMBNAIL_ATLAS : preview);
  const source = petThumbnailSource(petId, image.naturalWidth, image.naturalHeight).source;
  const canvas = document.createElement("canvas");
  canvas.width = PET_SPRITE_ATLAS_WIDTH_PX;
  canvas.height = PET_SPRITE_ATLAS_HEIGHT_PX;
  const context = canvas.getContext("2d");
  if (!context) return null;
  drawPetFallbackAtlas(context, image, source);
  return canvas;
}
