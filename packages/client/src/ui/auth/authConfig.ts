export type AuthConfig = { google: boolean };
export const AUTH_CONFIG_DISABLED: AuthConfig = { google: false };

/** Only an explicit `google: true` enables the button; anything else fails closed. */
export function parseAuthConfig(value: unknown): AuthConfig {
  return typeof value === "object" && value !== null && (value as { google?: unknown }).google === true ? { google: true } : AUTH_CONFIG_DISABLED;
}

export function googleStartUrl(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, "")}/auth/google/start?intent=login`;
}

export async function fetchAuthConfig(endpoint: string, fetcher: typeof fetch = fetch): Promise<AuthConfig> {
  try {
    const response = await fetcher(`${endpoint}/auth/config`, { credentials: "include" });
    return response.ok ? parseAuthConfig(await response.json()) : AUTH_CONFIG_DISABLED;
  } catch {
    return AUTH_CONFIG_DISABLED;
  }
}
