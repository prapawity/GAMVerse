const MEETING_ROUTE = /^\/meeting\/([0-9a-f-]{36})\/?$/i;

export function getMeetingRouteOfficeId(path: string) {
  return path.match(MEETING_ROUTE)?.[1]?.toLowerCase() ?? null;
}

export function shouldPreserveMeetingRoute(path: string, officeId: string) {
  return getMeetingRouteOfficeId(path) === officeId.toLowerCase();
}

export function getMeetingRouteZoneId(search: string) {
  const value = new URLSearchParams(search).get("room");
  return value && value.length <= 128 && !/[\u0000-\u001f]/.test(value) ? value : null;
}

export function createMeetingRoomUrl(origin: string, officeId: string, zoneId: string) {
  const url = new URL(`/meeting/${encodeURIComponent(officeId)}`, origin);
  url.searchParams.set("room", zoneId);
  return url.toString();
}
