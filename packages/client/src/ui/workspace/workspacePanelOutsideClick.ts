// Overlays layered above the office never dismiss a panel.
const OVERLAY_SELECTOR = "dialog, [role='dialog'], [role='menu'], [role='listbox']";
// The panel itself plus the control that toggles it; counting the toggle as an outside click would close and reopen the panel at once.
export const WORKSPACE_PANEL_KEEP_OPEN_SELECTOR = `#office-sidebar, .office-rail, ${OVERLAY_SELECTOR}`;
export const ACCOUNT_DRAWER_KEEP_OPEN_SELECTOR = `#character-drawer, .office-account-button, .right-character-tab, ${OVERLAY_SELECTOR}`;

export function isWorkspacePanelOutsideClick(target: EventTarget | null, keepOpenSelector = WORKSPACE_PANEL_KEEP_OPEN_SELECTOR): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return !(target as Element).closest(keepOpenSelector);
}
