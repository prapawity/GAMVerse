import { requestSession, type HttpRequest, type HttpResponse } from "./middleware.js";
import { cancelMeetingReservation, createMeetingReservation, listMeetingReservations, MeetingReservationCapacityExceeded, MeetingReservationConflict } from "../offices/meetingReservations.js";

type Handler = (request: HttpRequest, response: HttpResponse) => Promise<void>;
type App = { get(path: string, handler: Handler): unknown; post(path: string, handler: Handler): unknown; delete(path: string, handler: Handler): unknown };
type Service = Pick<typeof import("../offices/meetingReservations.js"), "listMeetingReservations" | "createMeetingReservation" | "cancelMeetingReservation">;
type Dependencies = { session: typeof requestSession; service: Service };

function statusFor(error: unknown, action: "list" | "create" | "cancel") {
  if (error instanceof MeetingReservationConflict || error instanceof MeetingReservationCapacityExceeded) return 409;
  const message = error instanceof Error ? error.message : "";
  if (message.includes("PostgreSQL")) return 503;
  if (message.includes("access denied")) return 403;
  if (message.includes("not found") || message.includes("no longer available")) return action === "cancel" ? 404 : 409;
  return 400;
}

function handler(action: "list" | "create" | "cancel", dependencies: Dependencies): Handler {
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const session = await dependencies.session(request);
    if (!session) { response.status(401).json({ error: "Authentication required." }); return; }
    const officeId = request.params.officeId!;
    try {
      const result = action === "list"
        ? await dependencies.service.listMeetingReservations(session.username, officeId, session.role === "maintainer")
        : action === "create"
          ? await dependencies.service.createMeetingReservation(session.username, session.role === "maintainer", officeId, request.body)
          : await dependencies.service.cancelMeetingReservation(session.username, session.role === "maintainer", officeId, request.params.reservationId!);
      response.status(action === "create" ? 201 : 200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete the meeting reservation request.";
      response.status(statusFor(error, action)).json({ error: message });
    }
  };
}

export function registerMeetingReservationEndpoints(app: App, overrides: Partial<Dependencies> = {}) {
  const dependencies = { session: requestSession, service: { listMeetingReservations, createMeetingReservation, cancelMeetingReservation }, ...overrides };
  app.get("/offices/:officeId/meeting-reservations", handler("list", dependencies));
  app.post("/offices/:officeId/meeting-reservations", handler("create", dependencies));
  app.delete("/offices/:officeId/meeting-reservations/:reservationId", handler("cancel", dependencies));
}
