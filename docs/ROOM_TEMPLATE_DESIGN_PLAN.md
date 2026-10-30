# Room template design plan (floors, walls, ceilings, furnishing, vehicles)

Status: Phases 1 and 2 are implemented in the worktree (style table, floors, walls, roofs, private studio layouts). Phase 3 (civic decor), Phase 4 (cafeteria, lounge) and the park planting of Phase 5 are implemented; restroom cleanup, building alignment and curb parking (rest of Phases 4 and 5) are not. Each phase is one PR and leaves the game playable.

## Goal

New offices built from the campus template get rooms that each have their own look and a considered furniture layout, inside and outside. The mood is mixed: work rooms are warm, meeting and shared rooms are formal.

## Scope and decisions already taken

- Surfaces (floor, wall, ceiling treatment) are derived from the **room type**, not stored per zone. No `RoomLayoutZone` schema change and no SQL migration.
- Furniture, walls and vehicles are written by the generator, so they apply to **newly created offices only**. Saved maps and separately versioned props are not touched.
- Floors are drawn by the client from the zone id (`civicRoomFloorColor`, `map2dSurfaceStyle`). Moving them onto the shared style table therefore also restyles the floors of existing offices that use the generated ids. This is visual only and changes no saved data. Say if floors must stay as they are for old offices; the fix is to gate the new floor styles on a generated-layout marker.

## What exists today (read from the code)

| Area | Today |
| --- | --- |
| Zone kinds | `private`, `meeting`, `restroom` only. Civic rooms are told apart by id prefix (`shared-townhall`, `shared-lobby`, `shared-cafeteria`, `shared-lounge`, `meeting-small-*`, `meeting-large-*`, `shared-restroom-*`, `team-N-office-*`, `meeting-<edge>-N`). |
| Floors | `zoneFloorColor.ts` gives a flat colour per civic id. `map2dSurfaceStyle.ts` has four materials (wood, carpet, tile, grass) chosen by kind. Private rooms are carpet, restrooms tile, everything else wood. |
| Walls | Generated per room in `campusMapGenerator.ts` (`makeWall`): colour, height 2.5 m, and an optional fitted asset. Private rooms alternate one accent wall or the soft palette. Meeting rooms share a small asset list. |
| Roofs | Already exist (`zoneRoofs.ts`, `zoneVisibility.ts`). A room you are not in gets a roof slab (colour and height from its walls, thickness 0.16 m) with an occupant list on top. Props inside covered zones are hidden and their models are not loaded (`propModelVisibility.ts` and the prop pivots in `WorldCanvas.tsx`). Editing mode shows everything. So the goal of not rendering a room's props unless you are inside is already met; the work left is styling the roof. |
| Private studio | One fixed 8 × 8 m plan for every room (`campusPrivateRoomTemplate.ts`). Only monitor, bed, plant and decor vary. The desk, bed, kitchen line and laundry all sit against walls with no rug or zoning. |
| Team meeting | Mirrored two-island plan (`campusTeamMeetingTemplate.ts`), same for every edge. |
| Civic | `campusCivicRoomTemplates.ts` covers meeting-50, Town Hall, Lobby. Cafeteria and Lounge are furnished elsewhere and need an audit. |
| Restrooms | `campusRestroomFixtures.ts`: stalls, wash island, plus sofas, showers and bathtubs in the same room. |
| Vehicles | Eight hard-coded spots down the middle of the major roads, random asset from nine (including a monster truck), no relation to buildings or lane direction. |

## Audit of rooms furnished outside the main templates

- **Cafeteria** (`campusFurnishingTemplates.ts`): four identical table groups (one table, four chairs) in a 2 x 2 grid plus two plants, in a room about 40 x 40 m. There is no serving counter, no service aisle and no wall decoration.
- **Lounge:** furnished by `campusLobbyPlacements`, so it gets reception desks and a wayfinding sign. It needs its own layout.
- **Other `meeting` zones** fall back to a generic one or two table groups.
- **Restrooms** are furnished by the map generator directly (`campusRestroomFixtures`), not by the starter-prop step, and the empty-interiors option filters them by the `-starter-` id prefix.
- **Failing tests in this area** (they fail on a clean checkout and are not caused by this plan): `civic campus has fifty-seat meeting rooms...` (the western lawn is not a dense grove), `starter furniture leaves an actual walkable route...` (`team-1-office-01-starter-bed is approachable` fails, so the private studio bed is boxed in) and `seat collision follows chair and sofa model footprints...`. The bed result is direct evidence for Phase 2: the current studio plan blocks its own bed.

## Design

### Style table (shared, one place)

New `packages/shared/src/campusRoomStyles.ts`: a pure function `campusRoomStyle(zoneId, kind)` returning

