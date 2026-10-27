// Arm-swing motion -> InputFrame, from two hand-held phones now and the ESP32
// sticks later. Samples are linear acceleration (gravity removed), m/s^2, with
// timestamps already on the game clock.
//
// Step: |a| rises past stepThreshold while the vertical axis has stepSign.
//   An arm swing has two acceleration peaks per cycle (front and back); the
//   sign picks one, so each hand gives one step per cycle, like the legs.
// Jump: both hands' vertical axis past jumpThreshold, same sign, within jumpWindowMs.
// Lane: both hands' lateral axis past swipeThreshold, same sign, within
//   swipeWindowMs. Running swings the hands in opposite directions, so it never
//   matches. The first spike is the direction; the stop spike falls in the cooldown.
import config from '../config.js';
import { createCadence } from './cadence.js';

/**
 * @param {typeof config.motion} cfg read live on every sample
 * @param {ReturnType<typeof createCadence>} cadence shared by both hands
 */
export function createMotionDetector(cfg = config.motion, cadence = createCadence()) {
  const hand = () => ({ mag: 0, v: 0, lat: 0, lastStep: -Infinity, vSpike: null, latSpike: null });
  const hands = { L: hand(), R: hand() };
  let gestureFreeAt = -Infinity;
  let stepsFreeAt = -Infinity;
  /** @type {-1|0|1} */
  let laneDelta = 0;
  let jump = false;

  const crossed = (prev, now, threshold) => Math.abs(prev) < threshold && Math.abs(now) >= threshold;
  const pairs = (a, b, t, windowMs) => a && b && a.sign === b.sign && Math.abs(a.t - b.t) <= windowMs && t - a.t <= windowMs;

  function gesture(t) {
    gestureFreeAt = t + cfg.gestureCooldownMs;
    stepsFreeAt = t + cfg.suppressStepsAfterGestureMs;
    cadence.holdFor(cfg.gestureHoldMs, t);
    for (const h of Object.values(hands)) { h.vSpike = null; h.latSpike = null; }
  }

  return {
    /** @param {{ hand: 'L'|'R', ts: number, a: number[]|null }} sample */
    push(sample) {
      const h = hands[sample.hand];
      const a = sample.a;
      if (!h || !a || a.some((x) => typeof x !== 'number')) return;
      const t = sample.ts;
      const other = hands[sample.hand === 'L' ? 'R' : 'L'];
      const v = a[cfg.axes.vertical];
      const lat = a[cfg.axes.lateral] * (cfg.lateralSign[sample.hand] ?? 1);
      const mag = Math.hypot(a[0], a[1], a[2]);

      if (t >= gestureFreeAt) {
        if (crossed(h.v, v, cfg.jumpThreshold)) h.vSpike = { t, sign: Math.sign(v) };
        if (crossed(h.lat, lat, cfg.swipeThreshold)) h.latSpike = { t, sign: Math.sign(lat) };
        if (pairs(h.vSpike, other.vSpike, t, cfg.jumpWindowMs)) {
          jump = true;
          gesture(t);
        } else if (pairs(h.latSpike, other.latSpike, t, cfg.swipeWindowMs)) {
          laneDelta = /** @type {-1|1} */ (h.latSpike.sign);
          gesture(t);
        }
      }

      if (t >= stepsFreeAt && crossed(h.mag, mag, cfg.stepThreshold) && Math.sign(v) === cfg.stepSign
          && t - h.lastStep >= cfg.stepRefractoryMs) {
        h.lastStep = t;
        cadence.addStep(t);
      }
      h.mag = mag; h.v = v; h.lat = lat;
    },

    /** @returns {import('./hub.js').InputFrame} lane and jump fire once */
    read(nowMs) {
      const frame = { speed: cadence.speed(nowMs), laneDelta, jump, steps: cadence.takeSteps() };
      laneDelta = 0;
      jump = false;
      return frame;
    },
  };
}
