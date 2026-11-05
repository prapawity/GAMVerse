import { getRealtimeEndpoint } from "../../realtimeEndpoint";
import { AVATAR_SPRITE_TILE_WIDTH_PX, AVATAR_SPRITE_TILE_HEIGHT_PX, AVATAR_SPRITE_POSE_COUNT, AVATAR_SPRITE_DIRECTION_COUNT, AVATAR_SPRITE_ANIMATED_POSE_COUNT, avatarSpriteIdleCycle } from "./avatarSpriteGeometry";
import { queueAvatarSnapshot } from "./avatarPortraitSnapshot";

const PORTRAIT_CACHE_BUDGET_BYTES = 40 * 1024 * 1024;
const CANVAS_BYTES_PER_PIXEL = 4;
const PORTRAIT_BYTES_PER_POSE = AVATAR_SPRITE_TILE_WIDTH_PX * AVATAR_SPRITE_TILE_HEIGHT_PX * AVATAR_SPRITE_DIRECTION_COUNT * CANVAS_BYTES_PER_PIXEL;
const PORTRAIT_ATTEMPT_MAX_CHARACTER_IDS = 512;

/** Full-body atlases share a 40 MiB RGBA canvas budget, including pending renders. */
export class AvatarPortraits {
  private readonly portraits = new Map<string, HTMLCanvasElement>();
  private readonly attempted = new Set<string>();
  private readonly pending = new Set<string>();
  private readonly activeCharacters = new Set<string>();
  private disposed = false;
  private readyFrameId: number | null = null;
  revision = 0;

  constructor(private readonly queueSnapshot = queueAvatarSnapshot) {}

  setActiveCharacters(characterIds: Iterable<string | undefined>): void {
    this.activeCharacters.clear();
    for (const id of characterIds) if (id) this.activeCharacters.add(id);
  }
  idleCycleMs(characterId: string | undefined): number | undefined {
    const portrait = characterId && this.activeCharacters.has(characterId) ? this.portraits.get(characterId) : undefined;
    return portrait ? avatarSpriteIdleCycle(portrait) : undefined;
  }
  private reserveSlot(characterId: string): boolean {
    const poseCount = (id: string) => id.startsWith("custom-") ? AVATAR_SPRITE_ANIMATED_POSE_COUNT : AVATAR_SPRITE_POSE_COUNT;
    let reservedPoses = poseCount(characterId);
    for (const id of this.pending) reservedPoses += poseCount(id);
    for (const id of this.portraits.keys()) reservedPoses += poseCount(id);
    if (reservedPoses * PORTRAIT_BYTES_PER_POSE <= PORTRAIT_CACHE_BUDGET_BYTES) return true;
    for (const id of this.portraits.keys()) {
      if (this.activeCharacters.has(id)) continue;
      this.portraits.delete(id);
      this.attempted.delete(id);
      reservedPoses -= poseCount(id);
      if (reservedPoses * PORTRAIT_BYTES_PER_POSE <= PORTRAIT_CACHE_BUDGET_BYTES) return true;
    }
    return false;
  }
  get(characterId: string | undefined): HTMLCanvasElement | null {
    if (!characterId || this.disposed) return null;
    const portrait = this.portraits.get(characterId);
    if (portrait) return portrait;
    if (this.attempted.has(characterId) || this.attempted.size >= PORTRAIT_ATTEMPT_MAX_CHARACTER_IDS) return null;
    if (!this.reserveSlot(characterId)) return null;
    this.attempted.add(characterId);
    this.pending.add(characterId);
    this.queueSnapshot({
      characterId,
      endpoint: getRealtimeEndpoint(),
      active: () => !this.disposed,
      complete: (canvas) => {
        this.pending.delete(characterId);
        if (canvas) this.store(characterId, canvas);
      },
    });
    return null;
  }
  private store(characterId: string, portrait: HTMLCanvasElement): void {
    if (this.disposed) return;
    this.portraits.set(characterId, portrait);
    if (this.readyFrameId !== null) return;
    this.readyFrameId = requestAnimationFrame(() => {
      this.readyFrameId = null;
      this.revision += 1;
    });
  }
  dispose(): void {
    this.disposed = true;
    if (this.readyFrameId !== null) cancelAnimationFrame(this.readyFrameId);
    this.readyFrameId = null;
    this.portraits.clear();
    this.attempted.clear();
    this.pending.clear();
    this.activeCharacters.clear();
  }
}
