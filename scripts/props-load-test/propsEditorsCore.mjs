// Simulates many members editing office props at once through POST /offices/:id/props/ops.
// Transport-agnostic: the caller supplies `request(editorIndex, method, path, body)`.
// Only props created by the run (id prefix "lt-<runId>-") are ever changed or removed.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, index * size + size));

export async function runPropsEditorsLoad(options) {
  const {
    request, editors = 100, durationMs = 60_000, meanSaveIntervalMs = 4_000, hotProps = 20, hotShare = 0.3,
    ownProps = 3, seed = 1, runId = Math.random().toString(36).slice(2, 8), log = () => {}, now = () => performance.now(),
  } = options;
  const random = mulberry32(seed);
  const prefix = `lt-${runId}-`;

  const first = await request(0, "GET", "/props");
  if (first.status !== 200 || !Array.isArray(first.body?.props)) throw new Error(`Could not read office props (status ${first.status}).`);
  const baselineCount = first.body.props.length;
  const template = first.body.props.find((prop) => !(prop.elevation > 0) && String(prop.asset).startsWith("kit:") && !String(prop.asset).includes("mirror") && Math.abs(prop.x) < 50 && Math.abs(prop.z) < 50);
  if (!template) throw new Error("No suitable template prop found to copy.");
  const baseProp = (id, dx, dz, rotation = 0) => ({ ...template, id, x: Math.round((template.x + dx) * 100) / 100, z: Math.round((template.z + dz) * 100) / 100, rotation });
  const jitter = () => Math.round((random() * 8 - 4) * 100) / 100;

  const stats = { requests: 0, status: {}, applied: 0, conflicts: { changed: 0, removed: 0, exists: 0 }, latencies: [], failures: 0 };
  const hot = Array.from({ length: hotProps }, (_, index) => baseProp(`${prefix}hot-${index}`, jitter(), jitter()));
  // What each editor believes the server holds for each prop it knows about.
  const views = Array.from({ length: editors }, () => ({ own: new Map(), hot: new Map(hot.map((prop) => [prop.id, prop])) }));
  const ownSetup = [];
  views.forEach((view, editor) => {
    for (let k = 0; k < ownProps; k += 1) {
      const prop = baseProp(`${prefix}e${editor}-${k}`, jitter(), jitter());
      view.own.set(prop.id, prop);
      ownSetup.push(prop);
    }
  });

  let cleanupRequired = false;
  try {
    cleanupRequired = true;
    for (const part of chunk([...hot, ...ownSetup].map((prop) => ({ op: "upsert", prop })), 500)) {
      const setup = await request(0, "POST", "/props/ops", { ops: part });
      if (setup.status !== 200 || setup.body.conflicts.length) throw new Error(`Setup failed (status ${setup.status}).`);
    }
    log(`setup: ${hot.length} shared + ${ownSetup.length} private props created`);

    const deadline = now() + durationMs;
    const save = async (editor, ops, apply) => {
      const startedAt = now();
      let response;
      try { response = await request(editor, "POST", "/props/ops", { ops }); } catch { stats.failures += 1; return; }
      stats.latencies.push(now() - startedAt);
      stats.requests += 1;
      stats.status[response.status] = (stats.status[response.status] ?? 0) + 1;
      if (response.status !== 200) return;
      const conflicted = new Map(response.body.conflicts.map((conflict) => [conflict.id, conflict]));
      stats.applied += response.body.applied;
      for (const conflict of response.body.conflicts) stats.conflicts[conflict.reason] = (stats.conflicts[conflict.reason] ?? 0) + 1;
      apply(conflicted);
    };

    const editorLoop = async (editor) => {
      const view = views[editor];
      let counter = 0;
      await sleepMs(random() * meanSaveIntervalMs);
      while (now() < deadline) {
        const roll = random();
        if (roll < hotShare) {
          const target = view.hot.get(`${prefix}hot-${Math.floor(random() * hotProps)}`);
          const next = { ...target, x: Math.round((target.x + (random() - 0.5)) * 100) / 100 };
          await save(editor, [{ op: "upsert", prop: next, base: target }], (conflicted) => {
            const conflict = conflicted.get(target.id);
            if (conflict) { if (conflict.current) view.hot.set(target.id, conflict.current); } else view.hot.set(target.id, next);
          });
        } else if (roll < hotShare + 0.5) {
          const ids = [...view.own.keys()];
          const target = view.own.get(ids[Math.floor(random() * ids.length)]);
          const next = { ...target, x: Math.round((target.x + (random() - 0.5)) * 100) / 100, rotation: Math.floor(random() * 4) * (Math.PI / 2) };
          await save(editor, [{ op: "upsert", prop: next, base: target }], (conflicted) => { if (!conflicted.has(target.id)) view.own.set(target.id, next); });
        } else if (roll < hotShare + 0.5 + 0.1 || view.own.size <= 1) {
          const added = baseProp(`${prefix}e${editor}-n${counter += 1}`, jitter(), jitter());
          await save(editor, [{ op: "upsert", prop: added }], (conflicted) => { if (!conflicted.has(added.id)) view.own.set(added.id, added); });
        } else {
          const ids = [...view.own.keys()];
          const target = view.own.get(ids[Math.floor(random() * ids.length)]);
          await save(editor, [{ op: "remove", id: target.id, base: target }], (conflicted) => { if (!conflicted.has(target.id)) view.own.delete(target.id); });
        }
        await sleepMs(-Math.log(1 - random()) * meanSaveIntervalMs);
      }
    };
    const startedAt = now();
    await Promise.all(Array.from({ length: editors }, (_, editor) => editorLoop(editor)));
    const elapsedMs = now() - startedAt;

    // Every private prop must sit exactly where its only editor last saw it.
    const final = await request(0, "GET", "/props");
    const serverById = new Map(final.body.props.map((prop) => [prop.id, prop]));
    let mismatches = 0;
    let missing = 0;
    let expectedOwn = 0;
    for (const view of views) for (const prop of view.own.values()) {
      expectedOwn += 1;
      const actual = serverById.get(prop.id);
      if (!actual) { missing += 1; continue; }
      if (actual.x !== prop.x || actual.z !== prop.z || actual.rotation !== prop.rotation) mismatches += 1;
    }
    const strayOwn = final.body.props.filter((prop) => prop.id.startsWith(`${prefix}e`)).length - expectedOwn;
    const hotPresent = hot.filter((prop) => serverById.has(prop.id)).length;
    const sorted = [...stats.latencies].sort((a, b) => a - b);
    const report = {
      runId, editors, durationSec: Math.round(elapsedMs / 1000), saves: stats.requests, savesPerSec: Math.round((stats.requests / (elapsedMs / 1000)) * 10) / 10,
      status: stats.status, networkFailures: stats.failures, changesApplied: stats.applied, conflicts: stats.conflicts,
      latencyMs: { p50: Math.round(percentile(sorted, 50)), p95: Math.round(percentile(sorted, 95)), p99: Math.round(percentile(sorted, 99)), max: Math.round(sorted.at(-1) ?? 0) },
      verify: { privatePropsExpected: expectedOwn, missing, wrongPosition: mismatches, strayPrivateProps: strayOwn, sharedPropsPresent: `${hotPresent}/${hot.length}`, ok: missing === 0 && mismatches === 0 && strayOwn === 0 && hotPresent === hot.length },
    };
    return report;
  } finally {
    if (cleanupRequired) {
      try {
        const current = await request(0, "GET", "/props");
        const mine = current.body.props.filter((prop) => prop.id.startsWith(prefix));
        for (const part of chunk(mine.map((prop) => ({ op: "remove", id: prop.id, base: prop })), 500)) await request(0, "POST", "/props/ops", { ops: part });
        const after = await request(0, "GET", "/props");
        log(`cleanup: removed ${mine.length} test props, office has ${after.body.props.length} props (was ${baselineCount})`);
        if (after.body.props.length !== baselineCount) log("WARNING: prop count differs from the starting count; inspect the office.");
      } catch (error) {
        log(`WARNING: cleanup failed (${error instanceof Error ? error.message : error}). Remove props whose id starts with "${prefix}".`);
      }
    }
  }
}
