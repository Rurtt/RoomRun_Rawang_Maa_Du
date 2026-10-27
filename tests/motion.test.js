import { test, expect } from 'vitest';
import { createMotionDetector } from '../src/input/motion.js';
import config from '../src/config.js';

const HZ = 60;
const DT = 1000 / HZ;
const V = 1; // config.motion.axes.vertical (y)
const LAT = 0; // config.motion.axes.lateral (x)

/**
 * Feed both hands at 60 Hz from t0 for `ms`, reading a frame each sample.
 * fn(hand, t) -> { v, lat } acceleration in m/s^2 (gravity removed).
 * Returns every frame read, with its time.
 */
function drive(det, t0, ms, fn) {
  const frames = [];
  for (let t = t0; t < t0 + ms; t += DT) {
    for (const hand of ['L', 'R']) {
      const { v = 0, lat = 0 } = fn(hand, t) ?? {};
      const a = [0, 0, 0];
      a[V] = v;
      a[LAT] = lat;
      det.push({ hand, ts: t, a });
    }
    frames.push({ t, ...det.read(t) });
  }
  return frames;
}

/** Opposite-phase arm swing: L and R vertical acceleration are mirror images. */
const run = (hz, amp = 10) => (hand, t) => {
  const s = amp * Math.sin(2 * Math.PI * hz * (t / 1000));
  return { v: hand === 'L' ? s : -s, lat: 0.5 * s };
};
/** A short spike on one axis between [from, from + len) ms. */
const spike = (from, len, value) => (t) => (t >= from && t < from + len ? value : 0);

const sum = (frames, f) => frames.reduce((n, x) => n + f(x), 0);

test('opposite-phase arm swing at 2.5 Hz per hand -> ~5 steps/s, full speed, no lane, no jump', () => {
  const det = createMotionDetector();
  const frames = drive(det, 0, 3000, run(2.5));
  const steps = sum(frames, (f) => f.steps);
  expect(steps).toBeGreaterThanOrEqual(13);
  expect(steps).toBeLessThanOrEqual(16); // one step per hand per arm cycle, not one per swing end
  expect(frames.at(-1).speed).toBeGreaterThan(0.95);
  expect(frames.some((f) => f.laneDelta !== 0)).toBe(false);
  expect(frames.some((f) => f.jump)).toBe(false);
});

test('slow arm swing gives a slower speed than a fast one', () => {
  const slow = drive(createMotionDetector(), 0, 3000, run(1)).at(-1).speed;
  const fast = drive(createMotionDetector(), 0, 3000, run(2.5)).at(-1).speed;
  expect(slow).toBeGreaterThan(0.1);
  expect(slow).toBeLessThan(fast - 0.3);
});

test('both hands spike up together -> one jump, no lane', () => {
  const det = createMotionDetector();
  const up = spike(100, 50, 20);
  const frames = drive(det, 0, 1000, (hand, t) => ({ v: up(t) }));
  expect(sum(frames, (f) => (f.jump ? 1 : 0))).toBe(1);
  expect(frames.some((f) => f.laneDelta !== 0)).toBe(false);
});

test('one hand spiking up alone is not a jump', () => {
  const det = createMotionDetector();
  const up = spike(100, 50, 20);
  const frames = drive(det, 0, 1000, (hand, t) => ({ v: hand === 'L' ? up(t) : 0 }));
  expect(frames.some((f) => f.jump)).toBe(false);
});

test('both hands spike left together -> laneDelta -1 once', () => {
  const det = createMotionDetector();
  // accelerate left, then the stop: a right-going spike 120 ms later must not count
  const go = spike(100, 50, -18), stop = spike(220, 50, 18);
  const frames = drive(det, 0, 1000, (hand, t) => ({ lat: go(t) + stop(t) }));
  expect(frames.filter((f) => f.laneDelta !== 0).map((f) => f.laneDelta)).toEqual([-1]);
  expect(frames.some((f) => f.jump)).toBe(false);
});

test('lateralSign flips one hand whose phone is held the other way round', () => {
  const det = createMotionDetector({ ...config.motion, lateralSign: { L: 1, R: -1 } });
  const go = spike(100, 50, 18);
  const frames = drive(det, 0, 1000, (hand, t) => ({ lat: hand === 'L' ? go(t) : -go(t) }));
  expect(frames.filter((f) => f.laneDelta !== 0).map((f) => f.laneDelta)).toEqual([1]);
});

test('hands spike sideways in opposite directions -> no lane', () => {
  const det = createMotionDetector();
  const go = spike(100, 50, 18);
  const frames = drive(det, 0, 1000, (hand, t) => ({ lat: hand === 'L' ? -go(t) : go(t) }));
  expect(frames.some((f) => f.laneDelta !== 0)).toBe(false);
});

test('second swipe within cooldown ignored', () => {
  const det = createMotionDetector();
  const a = spike(100, 50, -18), b = spike(300, 50, -18), c = spike(800, 50, -18);
  const frames = drive(det, 0, 1200, (hand, t) => ({ lat: a(t) + b(t) + c(t) }));
  // 300 ms is inside the 350 ms cooldown; 800 ms is a fresh swipe
  expect(frames.filter((f) => f.laneDelta !== 0).map((f) => f.t > 700)).toEqual([false, true]);
});

test('speed holds through a swipe', () => {
  const det = createMotionDetector();
  drive(det, 0, 3000, run(2.5));
  const before = det.read(3000).speed;
  const go = spike(3000, 50, -18);
  // the swipe replaces the swing for a moment: no running signal at all
  const frames = drive(det, 3000, 300, (hand, t) => ({ lat: go(t) }));
  expect(frames.some((f) => f.laneDelta === -1)).toBe(true);
  expect(Math.abs(frames.at(-1).speed - before)).toBeLessThan(0.05);
});

test('steps right after a gesture are ignored (the swipe stop is not a step)', () => {
  const det = createMotionDetector();
  const go = spike(100, 50, -18), stop = spike(220, 50, 18);
  // vertical wobble during the swipe that would read as steps
  const wobble = spike(300, 30, 9); // after the stop spike, still inside suppressStepsAfterGestureMs
  const frames = drive(det, 0, 600, (hand, t) => ({ lat: go(t) + stop(t), v: wobble(t) }));
  const after = frames.filter((f) => f.t >= 150);
  expect(sum(after, (f) => f.steps)).toBe(0);
});

test('hold keeps speed when the swing already broke before the swipe (wind-up)', () => {
  const det = createMotionDetector();
  drive(det, 0, 2800, run(2.5));
  const before = det.read(2800).speed;
  // 400 ms of still hands winding up, then the swipe; read 400 ms after it,
  // past the cadence's own 700 ms stop-grace but inside the 600 ms gesture hold
  const go = spike(3200, 50, -18);
  const frames = drive(det, 2800, 800, (hand, t) => ({ lat: go(t) }));
  expect(frames.some((f) => f.laneDelta === -1)).toBe(true);
  expect(frames.at(-1).speed).toBeGreaterThan(before - 0.05);
});
