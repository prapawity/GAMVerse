export interface RenderQualitySettings {
  pixelRatio: number;
  shadows: boolean;
}

export function renderQualitySettings(devicePixelRatio: number, powerSaver: boolean): RenderQualitySettings {
  const safeRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return { pixelRatio: Math.min(safeRatio, powerSaver ? 1 : 1.75), shadows: !powerSaver };
}
