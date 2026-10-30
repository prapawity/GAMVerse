export type NamedClip = { name: string };
export type CharacterClips<T extends NamedClip> = { idle?: T; walk?: T; run?: T; sit?: T; dance?: T };

// Exported models rarely call a clip just "walk": Mixamo and Blender add prefixes such as "Armature|" or "mixamo.com|"
// and use words like "Walking" or "Standing Idle". The word lists below accept those while leaving unrelated clips alone.
const CLIP_PATTERNS = {
  idle: /\b(idle|standing|breath\w*)/i,
  walk: /\bwalk/i,
  run: /\b(run|running|jog|jogging|sprint\w*)\b/i,
  sit: /\b(sit|sitting)\b/i,
  dance: /danc(e|ing)/i,
} as const;
const NAME_SEPARATORS = /[|:_.\-/\s]+/g;

const normalised = (name: string) => name.replace(NAME_SEPARATORS, " ").trim().toLowerCase();

function find<T extends NamedClip>(clips: readonly T[], kind: keyof typeof CLIP_PATTERNS): T | undefined {
  const exact = clips.find(clip => normalised(clip.name) === kind);
  if (exact) return exact;
  // Whole words only, so "Runway pose" is not a run clip and "Situp" is not a sit clip.
  return clips.find(clip => CLIP_PATTERNS[kind].test(normalised(clip.name)));
}

export function pickCharacterClips<T extends NamedClip>(clips: readonly T[]): CharacterClips<T> {
  const walk = find(clips, "walk");
  const sit = find(clips, "sit");
  const run = find(clips.filter(clip => clip !== walk), "run");
  // "Sitting Idle" is a sitting pose, not the standing idle.
  const idle = find(clips.filter(clip => clip !== sit), "idle");
  return { idle, walk, run, sit, dance: find(clips, "dance") };
}

/**
 * Decides whether a model's limbs are driven by the bone-name based procedural rig instead of its own clips.
 * Packs that ship T-pose models always use it. An uploaded model uses it when it has no walk clip, otherwise it
 * would stay in its T-pose while moving.
 */
export function shouldUseProceduralRig(characterId: string, clips: CharacterClips<NamedClip>): boolean {
  if (characterId.startsWith("character-pm-") || characterId.startsWith("character-kaykit-")) return true;
  return characterId.startsWith("custom-") && !clips.walk;
}
