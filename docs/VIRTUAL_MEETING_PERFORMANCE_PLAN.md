# Virtual meeting performance — implementation handoff

Date: 2026-11-03
Status: proposed; implementation and browser verification are not complete.
Implementer: Luna. Read `AGENTS.md` before starting. Each phase is one PR and
must leave the office playable. Implement one phase at a time.

## Scope and evidence

Reduce repeated client/server work while preserving movement, visual behavior,
meeting membership and uninterrupted conversation. This plan follows a read-only
review of the current worktree; the findings are code-level scaling risks, not
measured causes of a particular user's stutter. No new FPS/capacity claim was
established. Re-check the source: line numbers and existing work can change.

Related plans: `RENDERING_BUDGET_PLAN.md`, `OFFICE_SCENE_PERFORMANCE_PLAN.md`,
`REALTIME_CAPACITY_PLAN.md`, `REALTIME_WORKLOAD_SEPARATION_PLAN.md`, and
`REALTIME_RUNTIME_METRICS.md`. Reuse their implemented helpers and instrumentation.
Old measurements and failed-test counts in those documents are historical.

The checkout already contains unrelated edits to OfficeApp, WorldCanvas,
OfficeRoom, map2d and documentation. Record `git status` and the starting diff.
Preserve those edits; never reset them or stage the whole checkout blindly.

## Voice continuity is a constraint, not a new implementation task

The owner reports that rotating media rooms on membership changes previously
disconnected people who were still talking. Keep the existing ordinary meeting/
private-room path: stable media room, remove only the participant losing access.
See `offices/privateConversations.ts` (`evictLost`, departure handling).

- Do not add room rotation for ordinary joins, departures, expiry or revocation.
- Preserve existing exceptional rotations, including relevant layout/ownership
  changes; do not remove them incidentally. Proximity has its own lifecycle:
  preserve it too rather than applying a blanket policy to all voice targets.
- Preserve server authorization, access deadlines, token validation, mute intent,
  recovery behavior and selective remote video subscriptions.
- Participant removal and JWT invalidation are different. Self-hosted token replay
  is a known separate limitation; this plan does not claim to solve it or silently
  trade it for whole-room reconnects. Any future solution needs a separate design.
- Do not change `voiceRoomSession`, token TTL/grants, media epochs or LiveKit
  configuration as a side effect of these optimizations.

## Phase 0 — Capture a repeatable baseline

Record commit plus working diff, actual served artifact/version, browser/device,
viewport/DPR, map/prop counts, player/pet counts and quality settings. Warm assets
first. Use the same scene, route, camera and media activity before and after.
Keep API/realtime separate when measuring production-like server capacity.

Measure 2D and 3D: idle, walking, turning and repeated mode switches. Start with
two real browsers, then 10/25/50 participants as the environment allows; distinguish
real rendering/media clients from simulated movement clients. Include a crowded
meeting and dispersed users. Use repeated equal windows (at least 30 seconds
after warm-up), report medians and p95 plus sample counts, not a single FPS readout.

Capture RAF frame intervals, long tasks, synchronous frame callback work, state
apply duration, CPU/heap and renderer draw/triangle/resource counts. Existing
`clientRuntimeMetrics` frame duration measures synchronous callback work, not GPU
completion or the entire frame interval. Measure RAF gaps separately. For server
capture CPU deltas, RSS, tick/gap p95, event-loop p99 and replication bytes/patch
duration using the existing internal metrics boundary. Never log tokens or media.

Store logs/traces outside the repository, never commit `.loadtest/` output.
Do not call historical 150/200-user mock runs proof of single-room media capacity.
If browser measurement is unavailable, report that limitation; continue with
scoped implementation checks but leave performance acceptance pending.

## Phase 1 — Suspend unnecessary 3D work in 2D (priority 1)

Entry: `client/src/world/WorldCanvas.tsx` shared RAF, avatar/pet creation and mixer
updates, and the final `if (!showMap2d) renderer.render(...)`.

1. Extract a focused frame-work policy/module under `world/`; keep WorldCanvas
   integration small. Classify state/input/shared presentation versus 3D-only work.
2. Keep networking, authoritative snapshots, local movement intent, travel,
   input, camera mode state, 2D sprites/doors, reactions and ambient audio live.
   Do not return early from the whole RAF when in 2D.
3. Skip hidden 3D mixers, procedural pose updates, 3D labels/overlays and other
   verified 3D-only work. Audit dependencies before skipping a block: map2d may
   consume shared interpolated positions or other derived state.
