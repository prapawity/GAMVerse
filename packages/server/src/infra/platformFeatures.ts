import { database } from "./db.js";

export type PlatformFeatureFlags = { mapEditing: boolean; propEditing: boolean };
export const DEFAULT_PLATFORM_FEATURES: PlatformFeatureFlags = { mapEditing: true, propEditing: true };
const FEATURE_KEYS = { mapEditing: "map_editing", propEditing: "prop_editing" } as const;

export async function readPlatformFeatureFlags(): Promise<PlatformFeatureFlags> {
  if (!database) return DEFAULT_PLATFORM_FEATURES;
  const result = await database.query<{ feature_key: string; enabled: boolean }>("SELECT feature_key, enabled FROM app_platform_feature_flags");
  const flags = { ...DEFAULT_PLATFORM_FEATURES };
  for (const row of result.rows) {
    if (row.feature_key === FEATURE_KEYS.mapEditing) flags.mapEditing = row.enabled;
    if (row.feature_key === FEATURE_KEYS.propEditing) flags.propEditing = row.enabled;
  }
  return flags;
}

export async function setPlatformFeatureFlag(key: keyof PlatformFeatureFlags, enabled: boolean): Promise<PlatformFeatureFlags> {
  if (!database) throw new Error("Platform feature switches require the database.");
  await database.query("INSERT INTO app_platform_feature_flags(feature_key, enabled) VALUES ($1, $2) ON CONFLICT (feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()", [FEATURE_KEYS[key], enabled]);
  return readPlatformFeatureFlags();
}
