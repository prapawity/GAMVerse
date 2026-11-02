#!/usr/bin/env node
// Load test for the props editor: many members saving props at once.
//
//   BASE_URL=https://localhost:2567 OFFICE_ID=<id> CONFIRM_OFFICE_ID=<id> \
//   COOKIE='gv_session=...' node scripts/props-load-test/props-editors.mjs --editors 100 --duration 60
//
// Use a TEST office. The run adds, moves and removes only props whose id starts with
// "lt-<runId>-" and deletes them at the end, but it does bump the office's config
// version and broadcasts every change to players who are connected.
//
// COOKIE may hold one session (all editors share its rate limit) or several,
// separated by "|", to spread editors across accounts.
import { runPropsEditorsLoad } from "./propsEditorsCore.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const baseUrl = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const officeId = process.env.OFFICE_ID ?? "";
if (!baseUrl || !officeId) { console.error("Set BASE_URL and OFFICE_ID."); process.exit(2); }
if (process.env.CONFIRM_OFFICE_ID !== officeId) {
  console.error("Refusing to run: set CONFIRM_OFFICE_ID to the same office id to confirm this is a test office.");
  process.exit(2);
}
const cookies = (process.env.COOKIE ?? "").split("|").map((value) => value.trim()).filter(Boolean);
if (!cookies.length) { console.error("Set COOKIE to a signed-in session cookie header."); process.exit(2); }
if (process.env.ALLOW_SELF_SIGNED === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const request = async (editor, method, path, body) => {
  const response = await fetch(`${baseUrl}/offices/${officeId}${path}`, {
    method,
    headers: { Cookie: cookies[editor % cookies.length], ...(body ? { "Content-Type": "application/json", Origin: process.env.ORIGIN ?? baseUrl } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

const report = await runPropsEditorsLoad({
  request,
  editors: Number(arg("editors", 100)),
  durationMs: Number(arg("duration", 60)) * 1000,
  meanSaveIntervalMs: Number(arg("interval", 4)) * 1000,
  hotProps: Number(arg("hot", 20)),
  seed: Number(arg("seed", 1)),
  log: (line) => console.log(line),
});
console.log(JSON.stringify(report, null, 2));
process.exit(report.verify.ok ? 0 : 1);
