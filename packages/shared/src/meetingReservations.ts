export const MEETING_RESERVATION_MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
export const MEETING_RESERVATION_MIN_DURATION_MS = 5 * 60 * 1000;
export const MEETING_RESERVATION_MAX_DURATION_MS = 4 * 60 * 60 * 1000;
export const MEETING_RESERVATION_MAX_TITLE_CHARS = 96;
export const MEETING_RESERVATION_MAX_ATTENDEES = 500;

export type CreateMeetingReservation = {
  zoneId: string;
  title: string;
  attendeeCount?: number;
  startsAt: string;
  endsAt: string;
};

const ISO_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isCreateMeetingReservation(value: unknown, nowMs = Date.now()): value is CreateMeetingReservation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.zoneId !== "string" || input.zoneId.length < 1 || input.zoneId.length > 128 || /[\u0000-\u001f]/.test(input.zoneId)) return false;
  if (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.trim().length > MEETING_RESERVATION_MAX_TITLE_CHARS) return false;
  if (input.attendeeCount !== undefined && (!Number.isInteger(input.attendeeCount) || Number(input.attendeeCount) < 1 || Number(input.attendeeCount) > MEETING_RESERVATION_MAX_ATTENDEES)) return false;
  if (typeof input.startsAt !== "string" || !ISO_WITH_TIMEZONE.test(input.startsAt)) return false;
  if (typeof input.endsAt !== "string" || !ISO_WITH_TIMEZONE.test(input.endsAt)) return false;
  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  const duration = endsAt - startsAt;
  return Number.isFinite(startsAt) && Number.isFinite(endsAt)
    && startsAt >= nowMs - 60_000
    && startsAt <= nowMs + MEETING_RESERVATION_MAX_AHEAD_MS
    && duration >= MEETING_RESERVATION_MIN_DURATION_MS
    && duration <= MEETING_RESERVATION_MAX_DURATION_MS;
}
