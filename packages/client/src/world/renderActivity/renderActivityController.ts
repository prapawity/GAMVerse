import { decideRenderActivity, type RenderActivityDecision, type RenderActivityState, RENDER_IDLE_TIMEOUT_MS } from "./renderActivityPolicy";

const INPUT_EVENTS = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"] as const;

export interface RenderActivityController {
  current(): RenderActivityDecision;
  dispose(): void;
}

/** Watches visibility, window focus and user input, and calls `onChange` when the render decision changes. */
export function createRenderActivityController(onChange: (decision: RenderActivityDecision) => void): RenderActivityController {
  const state: RenderActivityState = {
    visible: document.visibilityState === "visible",
    focused: document.hasFocus(),
    lastInputAtMs: performance.now(),
  };
  let decision = decideRenderActivity(state, performance.now());
  let idleTimer = 0;

  const evaluate = () => {
    const next = decideRenderActivity(state, performance.now());
    scheduleIdleCheck();
    if (next.mode === decision.mode && next.pauseReason === decision.pauseReason) return;
    decision = next;
    onChange(decision);
  };
  const scheduleIdleCheck = () => {
    window.clearTimeout(idleTimer);
    if (decision.pauseReason === "idle") return;
    const remainingMs = Math.max(0, state.lastInputAtMs + RENDER_IDLE_TIMEOUT_MS - performance.now());
    idleTimer = window.setTimeout(evaluate, remainingMs + 50);
  };
  const onInput = () => {
    state.lastInputAtMs = performance.now();
    // Only re-evaluate when waking up; the idle timer handles the rest.
    if (decision.pauseReason === "idle" || !state.focused) {
      state.focused = document.hasFocus();
      evaluate();
    }
  };
  const onVisibility = () => { state.visible = document.visibilityState === "visible"; if (state.visible) state.lastInputAtMs = performance.now(); evaluate(); };
  const onFocus = () => { state.focused = true; state.lastInputAtMs = performance.now(); evaluate(); };
  const onBlur = () => { state.focused = false; evaluate(); };

  for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  scheduleIdleCheck();

  return {
    current: () => decision,
    dispose: () => {
      window.clearTimeout(idleTimer);
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    },
  };
}
