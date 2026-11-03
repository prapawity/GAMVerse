import { readRoomLayoutProps } from "./roomLayoutProps.js";
import { ROOM_PROP_CATALOG, roomPropSeatAnchors, type RoomLayoutProp, type RoomLayoutZone } from "./roomLayout.js";

/** Counts authored sit-interaction anchors that physically fall within each meeting zone. */
export function countMeetingRoomSeats(zones: readonly RoomLayoutZone[], props: readonly RoomLayoutProp[]) {
  const seatsByZone = new Map<string, number>();
  for (const zone of zones) if (zone.kind === "meeting") seatsByZone.set(zone.id, 0);
  for (const prop of props) {
    const definition = ROOM_PROP_CATALOG.find(item => item.asset === prop.asset);
    if (definition?.interaction !== "sit") continue;
    for (const seat of roomPropSeatAnchors(prop, definition)) {
      const zone = zones.find(candidate => candidate.kind === "meeting"
        && Math.abs(seat.x - candidate.x) <= candidate.width / 2
        && Math.abs(seat.z - candidate.z) <= candidate.depth / 2);
      if (zone) seatsByZone.set(zone.id, (seatsByZone.get(zone.id) ?? 0) + 1);
    }
  }
  return Object.fromEntries(seatsByZone);
}

export function countMeetingRoomSeatsFromConfig(zones: readonly RoomLayoutZone[], props: unknown) {
  return countMeetingRoomSeats(zones, readRoomLayoutProps(props, ROOM_PROP_CATALOG));
}