4. Defer unnecessary main-scene avatar/pet creation in 2D where dependency review
   proves it safe. Preserve the separate 2D portrait/sprite asset pipeline
   (`map2d/avatarPortraitSnapshot.ts` can legitimately use an offscreen renderer).
   Do not attempt to eliminate all Three.js work from 2D indiscriminately.
5. On return to 3D reconcile current players, vehicles, poses and pets once,
   reset timing, and render current state. Do not replay time spent hidden or
   apply a huge animation delta. Guard stale async asset completions and cleanup.

Acceptance: repeated 2D/3D switching, late joins/departures, pet replacement,
seated/lying/vehicle poses, tab hide/resume and WebGL fallback remain correct;
hidden 3D mixers stop ticking. Record before/after 2D CPU/frame-time and switch
latency, including resource counts after repeated switching.

## Phase 2 — Cache decorative proximity topology (priority 2)

Entries: `WorldCanvas.tsx` dome calculation; `world/proximityGroupShape.ts`.
Currently BFS scans the full point collection and all components are rebuilt
every RAF: approximately quadratic work even for isolated participants.

1. Separate topology rebuilding from per-frame dome smoothing in a focused module.
2. Rebuild only when eligible membership, relevant positions or radius changes;
   avoid rebuilding just because an unchanged snapshot arrives. Prefer an existing
   snapshot/revision integration over constructing another sorted signature per RAF.
3. Reuse an appropriate shared spatial-neighbor helper or add a pure indexed
   query with the same distance semantics. Preserve transitive chains, isolated
   players, stable group keys and the server-confirmed own-group fallback.
4. Smooth cached shapes each frame. Keep these groups decorative; they must never
   determine media authorization. Account for distant/coarse player markers.
5. Clear caches on room/layout replacement, departure and teardown. Define any
   cadence/radius tunable with units; do not silently change the audible radius.

Acceptance: zero topology rebuilds over unchanged frames; a changed point/radius
invalidates correctly; chains, split/merge, boundary distance and fallback match
existing behavior. Compare candidate checks on sparse and dense fixtures; dense
groups can still require quadratic neighbor output, so do not promise O(N) always.

## Phase 3 — Cache roof occupant rows (priority 3)

Entries: `world/zoneRoofs.ts`, `world/zoneVisibility.ts`, WorldCanvas caller.

Separate occupant-row preparation from per-frame projection. Invalidate on zone
geometry/coverage, player movement, joins/leaves, name/status and layout changes.
Build zone membership once per relevant update instead of scanning all players
for each roof every frame. Preserve overlapping-zone semantics and row ordering.
Skip hidden label preparation/projection; retain the invalidation needed to
reconcile immediately when shown again. Avoid unchanged DOM writes and repeated
layout reads; read viewport dimensions once per frame. Do not accidentally alter
roof mesh visibility while hiding labels.

Acceptance: unchanged frames do not rebuild rows/serialize arrays; hidden labels
do not project; reopening shows current names/status; overlapping zones, editing,
resize, 2D/3D switching and roof geometry behave as before.

## Phase 4 — Bound local recording memory (priority 4)

Entry: `ui/meetings/useMeetingRecording.ts`, especially `chunksRef`, display
capture and MediaRecorder handlers. One-second chunks currently accumulate until
stop. Extract capture/storage lifecycle into a focused helper.

1. Provide a bounded fallback with named maximum byte/duration constants and a
   visible limit. Propose/document chosen limits; do not imply unlimited recording.
   Stop safely before sustained unbounded growth and finalize a playable file.
   Include encoder/final-chunk overhead in the budget; a timeslice is not an exact
   upper bound on chunk size, and a duration limit alone is not a byte bound.
2. Where supported, optionally stream chunks to a user-selected file. Feature
   detect the API and retain a working fallback for other browsers. Serialize
   writes, handle backpressure/write failure, close/abort correctly and release
   stream tracks/object URLs. Do not merely move an unbounded queue elsewhere.
3. Use deliberate capture FPS/resolution targets, without lowering shared live
   camera/screen quality incidentally. Preserve participant consent and stop on
   roster change, leave/disconnect, cancellation and browser-ended capture.
4. Guard async permission/file-picker/recorder completion against old room or
   request generations and unmount. Confirm the source contains the intended
   audio; display/tab capture is not a guaranteed mix of all meeting voices and
   the requester's microphone. No server recording/storage is introduced here.

