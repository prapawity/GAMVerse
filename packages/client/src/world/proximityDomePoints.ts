export type ProximityDomePlayer = {
  x: number;
  z: number;
  presence?: "online" | "away";
  hasDetailedPosition?: boolean;
};

/** Reuse the output map and exclude coarse markers from decorative group geometry. */
export function writeProximityDomePoints<T extends ProximityDomePlayer>(
  output: Map<string, T>,
  players: ReadonlyMap<string, T>,
  isInExcludedZone: (player: T) => boolean,
): Map<string, T> {
  output.clear();
  for (const [id, player] of players) {
    if (player.presence === "away" || player.hasDetailedPosition === false || isInExcludedZone(player)) continue;
    output.set(id, player);
  }
  return output;
}
