// Where and how the boss dog (and its heel and pack dogs) are drawn. Pure math,
// unit-tested; actors.js does the Three.js side.
import config from '../config.js';

/**
 * Visible gap 0..visibleGap is drawn 0.9..2.2 m behind the kid so the dog stays
 * framed (the camera's lower edge meets the road ~2 m behind the kid; the dog is only 0.8 m tall).
 * @returns {number} metres behind the kid
 */
export function chaserBack(gap, cfg = config.chaser) {
  const k = Math.min(1, Math.max(0, gap / cfg.visibleGap));
  return 0.9 + k * 1.3;
}

/** The boss is on screen when it has caught the kid, is close, or is peeking after a hit. */
export function showChaser(world, peekT) {
  return world.phase === 'caught' || world.chaser.visible || peekT > 0;
}

/** @returns {'amber'|'red'} */
export function eyeColor(world) {
  return world.chaser.visible || world.chase.phase === 'active' ? 'red' : 'amber';
}
