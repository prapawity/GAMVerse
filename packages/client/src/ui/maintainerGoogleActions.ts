export type MaintainerGoogleAction = "google" | "email";

export function maintainerGoogleActionPath(username: string, action: MaintainerGoogleAction): string {
  return `/api/maintainer/users/${encodeURIComponent(username)}/${action}`;
}

export function maintainerGoogleConfirmText(username: string, action: MaintainerGoogleAction): string {
  return action === "google"
    ? `Disconnect Google from ${username}? Their sessions will be signed out.`
    : `Clear the stored email for ${username}?`;
}

/** Which actions the account view offers. Email can only be cleared when it is not backed by Google. */
export function maintainerGoogleAvailability(account: { googleLinked?: boolean; email: string | null }) {
  return { canDisconnectGoogle: account.googleLinked === true, canClearEmail: account.googleLinked !== true && Boolean(account.email) };
}
