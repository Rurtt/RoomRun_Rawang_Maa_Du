// Soi people reactions as plain maths: where a head looks and how hard a startle
// pulls. people.js turns the numbers into bone rotations. No Three.js here.

/** Starting values from the design; tune live. Distances in m, times in s, angles in rad. */
export const PEOPLE = { turnRange: 10, startleRange: 12, startleTime: 1.0, maxYaw: 1.22 };

/**
 * Yaw to add to a person's head so it looks at the kid.
 * @param {number} px person x
 * @param {number} pz person z
 * @param {number} facing Three.js rotation.y of the person (model front +Z)
 * @param {number} kx kid x
 * @param {number} kz kid z
 * @param {number} [maxYaw]
 * @returns {number} 0 out of range; clamped to ±maxYaw. Behind the person it holds the clamp
 *   on the side the kid is on, so a kid running past never flips the head across.
 */
export function headYaw(px, pz, facing, kx, kz, maxYaw = PEOPLE.maxYaw) {
  const dx = kx - px, dz = kz - pz;
  if (dx * dx + dz * dz > PEOPLE.turnRange * PEOPLE.turnRange) return 0;
  return lookYaw(px, pz, facing, kx, kz, maxYaw);
}

/** headYaw at any distance (the startle snaps to the kid wherever it is). */
export function lookYaw(px, pz, facing, kx, kz, maxYaw = PEOPLE.maxYaw) {
  let a = Math.atan2(kx - px, kz - pz) - facing;
  a = Math.atan2(Math.sin(a), Math.cos(a)); // wrap to [-pi, pi]: the sign is the side the kid is on
  return Math.max(-maxYaw, Math.min(maxYaw, a));
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Startle envelope: snaps up in ~0.12 s, holds, eases back to 0 at `dur`.
 * @param {number} t seconds since the trigger (a retrigger sets it back to 0)
 * @param {number} [dur]
 * @returns {number} 0..1
 */
export function startleWeight(t, dur = PEOPLE.startleTime) {
  if (t < 0 || t >= dur) return 0;
  if (t < 0.12) return smooth(t / 0.12);
  const hold = dur * 0.45;
  return t < hold ? 1 : 1 - smooth((t - hold) / (dur - hold));
}

/**
 * Exponential approach of `cur` toward `target`; never overshoots.
 * @param {number} cur
 * @param {number} target
 * @param {number} rate per second
 * @param {number} dt seconds
 */
export function ease(cur, target, rate, dt) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}
