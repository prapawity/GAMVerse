import { parseRoomPropSeatReference, roomPropDefinition, roomPropSeatAnchors, type RoomLayoutProp } from "@gammyverse/shared";
import type { Map2dPlayer } from "./map2dAvatarVisual";

/** Render resting players at the furniture anchor while preserving authoritative positions. */
export function map2dRestingPlayers(players: ReadonlyMap<string, Map2dPlayer>, props: readonly RoomLayoutProp[]): ReadonlyMap<string, Map2dPlayer> {
  let rendered: Map<string, Map2dPlayer> | undefined;
  for (const [id, player] of players) {
    const reference = player.sittingPropId ? parseRoomPropSeatReference(player.sittingPropId) : undefined;
    if (!reference) continue;
    const prop = props.find(prop => prop.id === reference.propId);
    if (!prop) continue;
    const definition = roomPropDefinition(prop.asset);
    const anchor = roomPropSeatAnchors(prop, definition).find(anchor => anchor.index === reference.seatIndex);
    if (!anchor) continue;
    rendered ??= new Map(players);
    rendered.set(id, { ...player, x: anchor.x, z: anchor.z, rotation: anchor.rotation,
      renderElevationM: (prop.elevation ?? 0) + anchor.y });
  }
  return rendered ?? players;
}
