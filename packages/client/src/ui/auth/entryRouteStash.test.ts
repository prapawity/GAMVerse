import assert from "node:assert/strict";
import test from "node:test";
import { clearEntryRoute, peekEntryRoute, stashEntryRoute, takeEntryRoute } from "./entryRouteStash";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const INVITE = `/join/${"A".repeat(43)}`;

test("invite route survives a round trip and is restored once", () => {
  const s = memory();
  assert.equal(stashEntryRoute(INVITE, s, 1000), true);
  assert.equal(peekEntryRoute(s, 2000), INVITE);
  assert.equal(takeEntryRoute(s, 2000), INVITE);
  assert.equal(takeEntryRoute(s, 2000), null);
});

test("other routes are never stashed and stale or tampered values are ignored", () => {
  const s = memory();
  assert.equal(stashEntryRoute("/maintainer", s), false);
  assert.equal(stashEntryRoute("/join/short", s), false);
  stashEntryRoute(INVITE, s, 0);
  assert.equal(peekEntryRoute(s, 16 * 60_000), null);
  s.setItem("gamverse.googleEntryRoute", JSON.stringify({ path: "https://evil.example/", at: 0 }));
  assert.equal(peekEntryRoute(s, 1), null);
  s.setItem("gamverse.googleEntryRoute", "not json");
  assert.equal(peekEntryRoute(s, 1), null);
  clearEntryRoute(s);
});

test("missing or throwing storage never throws", () => {
  assert.equal(stashEntryRoute(INVITE, null), false);
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
  assert.equal(stashEntryRoute(INVITE, bad), false);
  assert.equal(takeEntryRoute(bad), null);
});