Acceptance: fake chunk streams exercise limits/failures/cleanup; real recording
opens with audio/video; limit stop, user stop, roster change and navigation release
capture. Measure memory over an extended recording; report browser compatibility.

## Phase 5 — Reduce repeated server projection (profile before changing)

Entry: `server/src/offices/OfficeRoom.ts` (`spatialProjectionDirty`,
`updateMeetingMembership`, `updateProximity`), `spatialConversations.ts`,
`playerSpatialInterest.ts`, private access reconciliation.

Movement marks projection dirty, bypassing its nominal 100 ms interval. Measure
membership, private-access, conversation, AOI and serialization work separately.
Extract scheduling/index logic into focused modules. Use per-domain dirty sets
and incremental indexes/cached unchanged projections where evidence supports it.
Coarser discovery/AOI work may have a separate cadence, but access expiry,
revocation and authoritative membership must retain their correctness/timing.
Do not simply throttle the whole block, raise the simulation timestep, trust
client coordinates or weaken collision/access checks. Preserve distant markers,
initial snapshots, reconnect, maps/props revision separation and voice continuity.

Acceptance: stationary work drops without stale joins/leaves; compare dispersed
and crowded loads and mixed moving/idle users. Two-browser doorway, locked-room,
expiry, proximity and reconnect checks must pass without introducing room churn.
Retain current behavior unless the measured change justifies its added complexity.

## Phase 6 — Extend low-resource animation policy (profile first)

Entry: `world/renderQuality.ts` currently controls DPR/shadows only. After phases
1–3, use a focused visibility/distance animation policy for distant avatars/pets.
Keep local and important visible animation responsive; throttle remote visual
updates with bounded elapsed time and reconcile on re-entry. Do not throttle
network intent, server state, audio or movement interpolation needed by 2D.
Test culling with unusual/skinned pets rather than blindly enabling frustum
culling on rigs that disabled it for correctness. Measure CPU, GPU and visual
quality. DSP/background processing or live media quality changes need separate
evidence and scope; they are not automatic consequences of low-resource mode.

## Verification and delivery for every phase

- Add meaningful adjacent regression tests for the extracted policy/cache/lifecycle
  and register new test files in the owning package's explicit test script.
  Demonstrate they fail with the optimization removed where applicable; do not
  count tests that only assert a newly added helper's own implementation.
- Run `pnpm build` for TypeScript changes, `pnpm test`, and server tests
  (`pnpm --filter @gammyverse/server test`) when server/shared behavior changes.
  Use pinned pnpm/corepack. Compare failures against the actual starting checkout,
  not outdated test counts in AGENTS or older review documents.
- Run at least two real browser sessions on Compose for movement/media checks:
  cross a doorway, switch 2D/3D, hide/resume a tab, reconnect, and sign out.
  Use three sessions for the A/B-talking-while-C-joins/leaves scenario. In meeting
  and private rooms verify ordinary third-party membership changes do not force
  A/B to reconnect. For proximity, preserve its existing authorized membership
  rotation and recovery behavior, without adding churn; do not apply the stable
  meeting-room gate to proximity. Record scenarios not run as outstanding.
- Repeat phase-0 matched measurements. Report removed work counts and p95, any
  worse cases, compatibility/resource issues and remaining limits. If no measured
  gain appears, investigate or narrow/revert the candidate rather than claim it.
- Obtain independent review; the implementer does not review its own change.
  Update README for public behavior and PROJECT_DOCS current section for durable
  architecture changes. Do not rewrite unrelated existing edits.

## Outside this handoff

Production deploy/config changes, TURN/TLS provisioning, secrets, migrations,
new asset packs, token-revocation redesign, host controls, captions/transcription,
shared notes and recording archives are separate work. Existing selective video,
lazy LiveKit loading, route workers and static-scene caches already exist; do not
reimplement them or cite historical findings as current missing features.

## Prompt to give Luna

Read AGENTS.md and docs/VIRTUAL_MEETING_PERFORMANCE_PLAN.md. Implement Phase 0
and Phase 1 only, preserving the existing working diff and media continuity.
Extract focused modules; keep shared state/input and 2D asset generation working.
Provide regression evidence, required build/tests, matched browser measurements
and explicit outstanding checks. Obtain independent review before merging.
Stop after this playable phase and report the remaining phases; do not deploy.
