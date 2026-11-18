/** Decides how often the world should render based on whether the user is looking at it. Pure: no DOM access. */

export const RENDER_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export const BLURRED_FRAME_INTERVAL_MS = 1000 / 8;

export type RenderActivityMode = "full" | "throttled" | "paused";

export interface RenderActivityState {
  /** document.visibilityState === "visible" */
  visible: boolean;
  /** document.hasFocus() — false when another app or window is in front. */
  focused: boolean;
  /** performance.now() of the last pointer, wheel, key or touch input. */
  lastInputAtMs: number;
}

export interface RenderActivityDecision {
  mode: RenderActivityMode;
  /** Why rendering is paused; `null` unless mode is "paused". */
  pauseReason: "hidden" | "idle" | null;
  /** Minimum time between rendered frames; 0 means every animation frame. */
  minFrameIntervalMs: number;
}

export function decideRenderActivity(state: RenderActivityState, nowMs: number, idleTimeoutMs = RENDER_IDLE_TIMEOUT_MS): RenderActivityDecision {
  if (!state.visible) return { mode: "paused", pauseReason: "hidden", minFrameIntervalMs: 0 };
  if (nowMs - state.lastInputAtMs >= idleTimeoutMs) return { mode: "paused", pauseReason: "idle", minFrameIntervalMs: 0 };
  if (!state.focused) return { mode: "throttled", pauseReason: null, minFrameIntervalMs: BLURRED_FRAME_INTERVAL_MS };
  return { mode: "full", pauseReason: null, minFrameIntervalMs: 0 };
}

/** True when a throttled loop should skip this animation frame. */
export function shouldSkipFrame(decision: RenderActivityDecision, nowMs: number, lastRenderedAtMs: number): boolean {
  return decision.minFrameIntervalMs > 0 && nowMs - lastRenderedAtMs < decision.minFrameIntervalMs;
}
