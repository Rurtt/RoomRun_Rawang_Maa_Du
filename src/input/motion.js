// Arm-swing motion -> InputFrame, from two hand-held phones now and the ESP32
// sticks later. Samples are linear acceleration a (gravity removed) and,
// when the device reports it, ag (gravity included), m/s^2, with timestamps
// already on the game clock.
//
// Hands twist hard while running (up to ~1400 deg/s), so no device axis stays
// "up" or "sideways" for long. Steps and jumps therefore use orientation-free
// magnitudes; only the legacy motion lanes still read device axes.
//
// Step (bounceSteps, default): the body bounces once per footstep and both
//   hands ride it, so a footstep is world-up rising past bounceStepThreshold
//   on either hand. Tilt-free, so the arms can swing and twist naturally.
//   Footsteps come slower than arm-swing peaks: motion.cadence has its own rates.
// Step (old, bounceSteps off): |a| rises past stepThreshold. A swing has two peaks per arm cycle
//   (front and back), so each hand counts every stepEvery-th peak: one step per
//   cycle per hand, like the legs. stepSign != 0 instead keeps only the peaks
//   where the vertical axis has that sign (old, tilt-sensitive).
// Jump: both hands push up past their bar within jumpWindowMs (the takeoff,
//   so it fires early). "Up" is the gravity direction, ag - a, so wrist tilt
//   does not matter. Running bounces the body (both hands together) once per
//   step, so the bar is jumpOverBounce x the recent bounce peak, never under
//   jumpThreshold. The landing thump falls in jumpCooldownMs. Backup: both
//   hands in free fall (|ag| under freefallThreshold) together for freefallMs.
// Lane (motionLanes only): both hands' lateral axis past swipeThreshold, same
//   sign, within swipeWindowMs. Off by default: lanes come from phone taps.
import config from '../config.js';
import { createCadence } from './cadence.js';

/**
 * @param {typeof config.motion} cfg read live on every sample
 * @param {ReturnType<typeof createCadence>} cadence shared by both hands
 */
export function createMotionDetector(cfg = config.motion, cadence = createCadence(cfg.cadence)) {
  const hand = () => ({ mag: 0, lat: 0, up: 0, upPeak: 0, bounce: 0, jumpBar: cfg.jumpThreshold, lastStep: -Infinity, peaks: 0, latSpike: null, upSpike: null, fallSince: null });
  const hands = { L: hand(), R: hand() };
  let gestureFreeAt = -Infinity;
  let stepsFreeAt = -Infinity;
  let lastBounceStep = -Infinity;
  /** @type {-1|0|1} */
  let laneDelta = 0;
  let jump = false;

  const crossed = (prev, now, threshold) => Math.abs(prev) < threshold && Math.abs(now) >= threshold;
  const pairs = (a, b, t, windowMs) => a && b && a.sign === b.sign && Math.abs(a.t - b.t) <= windowMs && t - a.t <= windowMs;

  function gesture(t, cooldownMs = cfg.gestureCooldownMs) {
    gestureFreeAt = t + cooldownMs;
    stepsFreeAt = t + cfg.suppressStepsAfterGestureMs;
    cadence.holdFor(cfg.gestureHoldMs, t);
    for (const h of Object.values(hands)) { h.latSpike = null; h.upSpike = null; h.fallSince = null; }
  }

  return {
    /** @param {{ hand: 'L'|'R', ts: number, a: number[]|null, ag?: number[]|null }} sample */
    push(sample) {
      const h = hands[sample.hand];
      const a = sample.a;
      if (!h || !a || a.some((x) => typeof x !== 'number')) return;
      const t = sample.ts;
      const other = hands[sample.hand === 'L' ? 'R' : 'L'];
      const v = a[cfg.axes.vertical];
      const lat = a[cfg.axes.lateral] * (cfg.lateralSign[sample.hand] ?? 1);
      const mag = Math.hypot(a[0], a[1], a[2]);
      const agv = sample.ag?.every((x) => typeof x === 'number') ? sample.ag : null;
      const ag = agv ? Math.hypot(...agv) : null;
      // world-up part of a: project onto gravity (ag - a); skipped in free fall, where gravity reads ~0
      const g = agv?.map((x, i) => x - a[i]);
      const gn = g ? Math.hypot(...g) : 0;
      const up = gn > 3 ? (a[0] * g[0] + a[1] * g[1] + a[2] * g[2]) / gn : 0;
      h.upPeak = Math.max(up, h.upPeak * 0.98); // debug readout: recent biggest push
      // each rise is judged against the bounce envelope from before it started, so a jump can't raise its own bar
      if (h.up <= 0 && up > 0) h.jumpBar = Math.max(cfg.jumpThreshold, cfg.jumpOverBounce * h.bounce);

      if (ag != null) h.fallSince = ag < cfg.freefallThreshold ? (h.fallSince ?? t) : null;
      if (t < gestureFreeAt) {
        h.bounce *= cfg.bounceDecay; // landing thumps (in the cooldown) stay out
      } else {
        // capped, so a jump's own push can't lift the bar for the next jump
        h.bounce = Math.max(Math.min(up, cfg.bounceCap), h.bounce * cfg.bounceDecay);
        if (cfg.motionLanes && crossed(h.lat, lat, cfg.swipeThreshold)) h.latSpike = { t, sign: Math.sign(lat) };
        if (h.up < h.jumpBar && up >= h.jumpBar) h.upSpike = { t, sign: 1 };
        if (pairs(h.upSpike, other.upSpike, t, cfg.jumpWindowMs)
            || (h.fallSince != null && other.fallSince != null && t - Math.max(h.fallSince, other.fallSince) >= cfg.freefallMs)) {
          jump = true;
          gesture(t, cfg.jumpCooldownMs);
        } else if (cfg.motionLanes && pairs(h.latSpike, other.latSpike, t, cfg.swipeWindowMs)) {
          laneDelta = /** @type {-1|1} */ (h.latSpike.sign);
          gesture(t);
        }
      }

      if (cfg.bounceSteps) {
        // both hands ride the same bounce: the first to rise counts the footstep, the other is inside the refractory
        if (t >= stepsFreeAt && h.up < cfg.bounceStepThreshold && up >= cfg.bounceStepThreshold
            && t - lastBounceStep >= cfg.bounceStepRefractoryMs) {
          lastBounceStep = t;
          cadence.addStep(t);
        }
      } else if (t >= stepsFreeAt && crossed(h.mag, mag, cfg.stepThreshold) && t - h.lastStep >= cfg.stepRefractoryMs
          && (cfg.stepSign === 0 || Math.sign(v) === cfg.stepSign)) {
        h.lastStep = t;
        if (++h.peaks % (cfg.stepSign === 0 ? cfg.stepEvery : 1) === 0) cadence.addStep(t);
      }
      h.mag = mag; h.lat = lat; h.up = up;
    },

    /** Debug readout: each hand's recent biggest upward push, m/s^2. */
    upPeaks() { return { L: hands.L.upPeak, R: hands.R.upPeak }; },

    /** @returns {import('./hub.js').InputFrame} lane and jump fire once */
    read(nowMs) {
      const frame = { speed: cadence.speed(nowMs), laneDelta, jump, steps: cadence.takeSteps() };
      laneDelta = 0;
      jump = false;
      return frame;
    },
  };
}
