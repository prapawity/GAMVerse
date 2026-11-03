# Gather-style 2.5D map plan

Status: in progress. The map now renders catalog props as cached oblique sprites, draws height-projected wall faces, sorts walls, props and avatars together by ground depth, raises supported props by their saved elevation, fades walls that visually occlude a nearby avatar, matches the 3D prop culling range and zone visibility (200 m with 15 m hysteresis, character-focused in play and camera-focused in edit mode), bounds actor overlays to 60 m, and snapshots character sprites at higher atlas resolution for clearer zoomed-in rendering. Isolated browser reviews cover furnished rooms and a generated 676-prop campus; empty-map click-to-walk reaches the renderer listener. Server route, seating, camera-zoom and multiplayer behavior still need runtime checks.

## Direction

Turn the current orthographic top-down map into a fixed-angle oblique 2.5D play view. Keep the existing GAMVerse lavender, violet and cyan identity. Keep the reliable top-down ground grid, while furniture, trees and vehicles gain visible sides, consistent light and ground shadows from the actual 3D catalog models. Avatars, name pills, interaction hints and controls remain upright and legible in screen space. Avoid decorative orbit lines, generic gradients and excessive outlines.

The map remains a play surface, not an illustration: screen-to-world picking, click-to-walk, keyboard movement, seat/bed anchors, auto-move, prop footprints, zone boundaries and voice membership must continue to refer to the same authoritative world coordinates. Keep the orthographic ground projection, fixed north orientation and sprite camera angle; do not add camera rotation until picking and controls have shipped and been checked.

## Visual system

- Ground: muted lavender-gray outside the office; warm pale violet work floors; cool lavender private rooms; existing restrained road charcoal with quiet lane markings.
- Depth: one upper-left key light, low-opacity shadows cast down-right, visible model sides, and ground-anchored object sprites with transparent height above their unchanged footprints.
- Hierarchy: floor and road first, then walls and large structures, furniture/foliage/vehicles, avatars, labels and controls.
- Detail: geometry and texture fade at overview scales; keep text and interaction affordances screen-aligned and high contrast.
- Motion: no ambient bobbing or spinning; depth cues stay stable while panning and zooming.

## Phases

### Phase A: oblique asset rendering

- Render catalog models from one fixed shallow camera angle, with transparent sprite space above each ground footprint; retain cached idle-time rendering and bump the per-device cache key.
- Draw model sprites from their ground anchors with soft contact shadows. Keep their authoritative width, depth, rotation and interaction anchors unchanged.
- Preserve the existing top-down treatment for explicit top-down scene assets and vector fallback when model loading fails.
- Sort props by ground depth before drawing so nearer props overlap farther props naturally.
- Done when click picking, click-to-walk, pan, zoom-around-cursor, seat/bed anchors and vehicle following still resolve the same world points and sprites show volume.

Implementation: actual catalog models render from a fixed shallow camera, use a versioned IndexedDB cache key, sit above unchanged ground footprints, sort by ground depth, and share a hard-capped 32 MiB in-memory LRU cache. If a sprite cannot fit without evicting another currently visible sprite, that prop keeps its vector fallback for the session, avoiding cache overcommit and repeated fallback/model swapping. Soft radial ground shadows are baked into sprites off the draw loop. Wall spans now use their saved height to draw visible faces and are depth-sorted with furniture and avatars so they occlude objects behind them; horizontal wall sort depth uses its near edge to avoid sprites just behind a wall painting over the wall face. Wall faces fade when an avatar is within the projected occluded area. Supported props shift by their saved tabletop/shelf elevation. The overlay reuses support geometry and wall/door indexes per layout instead of rebuilding them each frame. It applies the 3D covered-zone and current-private-room filters to props, with edit-props mode using the map camera focus to identify the private room. Seated and lying avatars now use the shared furniture anchors for horizontal placement and project upward by the anchor's seat/bed elevation; their labels and indicators follow, and the avatar is depth-ordered at that height. Avatar portrait tiles use higher source resolution and a restrained contact shadow to keep their silhouettes distinct from pale floors. Isolated browser previews confirmed standing, chair and bed pose placement at close zoom, plus selection by clicking the visually elevated seated avatar. They produced no console errors; OBJLoader reports non-fatal `usemap` warnings for some catalog models. Tall trees, streetlights and poles keep an upright silhouette at every zoom; low zoom uses rounded/symbolic forms instead of square footprint tiles. Prop detail LOD uses separate enter/exit thresholds to prevent flicker near its zoom boundary. Doors swing open on nearby player approach, stay open briefly, then animate closed without changing authoritative collision geometry. The 2.5D play map uses the 3D prop budget of 200 m with 15 m hysteresis from the local character; edit mode uses the camera focus. Actor overlays remain at 60 m from camera focus, and name tags/status indicators share that actor limit. A local browser review at 23% map zoom showed upright tree and lamp silhouettes. The workspace build and client typecheck pass. A generated campus with 676 props, 656 walls and 60 roadways was reviewed at overview (37.2 ms), north rooms (19.0 ms) and civic center (8.9 ms); these are single-frame samples, not a baseline benchmark. A click on empty map reached the renderer's walk listener at the expected world coordinate. The client-to-server on-foot route handoff has not yet been exercised in a running office; zoom-around-cursor and two-session checks also remain outstanding.

### Phase B: dimensional scene rendering

Status: implemented in code and visually reviewed on a generated campus; a comparative performance baseline remains outstanding.

- Draw surfaces and roadways with restrained bevels, edge depth and existing material cues.
- Add consistent contact shadows to vector fallbacks; tune catalog sprite elevation for furniture, foliage and vehicles.
- Preserve the current top-down asset fallback for unsupported or not-yet-rendered models.
- Done when representative private rooms, campus streets, trees and auto-move vehicles read as one coherent scene without obscuring avatars or zone affordances.

### Phase C: play and accessibility pass

- Tune player sprites and seated/lying poses for projected ground anchors; preserve names, local/speaking rings and readable status labels.
- Check low zoom, high zoom, narrow viewports, reduced-motion preference, and high-DPR canvases.
- Compare frame time and cache memory against the current 2D renderer; keep idle-redraw and worker/main-thread rules intact.
- Done when the full 2.5D play loop works in two browser sessions and remains within the current map's responsiveness and memory budgets.

## Verification

- Add registered pure tests for projection/inverse projection, projected footprints, anchors and depth ordering before each behavior change.
- Run the workspace build and relevant registered client tests.
- Browser-check representative furnished room and generated campus, including click-to-walk, seat/bed poses, auto-move, props at low zoom and two-session presence/voice. Report any unavailable multiplayer checks explicitly.

## Design review

This direction is specific to the existing virtual-office map: it gives the furnished world more depth while keeping the familiar map grid, movement and labels usable. A full free camera would complicate orientation and movement, and changing the world projection is unnecessary to make the catalog models dimensional, so the first pass keeps input geometry stable and gives sprites a consistent ground anchor.
