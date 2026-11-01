import { ROOM_PROP_CATALOG, type RoomPropDefinition } from "./roomLayout.js";
import type { StarterPlacement } from "./campusFurnishingTemplates.js";

/** Furniture roles a themed studio can restyle; every other placement keeps its default asset. */
export type ThemeSlot = "desk" | "chair" | "bed" | "storage" | "lamp" | "rug" | "plant" | "decor";
export type TeamTheme = { id: string; label: string; wallAssets?: readonly string[] };

/** [catalog group pattern, exact label] pairs, tried in order, for each slot a theme can restyle. */
type Pick = readonly [group: RegExp, label: string];
type ThemeSource = { theme: TeamTheme; slots: Partial<Record<ThemeSlot, readonly Pick[]>> };

const GEOMETRY_TOLERANCE_M = 0.25;
const SUPPORT_SIZE_TOLERANCE_M = 0.001;
const MAX_HEIGHT_FACTOR = 2;
const MIN_HEIGHT_ALLOWANCE_M = 1.2;
/** Which placement keys of a studio template belong to which restylable slot. */
const SLOT_OF_KEY: Readonly<Record<string, ThemeSlot>> = {
  desk: "desk", chair: "chair", bed: "bed", storage: "storage", lamp: "lamp", rug: "rug", plant: "plant", decor: "decor",
};
/** What kind of catalog item may stand in for each slot, so a bed never becomes a rug and decor still rests on a surface. */
const SLOT_CLASSES: Readonly<Record<ThemeSlot, readonly string[]>> = {
  desk: ["surface"], chair: ["seat"], bed: ["floor"], storage: ["floor", "shelf"], lamp: ["floor"], rug: ["floor"], plant: ["floor"], decor: ["small"],
};

const wall = (needle: string) => (ROOM_PROP_CATALOG as readonly RoomPropDefinition[]).filter(item => item.asset.includes(needle)).map(item => item.asset);

const COZY = /Cozy Home Interiors/, OFFICE = /Pixel Modern Office/, SUSHI = /Sushi Restaurant/, KAYKIT = /KayKit Forest Nature/, MINI_FOREST = /^Forest$/, KENNEY_NATURE = /Kenney Nature Kit/,
  DUNGEON = /^Dungeon$/, PIRATE = /^Pirate Kit$/, FACTORY = /^Factory$/, INDUSTRIAL = /^Industrial$/, FOOD = /^Food$/, QUATERNIUS = /Quaternius Stylized Nature/, PARK = /City Park and Playground/, SUBURBAN = /Outdoor · Landscaping/;

/**
 * One look per team, cycled when a campus has more than ten teams. A slot a theme cannot fill keeps the default
 * studio furniture, so a thin theme (Pirate, Café) restyles only what its own pack offers.
 */
const SOURCES: readonly ThemeSource[] = [
  { theme: { id: "cozy-home", label: "Cozy Home" }, slots: { desk: [[COZY, "Bedroom Desk"]], chair: [[COZY, "Desk Chair"]], bed: [[COZY, "Single Bed"]], storage: [[COZY, "Bookcase"]], rug: [[COZY, "Throw Blanket"]], plant: [[COZY, "Plant Large"]], decor: [[COZY, "Board Game Stack"]] } },
  { theme: { id: "modern-office", label: "Modern Office" }, slots: { desk: [[OFFICE, "L Shaped Desk"]], chair: [[OFFICE, "Task Chair"]], storage: [[OFFICE, "Bookshelf With Binders"]], plant: [[OFFICE, "Potted Monstera"]], decor: [[OFFICE, "Mug And Notebook Set"]] } },
  { theme: { id: "sushi", label: "Sushi House" }, slots: { desk: [[SUSHI, "Table"]], chair: [[SUSHI, "Chair 1"]], plant: [[SUSHI, "Plant 2"]], decor: [[SUSHI, "Onigiri"], [SUSHI, "Ramen"]] } },
  { theme: { id: "forest-cabin", label: "Forest Cabin" }, slots: { bed: [[KENNEY_NATURE, "Bed"]], rug: [[MINI_FOREST, "Patch Grass"]], plant: [[KAYKIT, "Bush 1 B Color1"], [KAYKIT, "Bush 2 B Color1"]], decor: [[MINI_FOREST, "Plant"]] } },
  { theme: { id: "dungeon", label: "Dungeon" }, slots: { desk: [[DUNGEON, "Table"]], chair: [[DUNGEON, "Chair"]], storage: [[DUNGEON, "Chest"]], rug: [[DUNGEON, "Dirt"]], plant: [[DUNGEON, "Pot"]], decor: [[DUNGEON, "Potion"], [DUNGEON, "Key"]] } },
  { theme: { id: "pirate", label: "Pirate Cove" }, slots: { storage: [[PIRATE, "Chest"]], plant: [[PIRATE, "Barrel"]] } },
  { theme: { id: "industrial-loft", label: "Industrial Loft" }, slots: { storage: [[FACTORY, "Box Small"]], rug: [[FACTORY, "Conveyor Bars Stripe"]], plant: [[INDUSTRIAL, "Detail Tank"]] } },
  { theme: { id: "cafe", label: "Café" }, slots: { decor: [[FOOD, "Cup Coffee"], [FOOD, "Cake"], [FOOD, "Cupcake"]] } },
  { theme: { id: "meadow", label: "Meadow" }, slots: { bed: [[KENNEY_NATURE, "Bed"]], rug: [[QUATERNIUS, "RockPath Square Small 2"]], plant: [[QUATERNIUS, "Clover 1"], [QUATERNIUS, "Clover 2"]] } },
  { theme: { id: "small-town", label: "Small Town" }, slots: { rug: [[QUATERNIUS, "RockPath Square Small 2"]], plant: [[SUBURBAN, "Planter"]], lamp: [[PARK, "Park Lamp Post"]] } },
];

