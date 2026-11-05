import { getMeetingRouteOfficeId } from "../meetings/meetingRoute";
import { getInviteRouteToken, getOfficeShareRouteToken } from "./officeEntryLink";

const OFFICE_ROUTE = /^\/office\/[0-9a-f-]{36}\/?$/i;
const RESET_ROUTE = /^\/reset\/[A-Za-z0-9_-]{30,100}\/?$/;
const MAINTAINER_ROUTE = /^\/maintainer(?:\/diagnostics)?\/?$/i;

/** Keep valid direct-entry links and send unknown app paths back to the landing page. */
export function isKnownAppRoute(path: string): boolean {
  const normalized = path.replace(/\/+$/, "") || "/";
  return normalized === "/" || OFFICE_ROUTE.test(normalized) ||
    getMeetingRouteOfficeId(normalized) !== null ||
    getInviteRouteToken(normalized) !== null ||
    getOfficeShareRouteToken(normalized) !== null ||
    RESET_ROUTE.test(normalized) || MAINTAINER_ROUTE.test(normalized);
}
