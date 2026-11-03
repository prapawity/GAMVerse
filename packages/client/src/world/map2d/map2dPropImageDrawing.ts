import { fitPropIconRect } from "./map2dStaticDetail";

export type Map2dPropImage = HTMLImageElement | HTMLCanvasElement;

export function drawMap2dPropImage(
  ctx: CanvasRenderingContext2D,
  image: Map2dPropImage,
  widthPx: number,
  depthPx: number,
  liftPx = 0,
): void {
  const imageWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const imageHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  if (liftPx <= 0) {
    const icon = fitPropIconRect(imageWidth, imageHeight, widthPx, depthPx);
    ctx.drawImage(image, icon.x, icon.y, icon.width, icon.height);
    return;
  }
  ctx.drawImage(image, -widthPx / 2, -depthPx / 2 - liftPx, widthPx, depthPx + liftPx);
}

/**
 * Draw a 3D model sprite using the same shallow camera projection as the
 * thumbnail renderer. Its ground footprint stays centered on the saved prop
 * coordinates instead of anchoring the entire image to the footprint's near
 * edge (which made tall props drift into nearby walls).
 */
export function drawMap2dProjectedModelImage(
  ctx: CanvasRenderingContext2D,
  image: Map2dPropImage,
  widthPx: number,
  depthPx: number,
  heightPx: number,
): void {
  const depthProjection = 0.78;
  const heightProjection = 0.62;
  const cameraTargetHeightRatio = 0.34;
  const visibleHeightPx = depthPx * depthProjection + heightPx * heightProjection;
  const targetOffsetPx = heightPx * heightProjection * cameraTargetHeightRatio;
  ctx.drawImage(image, -widthPx / 2, -targetOffsetPx - visibleHeightPx / 2, widthPx, visibleHeightPx);
}
