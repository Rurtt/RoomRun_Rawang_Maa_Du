// Pure text/number helpers for the HUD (unit-tested, no DOM).
import config from '../config.js';
import strings from '../strings.js';

/** 1240.7 -> '1,240 ม.' */
export function formatMeters(m) {
  return strings.meters(Math.max(0, Math.floor(m)).toLocaleString('en-US'));
}

/** Danger meter fill 0..1: empty when the boss dog is meterRange or more behind, full when caught. */
export function meterFill(gap, cfg = config.chaser) {
  return Math.min(1, Math.max(0, 1 - gap / cfg.meterRange));
}

/** Countdown digits for the chase event: 29.99 s left shows 30, the last second shows 1. */
export function chaseSeconds(secondsLeft) {
  return Math.ceil(Math.max(0, secondsLeft));
}

/**
 * One hand's line on the title connect panel.
 * @param {'L'|'R'} hand
 * @param {{ dev: 'stick'|'phone'|null, connected: boolean, pct: number|null }} s
 */
export function stickLine(hand, s) {
  if (!s?.connected || !s.dev) return `${hand} ${strings.sticks.waiting}`;
  if (s.dev === 'phone') return `${hand} ${strings.sticks.phone}`;
  return s.pct == null ? `${hand} ${strings.sticks.ready}` : `${hand} ${strings.sticks.ready} ${Math.round(s.pct)}%`;
}
