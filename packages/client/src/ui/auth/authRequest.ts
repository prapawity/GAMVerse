import type { AuthMode } from "./authMode";

/** Path and JSON body for the password sign-in or register call. Register sends no email; the server ignores it. */
export function buildAuthRequest(input: { mode: AuthMode; maintainerPortal: boolean; username: string; password: string }) {
  return {
    path: input.maintainerPortal ? "maintainer/login" : input.mode,
    body: { username: input.username, password: input.password },
  };
}
