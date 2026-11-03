export type CalendarMeetingReservation = {
  id: string;
  title: string;
  zoneName: string;
  startsAt: string;
  endsAt: string;
};

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatUtcDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Meeting time is invalid.");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const segments: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 73) { segments.push(current); current = ` ${character}`; bytes = 1 + size; }
    else { current += character; bytes += size; }
  }
  segments.push(current);
  return segments.join("\r\n");
}

export function buildMeetingCalendarEvent(reservation: CalendarMeetingReservation, officeName: string, now = new Date(), meetingUrl?: string) {
  const uid = `reservation-${reservation.id}@gammyverse`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GAMVerse//Meeting reservations//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${formatUtcDate(now.toISOString())}`,
    `DTSTART:${formatUtcDate(reservation.startsAt)}`, `DTEND:${formatUtcDate(reservation.endsAt)}`,
    `SUMMARY:${escapeIcsText(reservation.title)}`,
    `LOCATION:${escapeIcsText(`${reservation.zoneName}, ${officeName}`)}`,
    `DESCRIPTION:${escapeIcsText(`Join ${officeName} in GAMVerse. Meeting room: ${reservation.zoneName}.${meetingUrl ? ` Open: ${meetingUrl}` : ""}`)}`,
    ...(meetingUrl && /^https?:\/\/[^\r\n]+$/.test(meetingUrl) ? [`URL:${meetingUrl}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function meetingCalendarFilename(title: string) {
  const slug = title.normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 48) || "meeting";
  return `${slug}.ics`;
}
