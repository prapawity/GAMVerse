export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type GoogleStatus = { enabled: boolean; linked: boolean; email: string | null; hasPassword: boolean };

/** Fails closed: anything that is not the documented shape is treated as unavailable. */
export function parseGoogleStatus(value: unknown): GoogleStatus | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== "boolean" || typeof v.linked !== "boolean" || typeof v.hasPassword !== "boolean") return null;
  return { enabled: v.enabled, linked: v.linked, email: typeof v.email === "string" && v.email ? v.email : null, hasPassword: v.hasPassword };
}

export type SignInMethodsView = {
  visible: boolean;
  canConnect: boolean;
  canDisconnect: boolean;
  disconnectHint: string | null;
  showSetPassword: boolean;
  email: string | null;
};

export const SET_PASSWORD_FIRST_HINT = "Set a password first";

export function signInMethodsView(status: GoogleStatus | null): SignInMethodsView {
  if (!status || (!status.enabled && !status.linked)) return { visible: false, canConnect: false, canDisconnect: false, disconnectHint: null, showSetPassword: false, email: null };
  return {
    visible: true,
    canConnect: status.enabled && !status.linked,
    canDisconnect: status.linked && status.hasPassword,
    disconnectHint: status.linked && !status.hasPassword ? SET_PASSWORD_FIRST_HINT : null,
    showSetPassword: !status.hasPassword,
    email: status.linked ? status.email : null,
  };
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`;
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

/** Server `error` text when present, otherwise a fallback; never leaks non-string bodies. */
export function errorFromBody(body: unknown, fallback: string): string {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  return typeof error === "string" && error ? error : fallback;
}

export function parseLinkUrl(body: unknown): string | null {
  const url = typeof body === "object" && body !== null ? (body as { url?: unknown }).url : undefined;
  return typeof url === "string" && /^https:\/\//.test(url) ? url : null;
}

export type SetPasswordOutcome = { kind: "ok" } | { kind: "reauth"; message: string } | { kind: "error"; message: string };
const REAUTH_FALLBACK = "Password set. Sign in again.";

/** `reauth` is checked before `user`: the password is saved but no new session was issued. */
export function mapSetPasswordResponse(httpStatus: number, body: unknown): SetPasswordOutcome {
  const b = typeof body === "object" && body !== null ? (body as { reauth?: unknown; message?: unknown }) : {};
  if (httpStatus >= 200 && httpStatus < 300) {
    if (b.reauth === true) return { kind: "reauth", message: typeof b.message === "string" && b.message ? b.message : REAUTH_FALLBACK };
    return { kind: "ok" };
  }
  return { kind: "error", message: errorFromBody(body, "Could not set the password.") };
}