```
{ floor: { material, base, seam, accent }, wall: { color, accentAsset?, trimColor }, ceiling: { fixtureAsset?, fixtureSpacingM, glowColor } }
```

The generator (walls), the 3D floors and the 2D surface style all read it, so the three can never drift. Tunables are named constants with units.

| Room | Mood | Floor | Walls | Ceiling treatment |
| --- | --- | --- | --- | --- |
| Private studio | one hue per room | pastel floor, hue stepped by the golden angle per room so neighbours differ and boundaries show | matching light wall, accent asset wall kept as today | warm pendant lamp over desk, one over the sofa |
| Team meeting | formal | slate-blue carpet islands on pale stone | light grey with a dark wood trim band | two rows of light panels over the islands |
| Meeting 50 | formal | mid-grey carpet | light grey, presentation wall in deep blue | light panel grid |
| Town Hall | formal | violet-grey carpet (matches the `#b8a1d9` zone tint) | pale lilac with dark trim | light panel grid plus spotlights on the stage |
| Lobby | welcoming | warm stone | warm white, wood reception wall | pendants over reception, panels over the waiting area |
| Cafeteria | warm | terracotta tile | warm white | pendant row over the serving counter |
| Lounge | warm | pale oak | sage accent wall | floor lamps (existing), two pendants |
| Restroom | clean | pale teal tile | white with a teal band | recessed panels over stalls |

### Roof and ceiling (corrected)

An earlier draft said the project had no roofs. That was wrong: roofs and interior-prop culling already exist. Phase 1 gives each room type its own roof colour from the style table (before, the roof took the colour of the first wall found inside the zone). The roof still opens when the local player stands inside the room.

Inside a room, the ceiling is expressed by:

1. light-fixture props at fixed elevation (the catalog already has a ceiling light panel and lamps), placed on a grid by the template;
2. a soft light pool drawn on the floor under each fixture in 2D and 3D.

Possible follow-up, not in these phases: fade the roof instead of switching it off.

### Private studio (8 × 8 m): three variants

The variant is chosen deterministically from the zone id, like today's monitor and bed choice. Every variant keeps the central entrance aisle (x within ±0.8 m of the door axis) empty and is authored for a south door, then rotated to the real door side.

```
Variant A "work nook"        Variant B "loft"            Variant C "host"
N wall                       N wall                      N wall
[bookcase][desk][bed....]    [bed....][desk][bookcase]   [tv........][desk small]
[   chair   ] [rug]          [rug][chair]                [sofa][table][sofa]
[sofa][ ][kitchen along E]   [kitchen along W][sofa]     [kitchen along E]
[washer][plant]  door S      [plant][washer]  door S     [washer][plant]  door S
```

Common rules: a rug under the main activity, plant in one corner, lamp beside bed or sofa, nothing blocking the door swing, no prop within 0.4 m of a wall asset.

### Team meeting rooms

Keep the two conference islands and paired lounges. Changes: slate-blue carpet islands, dark trim on walls, wall screen and shelving on the presentation wall, two rows of ceiling panels over the islands, and a per-edge variation (north and south mirror, east and west swap the lounge and refreshment sides) so the five rooms on an edge are not identical.

### Civic rooms

- **Meeting 50:** keep the audience block and stage; add side wall shelving, a wayfinding sign by the door, ceiling panel grid, carpet colour.
- **Town Hall:** keep the aisles; add stage lighting, banner props on the side walls, welcome desks moved beside the door, wide carpet runner on the central aisle.
- **Lobby:** reception desk faces the door instead of the side wall; waiting lounge arranged as two conversation groups; wayfinding sign on the far wall.
- **Cafeteria and Lounge:** audit their current furnishing, then give the cafeteria a serving counter line, round tables in a staggered grid and a clear service aisle; the lounge two sofa groups and a bookshelf wall.

### Restrooms

Remove sofas, showers and bathtubs from the shared restrooms (they read as wrong for the room). Keep stalls, a continuous wash line with mirrors, one accessible stall, a hand-dryer and bin by the door, tile floor and the teal wall band. Showers and a bathtub move into the private studio variants that suit them (variant B).

### Exterior

- **Buildings and plazas:** align finished buildings to the plaza edge with a consistent front setback; street trees on a regular spacing with walking gaps (already specified in `CAMPUS_LOOP_PLAN.md`), benches and lamps by building entrances rather than mid-block.
- **Park:** keep the pond and bridge; align path edges to the lawn border, group planting in odd-numbered clusters, add seating at path forks.
- **Vehicles and parking:** replace the eight mid-road spots with **parking bays along the curb** of the loop road and avenues, near building entrances and the Lobby. Rules: aligned with the lane direction, one bay length apart (no random overlap), never within one car length of an intersection, never on a driving lane, at least 6 m clear driving width left. Vehicle mix is deterministic by area (civic: sedans and taxi, residential edge: hatchbacks, SUV; the kart and monster truck only in the park service lane). The seed still controls variety within those lists.

