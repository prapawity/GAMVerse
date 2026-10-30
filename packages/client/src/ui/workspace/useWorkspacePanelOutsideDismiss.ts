import { useEffect } from "react";
import { isWorkspacePanelOutsideClick, WORKSPACE_PANEL_KEEP_OPEN_SELECTOR } from "./workspacePanelOutsideClick";

/** Closes a panel on any pointer press outside it. Listens on the document in the capture phase so canvas handlers cannot swallow the event. */
export function useWorkspacePanelOutsideDismiss(open: boolean, close: () => void, keepOpenSelector = WORKSPACE_PANEL_KEEP_OPEN_SELECTOR): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (isWorkspacePanelOutsideClick(event.target, keepOpenSelector)) close(); };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close, keepOpenSelector]);
}
