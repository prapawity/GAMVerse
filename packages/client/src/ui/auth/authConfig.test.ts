import assert from "node:assert/strict";
import test from "node:test";
import { fetchAuthConfig, googleStartUrl, parseAuthConfig } from "./authConfig";

test("only google:true enables Google", () => {
  assert.equal(parseAuthConfig({ google: true }).google, true);
  for (const bad of [{ google: "true" }, { google: 1 }, {}, null, "x", undefined]) assert.equal(parseAuthConfig(bad).google, false);
});

test("start URL targets the API origin with login intent", () => {
  assert.equal(googleStartUrl("https://localhost:2567/"), "https://localhost:2567/auth/google/start?intent=login");
});

test("fetch failures and non-OK responses disable Google", async () => {
  assert.equal((await fetchAuthConfig("http://x", (async () => { throw new Error("down"); }) as typeof fetch)).google, false);
  assert.equal((await fetchAuthConfig("http://x", (async () => new Response("{}", { status: 500 })) as typeof fetch)).google, false);
  assert.equal((await fetchAuthConfig("http://x", (async () => Response.json({ google: true })) as typeof fetch)).google, true);
});
