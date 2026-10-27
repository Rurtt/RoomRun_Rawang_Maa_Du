// Step times -> speed 0..1. Shared by every input source that counts steps
// (keyboard A/D taps, phone arm-swing peaks, later the ESP32 sticks), so all
// of them feel the same.
import config from '../config.js';

/**
 * @param {typeof config.cadence} cfg read live on every call
 */
export function createCadence(cfg = config.cadence) {
  /** @type {number[]} */
  let steps = [];
  let pending = 0;
  let out = 0;
  /** @type {number|null} time of the previous speed() call; null until running starts */
  let lastRead = null;
  let holdUntil = -Infinity;
  let heldSpeed = 0;

  function rateTarget(nowMs) {
    steps = steps.filter((t) => nowMs - t <= cfg.windowMs);
    if (steps.length < 2) return 0;
    const span = (steps[steps.length - 1] - steps[0]) / 1000;
    if (span <= 0) return 0;
    const rate = (steps.length - 1) / span;
    return Math.min(1, Math.max(0, (rate - cfg.minRate) / (cfg.fullRate - cfg.minRate)));
  }

  return {
    addStep(nowMs) {
      if (lastRead === null) lastRead = nowMs;
      steps.push(nowMs);
      pending++;
    },
    /** Keep the current speed for ms (a swipe or jump briefly breaks the arm rhythm). */
    holdFor(ms, nowMs) {
      holdUntil = Math.max(holdUntil, nowMs + ms);
      heldSpeed = Math.max(heldSpeed, out);
    },
    speed(nowMs) {
      if (lastRead === null) return out;
      const holding = nowMs <= holdUntil;
      if (!holding) heldSpeed = 0;
      const last = steps.length ? steps[steps.length - 1] : -Infinity;
      let target = nowMs - last > cfg.stopAfterMs && !holding ? 0 : rateTarget(nowMs);
      if (holding) target = Math.max(target, heldSpeed);
      const dt = Math.max(0, (nowMs - lastRead) / 1000);
      lastRead = nowMs;
      out += (target - out) * (1 - Math.exp(-dt / cfg.smoothTau));
      return out;
    },
    takeSteps() {
      const n = pending;
      pending = 0;
      return n;
    },
    reset() {
      steps = [];
      pending = 0;
      out = 0;
      lastRead = null;
      holdUntil = -Infinity;
      heldSpeed = 0;
    },
  };
}
