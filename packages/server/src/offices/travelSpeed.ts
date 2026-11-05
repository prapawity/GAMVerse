const WALK_SPEED_MULTIPLIER = 1.5;
const DRIVE_SPEED_MULTIPLIER = 5;
export const MOVEMENT_INPUT_TIMEOUT_MS = 150;

export function travelSpeedMps(baseSpeedMps: number, driving: boolean, sprinting: boolean, autoDriveSpeedMps?: number): number {
  if (driving && autoDriveSpeedMps !== undefined) return autoDriveSpeedMps;
  return baseSpeedMps * (driving ? DRIVE_SPEED_MULTIPLIER : WALK_SPEED_MULTIPLIER) * (sprinting ? 2 : 1);
}
