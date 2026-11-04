// Synthetic stick motion (no hardware): gravity on y, a 2.5 Hz world-up bounce
// while running (one short upward pulse per footstep; never below 1 g, a sine
// would dip through 0 g and fire the free-fall backup jump), and a short upward push for a jump.
// Same shape as a real stick's `ag` (m/s^2 incl. gravity). The firmware's
// FAKE_MOTION mode makes the same running wave.
export const G = 9.81;
const BOUNCE = 14; // running bounce peak, m/s^2 (phone logs: 6-29)
const STEP_HZ = 2.5;
const PUSH = 25; // jump push, m/s^2 (phone logs: real jumps 19-48)
const PUSH_MS = 100;

/**
 * @param {number} tMs
 * @param {{ running: boolean, jumpAtMs: number|null }} state
 * @returns {[number, number, number]}
 */
export function fakeAg(tMs, { running, jumpAtMs }) {
  let y = G;
  if (running) y += BOUNCE * Math.max(0, Math.sin(2 * Math.PI * STEP_HZ * (tMs / 1000))) ** 2;
  if (jumpAtMs != null && tMs >= jumpAtMs && tMs < jumpAtMs + PUSH_MS) y += PUSH;
  return [0, y, 0];
}
