import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CHARACTER_ID } from "@gammyverse/shared";
import { MeetingReservationCapacityExceeded, MeetingReservationConflict } from "../offices/meetingReservations.js";
import type { HttpRequest, HttpResponse } from "./middleware.js";
import { registerMeetingReservationEndpoints } from "./meetingReservationEndpoints.js";

type Handler = (request: HttpRequest, response: HttpResponse) => Promise<void>;
function setup(authenticated: boolean, create: () => Promise<unknown>) {
  const routes = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => routes.set(`POST ${path}`, handler),
    delete: (path: string, handler: Handler) => routes.set(`DELETE ${path}`, handler),
  };
  const session = async () => authenticated ? { username: "alice", nickname: null, role: "user" as const, characterId: DEFAULT_CHARACTER_ID } : null;
  const service = {
    listMeetingReservations: async () => ({ reservations: [] }),
    createMeetingReservation: create,
    cancelMeetingReservation: async () => ({ cancelled: true }),
  };
  registerMeetingReservationEndpoints(app, { session, service } as Parameters<typeof registerMeetingReservationEndpoints>[1]);
  return routes;
}

function invoke(handler: Handler) {
  let status = 200;
  let body: unknown;
  const request = { headers: {}, method: "POST", path: "/", body: {}, params: { officeId: "office", reservationId: "1" }, header: () => undefined, on: () => {}, destroy: () => {} } as HttpRequest;
  const response = {
    clearCookie: () => response, cookie: () => response, setHeader: () => {}, status: (value: number) => { status = value; return response; },
    json: (value: unknown) => { body = value; }, send: () => {}, sendStatus: (value: number) => { status = value; },
  } as HttpResponse;
  return handler(request, response).then(() => ({ status, body }));
}

test("meeting reservation endpoints require an authenticated office member", async () => {
  const routes = setup(false, async () => ({}));
  const handler = routes.get("POST /offices/:officeId/meeting-reservations");
  assert.ok(handler);
  const result = await invoke(handler);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test("overlapping room reservations return a conflict response", async () => {
  const routes = setup(true, async () => { throw new MeetingReservationConflict(); });
  const handler = routes.get("POST /offices/:officeId/meeting-reservations");
  assert.ok(handler);
  const result = await invoke(handler);
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: "That meeting room is already reserved for this time." });
});

test("over-capacity room reservations return a conflict response", async () => {
  const routes = setup(true, async () => { throw new MeetingReservationCapacityExceeded(); });
  const handler = routes.get("POST /offices/:officeId/meeting-reservations");
  assert.ok(handler);
  const result = await invoke(handler);
  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: "The requested attendee count exceeds this room's configured seating capacity." });
});
