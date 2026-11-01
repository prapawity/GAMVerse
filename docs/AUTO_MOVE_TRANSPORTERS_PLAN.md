# Auto-move transporter vehicles

## Goal

Make every vehicle offered in the Map Editor's **Transporter** section usable by random auto-move, including the 17 newly imported Kenney Car Kit vehicles, while keeping existing vehicles and manually driven parked vehicles working.

## Phase 1: Register all transporters

- Give each imported vehicle a stable `vehicleId` matching its catalog asset ID.
- Add those IDs to the shared vehicle ID list used by server validation and random auto-move selection.
- Keep non-vehicle Car Kit items out of the vehicle pool.

## Phase 2: Resolve vehicle visuals and names

- Load vehicle models from their catalog `modelUrl` when the ID is a catalog transporter.
- Preserve existing model paths and orientation for the original vehicle IDs.
- Show readable names for new models in auto-move status.

## Verification

- `corepack pnpm build` must pass.
- Confirm the list of catalog transporters matches the random auto-move ID list by source inspection.
- Browser driving checks are outside this implementation pass.
