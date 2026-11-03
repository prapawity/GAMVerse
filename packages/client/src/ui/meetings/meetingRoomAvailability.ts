export type MeetingReservationSlot = { zoneId: string; startsAt: string; endsAt: string };

/** Uses half-open time ranges, so a meeting may start when the previous booking ends. */
export function isMeetingRoomAvailable(zoneId: string, startsAt: string, endsAt: string, reservations: readonly MeetingReservationSlot[]) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!zoneId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  return !reservations.some(reservation => reservation.zoneId === zoneId
    && Date.parse(reservation.startsAt) < end
    && Date.parse(reservation.endsAt) > start);
}
