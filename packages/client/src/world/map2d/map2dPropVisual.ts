export type Map2dPropKind = "table" | "chair" | "sofa" | "bench" | "monitor" | "storage" | "bookcase" | "bed" | "rug" | "lamp" | "appliance" | "toilet" | "sink" | "bathtub" | "bin" | "rock" | "television" | "plant" | "tree" | "fallback";
export const MAP2D_PROP_DETAIL_MIN_SIZE_PX = 12;
const PROP_KIND_PATTERNS: readonly [RegExp, Map2dPropKind][] = [
  [/^(?:kit:)?computerscreen$/, "monitor"],
  [/^(?:kit:)?(?:bed(?:single|double|bunk)?|mattress)$/, "bed"],
  [/^(?:kit:)?(?:desk|table(?:coffee(?:glass)?(?:square)?|glass|round|cross(?:cloth)?)?|sidetable(?:drawers)?)$|^quaternius-sushi-table$/, "table"],
  [/^(?:kit:)?(?:chair(?:desk|cushion|rounded)?|loungechair(?:relax)?)$|^quaternius-sushi-chair-[12]$/, "chair"],
  [/^kit:loungesofa(?:long|ottoman)?$|^quaternius-(?:sushi-sofa|zombie-couch)$/, "sofa"],
  [/^kit:bench(?:cushion(?:low)?)?$|^quaternius-sushi-bench$/, "bench"],
  [/^kit:bookcaseopen(?:low)?$|^office-wall-shelf$/, "bookcase"],
  [/^kit:(?:bookcaseclosed(?:doors|wide)?|cabinetbed(?:drawer(?:table)?)?)$/, "storage"],
  [/^(?:kit:)?(?:floortilecarpet|rug|doormat)$/, "rug"],
  [/^(?:kit:)?(?:lamp(?:round|square|desk|floor)?|floorlamp|streetlamp)$/, "lamp"],
  [/^(?:kit:)?(?:fridge|refrigerator|washer|dryer|washerdryerstacked|stove|oven|dishwasher)$/, "appliance"],
  [/^(?:kit:)?(?:toilet|toiletsquare)$/, "toilet"],
  [/^(?:kit:)?(?:bathroomsink|kitchensink|sink)$/, "sink"],
  [/^(?:kit:)?(?:bathtub|bath)$/, "bathtub"],
  [/^(?:kit:)?(?:trashcan|wastebasket|bin)$/, "bin"],
  [/^(?:kit:)?(?:rock|boulder|stones|rocks)$/, "rock"],
  [/^(?:kit:)?(?:television(?:modern|vintage|antenna)?|tv)$/, "television"],
  [/^(?:kit:)?pottedplant$|^quaternius-sushi-plant-[12]$/, "plant"],
  [/(?:^|[-:])tree(?:[-_](?:small|large|tall|round|pine|oak|[a-z]|\d+))?$|(?:^|[-:])(?:pine|sapling)$/, "tree"],
];
/** Asset names are deliberately specific: pack/group names must not replace unrelated objects. */
export function map2dPropKind(asset: string, label?: string): Map2dPropKind {
  const assetKind = PROP_KIND_PATTERNS.find(([pattern]) => pattern.test(asset.toLowerCase()))?.[1];
  if (assetKind) return assetKind;
  if (!label) return "fallback";
  const name = label.toLowerCase();
  if (/\b(sofa|couch|loveseat)\b/.test(name)) return "sofa";
  if (/\b(chair|seat|stool|armchair)\b/.test(name)) return "chair";
  if (/\b(bench)\b/.test(name)) return "bench";
  if (/\b(bookcase|bookshelf|shelf)\b/.test(name)) return "bookcase";
  if (/\b(bed|mattress)\b/.test(name)) return "bed";
  if (/\b(rug|carpet|doormat)\b/.test(name)) return "rug";
  if (/\b(lamp|light)\b/.test(name)) return "lamp";
  if (/\b(fridge|refrigerator|washer|dryer|stove|oven|dishwasher)\b/.test(name)) return "appliance";
  if (/\b(toilet|wc)\b/.test(name)) return "toilet";
  if (/\b(sink|basin)\b/.test(name)) return "sink";
  if (/\b(bathtub|bath)\b/.test(name)) return "bathtub";
  if (/\b(trash|wastebasket|bin)\b/.test(name)) return "bin";
  if (/\b(rock|boulder|stone)\b/.test(name)) return "rock";
  if (/\b(television|tv)\b/.test(name)) return "television";
  if (/\b(plant|flower|shrub|bush)\b/.test(name)) return "plant";
  if (/\b(tree|pine|sapling)\b/.test(name)) return "tree";
  if (/\b(desk|table|counter)\b/.test(name)) return "table";
  return "fallback";
}
export function map2dPropDetailVisible(widthPx: number, depthPx: number): boolean {
  return Math.min(widthPx, depthPx) >= MAP2D_PROP_DETAIL_MIN_SIZE_PX;
}
