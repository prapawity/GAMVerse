/** Matches the server's PENDING_TOKEN_FORMAT. */
const PENDING_TOKEN_FORMAT = /^[A-Za-z0-9_-]{30,100}$/;

/** Parses `#token=…` from a location hash. Returns null when absent or malformed. */
export function parsePendingTokenHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("token");
  return token !== null && PENDING_TOKEN_FORMAT.test(token) ? token : null;
}

let captured: { token: string | null } | null = null;

/**
 * Reads the token once and strips the fragment from the address bar immediately.
 * The result is memoised so a React StrictMode double render still sees the token.
 */
export function capturePendingToken(location: Pick<Location, "hash" | "pathname" | "search">, history: Pick<History, "replaceState" | "state">): string | null {
  if (captured) return captured.token;
  captured = { token: parsePendingTokenHash(location.hash) };
  if (location.hash) history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  return captured.token;
}

export function resetCapturedPendingToken() { captured = null; }
