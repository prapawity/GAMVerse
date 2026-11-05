const MESHOPT = "EXT_meshopt_compression";
const MAX_DECODED_BYTES = 64 * 1024 * 1024;

type MeshoptView = {
  buffer?: number;
  byteOffset?: number;
  byteLength?: number;
  byteStride?: number;
  count?: number;
  extensions?: Record<string, MeshoptView>;
};

function fitsBuffer(view: MeshoptView, bufferBytes: number): boolean {
  const offset = view.byteOffset ?? 0;
  const length = view.byteLength ?? 0;
  return Number.isSafeInteger(offset) && offset >= 0 &&
    Number.isSafeInteger(length) && length > 0 && length <= bufferBytes - offset;
}

/** A required Meshopt extension can replace an uncompressed buffer with a URI-less placeholder. */
export function hasEmbeddedMeshoptFallback(json: Record<string, unknown>, binaryLength: number): boolean {
  const buffers = json.buffers as (MeshoptView & { uri?: unknown })[];
  const [source, fallback] = buffers;
  if (buffers.length !== 2 || !source || typeof source !== "object" || !fallback || typeof fallback !== "object" ||
      "uri" in source || "uri" in fallback ||
      !Array.isArray(json.extensionsRequired) || !json.extensionsRequired.includes(MESHOPT) ||
      !Array.isArray(json.bufferViews)) return false;
  const sourceBytes = source.byteLength ?? 0;
  const fallbackBytes = fallback.byteLength ?? 0;
  if (!Number.isSafeInteger(sourceBytes) || sourceBytes <= 0 || sourceBytes > binaryLength ||
      !Number.isSafeInteger(fallbackBytes) || fallbackBytes <= 0 || fallbackBytes > MAX_DECODED_BYTES) return false;

  let decodedBytes = 0;
  let hasFallbackView = false;
  for (const view of json.bufferViews as MeshoptView[]) {
    if (!view || !fitsBuffer(view, view.buffer === 0 ? sourceBytes : fallbackBytes)) return false;
    const compressed = view.extensions?.[MESHOPT];
    if (view.buffer === 1 && !compressed) return false;
    if (view.buffer !== 0 && view.buffer !== 1) return false;
    if (!compressed) continue;

    const count = compressed.count ?? 0;
    const stride = compressed.byteStride ?? 0;
    if (compressed.buffer !== 0 || !fitsBuffer(compressed, sourceBytes) ||
        !Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(stride) || stride <= 0 ||
        stride > 256 || count * stride !== view.byteLength) return false;
    decodedBytes += count * stride;
    if (decodedBytes > MAX_DECODED_BYTES) return false;
    if (view.buffer === 1) hasFallbackView = true;
  }
  return hasFallbackView;
}
