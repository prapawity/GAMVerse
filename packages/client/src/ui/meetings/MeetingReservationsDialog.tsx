import { useEffect, useState, type FormEvent } from "react";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";
import type { RoomLayoutZone } from "@gammyverse/shared";
import { isMeetingRoomAvailable } from "./meetingRoomAvailability";
import { buildMeetingCalendarEvent, meetingCalendarFilename } from "./meetingCalendarEvent";
import { createMeetingRoomUrl } from "./meetingRoute";

type Reservation = { id: string; zoneId: string; zoneName: string; title: string; attendeeCount: number; createdBy: string; startsAt: string; endsAt: string };

function toLocalDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function initialSlot() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(Math.ceil((start.getMinutes() + 1) / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return { start: toLocalDateTime(start), end: toLocalDateTime(end) };
}

function formatSlot(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function downloadCalendarEvent(reservation: Reservation, officeId: string, officeName: string) {
  const meetingUrl = createMeetingRoomUrl(window.location.origin, officeId, reservation.zoneId);
  const calendar = buildMeetingCalendarEvent(reservation, officeName, new Date(), meetingUrl);
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = meetingCalendarFilename(reservation.title);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function MeetingReservationsDialog({ endpoint, officeId, officeName, username, role, zones, capacities, onClose, onGoToRoom }: {
  endpoint: string;
  officeId: string;
  officeName: string;
  username: string;
  role: string;
  zones: readonly RoomLayoutZone[];
  capacities: Readonly<Record<string, number>>;
  onClose(): void;
  onGoToRoom(zoneId: string): void;
}) {
  const slot = initialSlot();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(slot.start);
  const [endsAt, setEndsAt] = useState(slot.end);
  const canCancelAny = ["owner", "admin", "maintainer"].includes(role);
  const isRoomAvailable = (candidateZoneId: string) => isMeetingRoomAvailable(candidateZoneId, startsAt, endsAt, reservations);
  const selectedRoomAvailable = zoneId ? isRoomAvailable(zoneId) : false;
  const selectedRoomCapacity = capacities[zoneId] ?? 0;
  const loadReservations = async (active = () => true) => {
    setLoading(true);
    try {
      const response = await fetch(`${endpoint}/offices/${officeId}/meeting-reservations`, { credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => ({})) as { reservations?: Reservation[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load room reservations.");
      if (active()) { setReservations(result.reservations ?? []); setError(null); }
    } catch (cause) { if (active()) setError(cause instanceof Error ? cause.message : "Could not load room reservations."); }
    finally { if (active()) setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    void loadReservations(() => active);
    return () => { active = false; };
  }, [endpoint, officeId]);
  useEffect(() => { if (!zones.some(zone => zone.id === zoneId)) setZoneId(zones[0]?.id ?? ""); }, [zones, zoneId]);

  const createReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${endpoint}/offices/${officeId}/meeting-reservations`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId, title, attendeeCount, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not reserve this meeting room.");
      setTitle(""); setAttendeeCount(1);
      await loadReservations();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reserve this meeting room."); }
    finally { setBusy(false); }
  };

  const cancelReservation = async (reservation: Reservation) => {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${endpoint}/offices/${officeId}/meeting-reservations/${reservation.id}`, { method: "DELETE", credentials: "include" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not cancel this reservation.");
      setReservations(current => current.filter(item => item.id !== reservation.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel this reservation."); }
    finally { setBusy(false); }
  };

  return <WorkspaceDialog labelledBy="meeting-reservations-title" onClose={onClose} className="meeting-reservations-dialog">
    <header className="meeting-reservations-header"><div><span className="eyebrow">ROOM SCHEDULE · {officeName}</span><h2 id="meeting-reservations-title">Reserve a meeting room</h2><p>Times are shown in your local timezone. Reservations are visible to office members.</p></div><button type="button" aria-label="Close room reservations" onClick={onClose}>×</button></header>
    {error && <p className="meeting-reservations-error" role="alert">{error}</p>}
    <form className="meeting-reservations-form" onSubmit={event => void createReservation(event)}>
      <label>Meeting title<input value={title} onChange={event => setTitle(event.target.value)} minLength={2} maxLength={96} required placeholder="Weekly sync" /></label>
      <label>Room<select value={zoneId} onChange={event => setZoneId(event.target.value)} disabled={!zones.length}><option value="">Choose a room</option>{zones.map(zone => <option key={zone.id} value={zone.id} disabled={loading || !isRoomAvailable(zone.id)}>{zone.name} · {capacities[zone.id] ? `${capacities[zone.id]} seats` : "No seats configured"} · {loading ? "Checking…" : isRoomAvailable(zone.id) ? "Available" : "Already booked"}</option>)}</select></label>
      <label>Expected attendees<input type="number" min={1} max={selectedRoomCapacity || 500} step={1} value={attendeeCount} onChange={event => setAttendeeCount(Number(event.target.value))} required /></label>
      <div className="meeting-reservation-time-fields"><label>Starts<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} required /></label><label>Ends<input type="datetime-local" value={endsAt} min={startsAt} onChange={event => setEndsAt(event.target.value)} required /></label></div>
      <button className="meeting-reservations-submit" type="submit" disabled={loading || busy || !zones.length || !title.trim() || !startsAt || !endsAt || !selectedRoomAvailable || !Number.isInteger(attendeeCount) || attendeeCount < 1 || selectedRoomCapacity > 0 && attendeeCount > selectedRoomCapacity}>{busy ? "Saving…" : "Reserve room"}</button>
      {zoneId && startsAt && endsAt && !selectedRoomAvailable && <p className="meeting-reservations-unavailable" role="status">This room is already reserved during the selected time. Choose another room or time.</p>}
      {selectedRoomCapacity > 0 && attendeeCount > selectedRoomCapacity && <p className="meeting-reservations-unavailable" role="status">This room has {selectedRoomCapacity} configured seats.</p>}
      {!zones.length && <p>No meeting rooms are configured in this office yet.</p>}
    </form>
    <section className="meeting-reservations-list" aria-labelledby="meeting-upcoming-title"><div className="meeting-reservations-list-heading"><h3 id="meeting-upcoming-title">Upcoming</h3><button type="button" onClick={() => void loadReservations()} disabled={loading || busy}>{loading ? "Loading…" : "Refresh"}</button></div>
      {loading && <p>Loading reservations…</p>}{!loading && reservations.length === 0 && <p>No upcoming reservations.</p>}
      <ul>{reservations.map(reservation => <li key={reservation.id}><div className="meeting-reservation-copy"><strong>{reservation.title}</strong><span>{reservation.zoneName} · {formatSlot(reservation.startsAt)}–{formatSlot(reservation.endsAt)}</span><small>{reservation.attendeeCount} expected · Booked by {reservation.createdBy}</small></div><div className="meeting-reservation-actions"><button type="button" onClick={() => downloadCalendarEvent(reservation, officeId, officeName)}>Add to calendar</button><button type="button" onClick={() => { onClose(); onGoToRoom(reservation.zoneId); }}>Go to room</button>{(reservation.createdBy === username || canCancelAny) && <button type="button" disabled={busy} onClick={() => void cancelReservation(reservation)}>Cancel</button>}</div></li>)}</ul>
    </section>
  </WorkspaceDialog>;
}
