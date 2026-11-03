import { countMeetingRoomSeatsFromConfig, isCreateMeetingReservation, readRoomLayout, type CreateMeetingReservation } from "@gammyverse/shared";
import type { PoolClient } from "pg";
import { database } from "../infra/db.js";
import { getOfficeRole } from "./repository.js";

const RESERVATION_CONFLICT_LABEL = "That meeting room is already reserved for this time.";
const OFFICE_ACCESS_LABEL = "Office not found or access denied.";
const ROOM_CAPACITY_LABEL = "The requested attendee count exceeds this room's configured seating capacity.";

export class MeetingReservationConflict extends Error {
  constructor() { super(RESERVATION_CONFLICT_LABEL); this.name = "MeetingReservationConflict"; }
}
export class MeetingReservationCapacityExceeded extends Error {
  constructor() { super(ROOM_CAPACITY_LABEL); this.name = "MeetingReservationCapacityExceeded"; }
}

export type MeetingReservation = {
  id: string;
  officeId: string;
  zoneId: string;
  zoneName: string;
  title: string;
  attendeeCount: number;
  createdBy: string;
  startsAt: string;
  endsAt: string;
};

type ReservationRow = {
  id: string | number | bigint;
  office_id: string;
  zone_id: string;
  zone_name: string;
  title: string;
  attendee_count: number;
  created_by: string;
  starts_at: Date;
  ends_at: Date;
};

function mapReservation(row: ReservationRow): MeetingReservation {
  return {
    id: String(row.id), officeId: row.office_id, zoneId: row.zone_id, zoneName: row.zone_name,
    title: row.title, attendeeCount: Number(row.attendee_count), createdBy: row.created_by, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(),
  };
}

async function officeRoleWithinTransaction(client: PoolClient, username: string, officeId: string, isMaintainer: boolean) {
  const office = await client.query<{ owner_username: string }>("SELECT owner_username FROM app_offices WHERE id = $1 AND archived_at IS NULL FOR UPDATE", [officeId]);
  const owner = office.rows[0]?.owner_username;
  if (!owner) return null;
  if (isMaintainer) return "maintainer";
  if (owner === username) return "owner";
  const member = await client.query<{ role: "admin" | "user" }>("SELECT role FROM app_office_memberships WHERE office_id = $1 AND username = $2 FOR KEY SHARE", [officeId, username]);
  return member.rows[0]?.role ?? null;
}

export async function listMeetingReservations(username: string, officeId: string, isMaintainer = false) {
  if (!database) throw new Error("Meeting reservations require PostgreSQL.");
  if (!await getOfficeRole(username, officeId, isMaintainer)) throw new Error(OFFICE_ACCESS_LABEL);
  const result = await database.query<ReservationRow>(
    `SELECT id, office_id, zone_id, zone_name, title, attendee_count, created_by, starts_at, ends_at
    FROM app_office_meeting_reservations
    WHERE office_id = $1 AND cancelled_at IS NULL
      AND ends_at >= now() - interval '4 hours'
      AND starts_at <= now() + interval '90 days'
    ORDER BY starts_at ASC, id ASC`, [officeId],
  );
  return { reservations: result.rows.map(mapReservation) };
}

export async function createMeetingReservation(username: string, isMaintainer: boolean, officeId: string, value: unknown, nowMs = Date.now()) {
  if (!database) throw new Error("Meeting reservations require PostgreSQL.");
  if (!isCreateMeetingReservation(value, nowMs)) throw new Error("Meeting reservation details are invalid.");
  const input: CreateMeetingReservation = value;
  const startsAt = new Date(input.startsAt).toISOString();
  const endsAt = new Date(input.endsAt).toISOString();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const role = await officeRoleWithinTransaction(client, username, officeId, isMaintainer);
    if (!role) throw new Error(OFFICE_ACCESS_LABEL);
    const map = await client.query<{ config: unknown }>("SELECT config FROM app_office_map_layouts WHERE office_id = $1 FOR SHARE", [officeId]);
    const zone = readRoomLayout(map.rows[0]?.config).zones.find(candidate => candidate.id === input.zoneId && candidate.kind === "meeting");
    if (!zone) throw new Error("That meeting room is no longer available.");
    const officeProps = await client.query<{ props: unknown }>("SELECT props FROM app_office_props WHERE office_id = $1 FOR SHARE", [officeId]);
    const capacity = countMeetingRoomSeatsFromConfig([zone], officeProps.rows[0]?.props)[zone.id] ?? 0;
    const attendeeCount = input.attendeeCount ?? 1;
    if (capacity > 0 && attendeeCount > capacity) throw new MeetingReservationCapacityExceeded();
    const conflict = await client.query<{ id: string }>(
      `SELECT id FROM app_office_meeting_reservations
      WHERE office_id = $1 AND zone_id = $2 AND cancelled_at IS NULL
        AND starts_at < $4::timestamptz AND ends_at > $3::timestamptz
      LIMIT 1`, [officeId, zone.id, startsAt, endsAt],
    );
    if (conflict.rowCount) throw new MeetingReservationConflict();
    const inserted = await client.query<ReservationRow>(
      `INSERT INTO app_office_meeting_reservations(office_id, zone_id, zone_name, title, attendee_count, created_by, starts_at, ends_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, office_id, zone_id, zone_name, title, attendee_count, created_by, starts_at, ends_at`,
      [officeId, zone.id, zone.name, input.title.trim(), attendeeCount, username, startsAt, endsAt],
    );
    await client.query("COMMIT");
    return { reservation: mapReservation(inserted.rows[0]!) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function cancelMeetingReservation(username: string, isMaintainer: boolean, officeId: string, reservationId: string) {
  if (!database) throw new Error("Meeting reservations require PostgreSQL.");
  if (!/^[1-9]\d{0,18}$/.test(reservationId)) throw new Error("Meeting reservation ID is invalid.");
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const role = await officeRoleWithinTransaction(client, username, officeId, isMaintainer);
    if (!role) throw new Error(OFFICE_ACCESS_LABEL);
    const result = await client.query(
      `UPDATE app_office_meeting_reservations SET cancelled_at = now()
      WHERE id = $1 AND office_id = $2 AND cancelled_at IS NULL
        AND (created_by = $3 OR $4::boolean)`,
      [reservationId, officeId, username, ["owner", "admin", "maintainer"].includes(role)],
    );
    if (!result.rowCount) throw new Error("Meeting reservation not found or you cannot cancel it.");
    await client.query("COMMIT");
    return { cancelled: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
