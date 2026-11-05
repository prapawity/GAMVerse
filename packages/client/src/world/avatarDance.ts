const FULL_TURN_RAD = 2 * Math.PI;
export const AVATAR_DANCE_DURATION_S = 8;
const SPIN_START_S = 4;
const FLIP_START_S = 6;
const FLIP_END_S = 7.2;

function progress(timeS: number, startS: number, endS: number): number {
  return Math.max(0, Math.min(1, (timeS - startS) / (endS - startS)));
}

/** Two grooves lead into a low turn and a jumping backflip. */
export function sampleAvatarDance(elapsedS: number, halfHeightM: number) {
  const timeS = elapsedS % AVATAR_DANCE_DURATION_S;
  const beat = timeS * 2 * FULL_TURN_RAD;
  const spin = progress(timeS, SPIN_START_S, FLIP_START_S);
  const flip = progress(timeS, FLIP_START_S, FLIP_END_S);
  const groove = timeS < SPIN_START_S ? Math.sin(Math.PI * timeS / SPIN_START_S) : 0;
  const hipHop = timeS < 2;
  const pitchRad = -FULL_TURN_RAD * flip;
  const rollRad = groove * Math.sin(beat / 2) * (hipHop ? 0.16 : 0.24) + Math.sin(Math.PI * spin) * 0.32;
  const air = 4 * flip * (1 - flip);
  return {
    liftM: groove * (1 - Math.cos(beat)) * 0.04 + air * (halfHeightM * 0.55 + 0.28),
    yawRad: FULL_TURN_RAD * (spin * spin * (3 - 2 * spin)) + groove * Math.sin(beat / 2) * 0.25,
    pitchRad,
    rollRad,
    armSweepRad: Math.sin(beat / 2) * groove * (hipHop ? 0.7 : 1.05),
    legSweepRad: Math.sin(beat) * groove * 0.32,
    tuckRad: 0.95 * air + 0.55 * Math.sin(Math.PI * spin),
  };
}