export const TEAM_THEME_COUNT = SOURCES.length;
export const TEAM_THEMES: readonly TeamTheme[] = SOURCES.map(source => source.theme);

export function teamThemeIndex(teamNumber: number): number {
  return ((Math.max(1, teamNumber) - 1) % TEAM_THEME_COUNT);
}
export function teamThemeFor(teamNumber: number): TeamTheme {
  return TEAM_THEMES[teamThemeIndex(teamNumber)]!;
}

const catalog = ROOM_PROP_CATALOG as readonly RoomPropDefinition[];
/** Catalog labels carry a pack prefix ("Dungeon · Chair") and a source suffix ("(Pixel Modern Office)"); themes name the item only. */
const plainLabel = (label: string) => label.replace(/ \(.*\)$/, "").replace(/^.* · /, "");
const byAsset = new Map(catalog.map(item => [item.asset, item]));
const candidateCache = new Map<string, readonly RoomPropDefinition[]>();

/** Catalog items a theme offers for a slot, in preference order. */
function themeCandidates(themeIndex: number, slot: ThemeSlot): readonly RoomPropDefinition[] {
  const cacheKey = `${themeIndex}:${slot}`;
  const cached = candidateCache.get(cacheKey);
  if (cached) return cached;
  const picks = SOURCES[themeIndex]!.slots[slot] ?? [];
  const found = picks.flatMap(([group, label]) => catalog.filter(item => group.test(item.group ?? "") && plainLabel(item.label) === label));
  candidateCache.set(cacheKey, found);
  return found;
}

function stableIndex(identity: string, size: number): number {
  let hash = 2166136261;
  for (const character of identity) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % size;
}

/** The themed asset for a slot, or the default when the theme has nothing that fits the slot's footprint and kind. */
export function themedAsset(themeIndex: number, slot: ThemeSlot, defaultAsset: string, identity: string): string {
  const base = byAsset.get(defaultAsset);
  if (!base) return defaultAsset;
  // A desk or shelf that carries monitors, keyboards or decor must offer the same kind of surface at the same size.
  const carries = base.supportsPlacement !== undefined;
  const fits = themeCandidates(themeIndex, slot).filter(item => (!carries || (item.supportsPlacement === base.supportsPlacement
      && Math.abs(item.width - base.width) <= SUPPORT_SIZE_TOLERANCE_M && Math.abs(item.depth - base.depth) <= SUPPORT_SIZE_TOLERANCE_M))
    && SLOT_CLASSES[slot].includes(item.placementClass ?? "")
    && item.width <= base.width + GEOMETRY_TOLERANCE_M && item.depth <= base.depth + GEOMETRY_TOLERANCE_M
    && item.height <= Math.max(base.height * MAX_HEIGHT_FACTOR, MIN_HEIGHT_ALLOWANCE_M));
  return fits.length ? fits[stableIndex(identity, fits.length)]!.asset : defaultAsset;
}

/** Restyles a studio's placements with its team's theme, keeping geometry, rotation and support exactly as authored. */
export function applyTeamTheme(placements: readonly StarterPlacement[], teamNumber: number, roomId: string): StarterPlacement[] {
  const themeIndex = teamThemeIndex(teamNumber);
  return placements.map(placement => {
    const slot = SLOT_OF_KEY[placement.key] ?? SLOT_OF_KEY[placement.key.replace(/^wing-[we]-/, "").replace(/-\d+$/, "")];
    return slot ? { ...placement, asset: themedAsset(themeIndex, slot, placement.asset, `${roomId}:${placement.key}`) } : { ...placement };
  });
}

/** Accent-wall assets that belong to a team's theme (empty when the theme has none). */
export function teamThemeWallAssets(teamNumber: number): readonly string[] {
  const id = teamThemeFor(teamNumber).id;
  if (id === "cozy-home") return wall("cozy-home-interiors-wall-straight").concat(wall("cozy-home-interiors-wall-window"));
  if (id === "modern-office") return wall("pixel-modern-office-wall-bay").concat(wall("pixel-modern-office-glass-partition"));
  if (id === "sushi") return wall("quaternius-sushi-wall");
  return [];
}
