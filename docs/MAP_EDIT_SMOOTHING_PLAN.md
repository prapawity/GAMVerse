# Map/prop edit smoothing plan

Goal: when one member saves props or map changes, everyone else keeps playing. No disconnects, no cancelled walks that are still valid, no whole-office rebuild for a cosmetic change, and bounded server work when saves arrive in bursts.

## Findings (code read, not yet load-tested)

- `OfficeRoom.applyMapConfig` treated every save as a full geometry change: it cancelled every desk walk and route, rebuilt the seat index, cleared pending sits, and bumped the navigation revision even when only a non-colliding decoration moved.
- A player left standing where a new prop landed was moved to the *first* spawn point, far away, and disconnected (`leave`) if no spawn was free.
- `OfficeRoom.updateMap` re-read the map from PostgreSQL once per save, with no coalescing, so a burst of saves ran one full apply per save.
- The client rebuilds the whole Three.js scene when `roomLayout` changes (`WorldCanvas.tsx`, effect dependency). That is phase 2.

## Phases (each is one PR and leaves the game playable)

1. **Server apply path (this phase).**
   - `mapChangeImpact.ts`: pure classifier that says whether navigation, seats or world geometry changed.
   - `applyMapConfig` only invalidates routes, desk travel and meet requests when navigation changed (walls, doors, zones, roads, dimensions, spawn, or a colliding / seat / vehicle prop). Seat index and pending sits only reset when a seat prop changed.
   - Displaced players move to the nearest free walkable point first; spawn fallback and `leave` stay as the last resort.
   - `updateMap` is single-flight per office with one trailing re-run, so bursts collapse and every caller still gets a read that started after its call.
2. **Client rebuild frequency (done: 2a) and incremental props (open: 2b).**
   - 2a: `ui/officeMapUpdates.ts`. `office-map` messages are applied first-immediately, then at most once per 300 ms with only the latest payload, and an update whose layout is identical keeps the old object, so the scene is not rebuilt for nothing.
   - 2b (done): `world/props/incrementalProps.ts` splits the layout into scene structure and ordinary props. `WorldCanvas` rebuilds only when the structure changes; adding, moving or removing an ordinary prop is applied in place (`propSyncRef`, per-prop handle with its pick targets, selection, collision overlay, deferred model, occlusion registration and culling entries, all removed and disposed together). Vehicles, instanced scenery and legacy road tiles still trigger a full rebuild.
   - Verified in a harness that mounts the real `WorldCanvas` in Chromium: before, 24 edits created 22 renderers; after, 1 (no rebuild), with identical object and geometry counts over a 150-edit soak. Also verified live in the app: placing and removing a prop with the editor caused no canvas rebuild.
3. **Diff broadcast.** `props-changed` with ops and version; full `office-map` only on version gaps.
4. **Concurrent editing.** Delta ops with per-prop revision and client auto-rebase instead of whole-array replace.

## Out of scope for phase 1

Rejecting a save because a player stands on the new prop needs live player positions, which only the realtime process has; the API process cannot know them. Phase 1 handles it by relocating the player instead.

## Status update

- Phase 1b (done): `saveOfficeProps` uses a spatial support index (`createRoomPropSupportIndex`); 5,130 props save in ~0.3 s instead of ~20 s. API logs `saveMs`/`notifyMs` and sends `Server-Timing`.
- Phase 3 (done): props-only saves (<= 400 changed props) are broadcast as `props-changed` patches (`mapPropsPatch.ts`); clients that miss a version send `request-office-map` and receive the full map. Measured live: 791,225 B full map on join vs 165 B for an add and 85 B for a delete.
- Phase 4 (done, except load test): `POST /offices/:id/props/ops` merges delta saves per prop (`propOps.ts`, `applyOfficePropOps`); the Modify Props editor sends only its changes with the copy each started from, so members editing different props never conflict. Saves are rate limited to 30 per 10 s per person. Open decision: any office member can still save props, while map saves need owner/admin/maintainer. Not done: a multi-account 100-editor load test.
- Load test (`scripts/props-load-test/props-editors.mjs`, 100 virtual editors, 60 s, 5,130-prop office): first run exposed a connection-pool starvation bug in `applyOfficePropOps`; after fixing it and group-committing concurrent saves: 1,421/1,421 saves OK, p50 339 ms, p95 618 ms, p99 1.1 s, 17.8 saves/s, 403 conflicts (all on shared props), every private prop verified in place, office restored.
