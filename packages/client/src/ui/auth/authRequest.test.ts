import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthRequest } from "./authRequest";

test("register sends only username and password", () => {
  const request = buildAuthRequest({ mode: "register", maintainerPortal: false, username: "bob", password: "pw123456" });
  assert.equal(request.path, "register");
  assert.deepEqual(Object.keys(request.body).sort(), ["password", "username"]);
});

test("maintainer portal always uses maintainer/login", () => {
  assert.equal(buildAuthRequest({ mode: "register", maintainerPortal: true, username: "a", password: "b" }).path, "maintainer/login");
  assert.equal(buildAuthRequest({ mode: "login", maintainerPortal: false, username: "a", password: "b" }).path, "login");
});