## Phases

Each phase is one PR with tests.

1. **Style table and surfaces (done):** `campusRoomStyles.ts` gives each generated room its floor, wall and roof colour. 3D floors, 2D floors, roofs and generator walls all read it. Rooms drawn in the editor have no generated id, so they keep their own colour. Per-room floor textures (wood, carpet, tile) are still drawn only for the outdoor ground in 2D and are left for a later phase. Tests: every generated zone resolves to a style, walls use the style colour, work rooms read warm and meeting rooms cool, 2D and 3D floors agree.
2. **Private studio variants (done):** three variants, rotation by door side, rug and lamp placement. Tests: deterministic by zone id, no overlap, entrance aisle clear, prop budget respected, every asset exists in the catalog.
3. **Team meeting and civic rooms:** per-edge variation, wall decor, Town Hall, Lobby, Meeting 50, ceiling fixtures and light pools. Extend `campusFurnishing.test.ts` clearance and budget checks.
4. **Restrooms, cafeteria, lounge:** remove misplaced fixtures, add the new layouts.
5. **Exterior and parking:** building and plaza alignment, park polish, curb parking with intersection and lane clearance tests built on `campusRoadNetwork`.

Optional later phase: cutaway roofs (see Ceiling).

## Verification

- `pnpm build` and `pnpm test` per phase; register every new `*.test.ts` in the package `test` script.
- Tests must fail when the change is reverted (for example the variant, clearance and parking-bay rules).
- Visual check per phase on a freshly created office in both 3D and 2D: one screenshot per room type, plus a driving check that cars are parked off the lanes and the loop road is still passable. This needs the Compose stack and is not covered by unit tests; each phase report says which views were checked.
- Saved offices: confirm an existing office still loads with its saved props and walls unchanged (floors may restyle, see Scope).

## Routing

Plan by Claude. Implementation is Codex per `AGENTS.md`, one run per phase. Claude reviews each diff. Phase 5 review checks road clearance, because blocking the loop would strand vehicles.

## Phase 2 as built

- **Colours:** each desk room (`team-N-office-M`) has its own hue (floor, wall and roof share it), so the boundary between neighbouring rooms is visible. Meeting and shared rooms keep one look per room type.
- **Layouts:** three arrangements chosen by room id, each optionally mirrored: A "work nook" (desk north-west, bed north-east, kitchen down the east wall), B "loft" (bed and desk in one column, kitchen on the north half of the east wall), C "host" (television lounge, bed, workstation, kitchen). All keep the entrance aisle empty and add a rug and a floor lamp.
- **Bed fix:** the old plan used a 3 x 3 m double bed beside the aisle and a single bed the test could not approach. Every studio now uses the single bed, placed so a walking point lies within seat-approach distance (1.4 m). The test that failed before (`starter furniture leaves an actual walkable route...`) now passes.
- **Not verified by eye:** the facing of the television cabinet and the sofa follow the chair convention (forward is local -Z), but no render has been checked. Look at one studio of each layout in 3D and 2D.

## Colour rule (later change)

A room has one base colour. Its walls and roof use it as is and its floor is the same colour lifted 45% toward white, so the room reads as one hue from above and from the side. Desk rooms step the hue by the golden angle per room and the lightness per team.

## Phases 3 and 4 as built (decor, cafeteria, lounge) and park planting

- **Decor props** (`campusRoomDecor.ts`): Town Hall gets plants, framed pictures and lamps down both side aisles plus benches by the door (22 props, the seating block untouched); fifty-seat meeting rooms get pictures, shelves and lamps (9 props); the Lobby gets pictures and corner plants. Wall items use only the catalog assets flagged `wallMounted`, because the office-props validator rejects any other elevated prop that has no supporting surface. Starter placements now honour `elevationM`.
- **Cafeteria** (`campusSharedRoomTemplates.ts`): serving counter, fridges and appliances along the north wall, six staggered dining groups either side of a clear aisle, benches, pictures, lamps and plants.
- **Lounge:** its own layout (two sofa groups on carpet tiles, bookcase wall, armchairs, lamps, pictures). It used to be furnished like the Lobby, reception desks included.
- **Rugs** are carpet floor tiles: the catalog's rug asset is a solid 2 x 1.3 m obstacle, which would block walking across it.
- **Park** (`campusParkGrove.ts`): staggered, jittered, species-clustered rows of trees fill the lawn bands (about 100 trees on a small map, 135 on a ten-team map, up from 18) with the existing overlap, road and room clearance rules. Everything is dropped when it would sit beyond the map edge, which also fixes small maps saving props outside the office boundary.
- Not yet done: restroom cleanup, finished-building alignment, curb parking and the vehicle redesign.
