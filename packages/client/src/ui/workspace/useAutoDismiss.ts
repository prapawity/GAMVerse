import { useEffect } from "react";

export const ALERT_AUTO_DISMISS_MS = 3_000;

/** Clears a transient message after `delayMs`; a new message restarts the countdown. */
export function useAutoDismiss(message: string | null, dismiss: () => void, delayMs = ALERT_AUTO_DISMISS_MS): void {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(dismiss, delayMs);
    return () => window.clearTimeout(timer);
  }, [message, dismiss, delayMs]);
}
