import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SERVER_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_SRC = join(SERVER_SRC, "..", "..", "client", "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("every realtime message the client sends has a server handler", () => {
  const sent = new Set<string>();
  for (const file of sourceFiles(CLIENT_SRC)) for (const match of readFileSync(file, "utf8").matchAll(/\.send\("([a-z][a-z-]*)"/g)) sent.add(match[1]!);
  const serverSource = sourceFiles(SERVER_SRC).filter(file => readFileSync(file, "utf8").includes("onMessage")).map(file => readFileSync(file, "utf8")).join("\n");
  assert.ok(sent.size > 10, "the scan found the client's messages");
  // Colyseus drops (production) or errors (dev) a client that sends an unregistered message type,
  // so one missing handler disconnects whoever presses the control.
  const missing = [...sent].filter(type => !serverSource.includes(`"${type}"`));
  assert.deepEqual(missing, [], "client sends messages the server never registers");
});
