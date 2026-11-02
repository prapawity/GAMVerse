type Waiter = { resolve: () => void; reject: (error: unknown) => void };

/**
 * Single-flight per key with one trailing re-run.
 * While a run is in flight, further calls share ONE follow-up run that starts
 * after they were made, so a caller always observes data read after its call
 * and a burst of N calls costs at most two runs.
 */
export function coalescedByKey<Key>(run: (key: Key) => Promise<void>): (key: Key) => Promise<void> {
  const pending = new Map<Key, Waiter[]>();

  const execute = (key: Key, waiters: Waiter[]) => {
    Promise.resolve().then(() => run(key)).then(
      () => { for (const waiter of waiters) waiter.resolve(); },
      (error: unknown) => { for (const waiter of waiters) waiter.reject(error); },
    ).finally(() => {
      const next = pending.get(key) ?? [];
      if (next.length === 0) { pending.delete(key); return; }
      pending.set(key, []);
      execute(key, next);
    });
  };

  return (key) => new Promise<void>((resolve, reject) => {
    const waiter = { resolve, reject };
    const queue = pending.get(key);
    if (queue) { queue.push(waiter); return; }
    pending.set(key, []);
    execute(key, [waiter]);
  });
}
