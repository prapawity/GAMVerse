# Platform feature toggles

## Goal
Allow a maintainer to switch Map editing and Prop editing on or off for every office and every connected user. Controls stay visible and become disabled when their feature is off.

## Phase 1: Durable state and maintainer controls
- Store the two platform-wide switches in PostgreSQL with safe defaults enabled.
- Add authenticated read and maintainer-only update endpoints; record changes in maintainer audit.
- Add controls to the existing maintainer platform panel with saving/error feedback.

## Phase 2: Realtime propagation and enforcement
- Broadcast every accepted update to all active Colyseus office rooms and send current state to joining clients.
- Deliver current state to client UI and disable the existing map/prop buttons while preserving visibility.
- Enforce flags on server-side map edit locks/commands and persistence APIs so clients cannot bypass disabled controls.

## Acceptance
- Defaults preserve current behavior.
- Maintainer change is durable across restarts and is visible in all offices without reload.
- Ordinary users cannot change platform switches.
- Map edit and prop edit controls remain visible and disabled when switched off.
- Server rejects new edit actions/saves while disabled, including already-open editors.
- Build passes; tests cover flag validation, authorization and enforcement boundaries.
