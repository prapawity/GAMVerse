/** Beyond this distance a name in first person is too small a target to be useful and only adds clutter. */
export const FPP_NAME_TAG_MAX_DISTANCE_M = 30;

export type NameTagContext = {
  /** The tag belongs to the player whose camera this is. */
  isLocal: boolean;
  map2d: boolean;
  firstPerson: boolean;
  /** The person stands in a room whose roof is closed from here. */
  covered: boolean;
  distanceToCameraM: number;
};

/**
 * Names stay visible in first person so you can tell who you are looking at; only your own tag is hidden there,
 * because your body is not drawn, and far-away tags fade out of the view.
 */
export function shouldShowNameTag({ isLocal, map2d, firstPerson, covered, distanceToCameraM }: NameTagContext): boolean {
  if (map2d || covered) return false;
  if (!firstPerson) return true;
  return !isLocal && distanceToCameraM <= FPP_NAME_TAG_MAX_DISTANCE_M;
}
