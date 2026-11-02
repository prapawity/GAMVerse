/**
 * Fixed-window limiter for editing endpoints. A person saving props a few times a
 * second is fine; a script or a stuck client hammering the save path is not,
 * because every save holds a row lock and re-validates the office's props.
 */
export function createWriteRateLimiter(limit: number, windowMs: number, now: () => number = () => Date.now()) {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    /** Returns 0 when the request may proceed, otherwise the seconds to wait. */
    check(key: string): number {
      const time = now();
      if (windows.size > 5_000) for (const [id, entry] of windows) if (time - entry.startedAt >= windowMs) windows.delete(id);
      const entry = windows.get(key);
      if (!entry || time - entry.startedAt >= windowMs) {
        windows.set(key, { startedAt: time, count: 1 });
        return 0;
      }
      if (entry.count >= limit) return Math.max(1, Math.ceil((entry.startedAt + windowMs - time) / 1000));
      entry.count += 1;
      return 0;
    },
  };
}
