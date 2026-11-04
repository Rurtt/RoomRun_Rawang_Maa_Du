import { test, expect } from 'vitest';
import { createMotionDetector } from '../src/input/motion.js';
import { createPhoneSource } from '../src/input/phoneSource.js';

const DT = 1000 / 60;
/** Phone sample in the phone's own clock (`ts`), received at game time `recv`. */
const m = (hand, ts, v) => ({ t: 'm', hand, ts, a: [0, v, 0], ag: [0, v + 9.8, 0], r: [0, 0, 0] });

/** Opposite-phase 2.5 Hz arm swing from both phones; phone clocks are far off the game clock. */
function swing(src, from, ms, clock = { L: 5e6, R: -3e4 }) {
  for (let t = from; t < from + ms; t += DT) {
    const s = 10 * Math.sin(2 * Math.PI * 2.5 * (t / 1000));
    src.handleMessage(m('L', t + clock.L, s), t + 30); // ~30 ms network delay
    src.handleMessage(m('R', t + clock.R, -s), t + 30);
    src.read(t + 30);
  }
}

test('phone source runs from motion messages despite phone clocks far from the game clock', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  swing(src, 0, 3000);
  expect(src.connected(3030)).toBe(true);
  expect(src.read(3030).speed).toBeGreaterThan(0.9);
});

test('phone source: no samples for 1.2 s -> connected false, speed falls toward 0', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  swing(src, 0, 3000);
  const before = src.read(3030).speed;
  let after = before;
  for (let t = 3030; t <= 4230; t += DT) after = src.read(t).speed;
  expect(src.connected(4230)).toBe(false);
  expect(after).toBeLessThan(before * 0.5);
  for (let t = 4230; t <= 6000; t += DT) after = src.read(t).speed;
  expect(after).toBeLessThan(0.02);
});

test('never connected is not "lost"; connected then silent is', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  expect(src.connected(0)).toBe(false);
  expect(src.everConnected).toBe(false);
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'L' }, 0);
  src.handleMessage(m('L', 0, 0), 10);
  expect(src.everConnected).toBe(true);
});

test('rtt messages fill rtt per hand; junk is ignored', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  expect(src.rtt).toEqual({ L: null, R: null });
  src.handleMessage({ t: 'rtt', hand: 'R', ms: 48 }, 0);
  src.handleMessage({ t: 'rtt', hand: 'X', ms: 1 }, 0);
  src.handleMessage({ t: 'm', hand: 'L', ts: 1, a: null }, 0); // phone without linear acceleration
  src.handleMessage(null, 0);
  expect(src.rtt).toEqual({ L: null, R: 48 });
});

/** Swing with explicit phone clocks per hand, from game time `from` for `ms`. */
function swingWith(src, from, ms, clockOf) {
  for (let t = from; t < from + ms; t += DT) {
    const s = 10 * Math.sin(2 * Math.PI * 2.5 * (t / 1000));
    src.handleMessage(m('L', t + clockOf('L', t), s), t + 30);
    src.handleMessage(m('R', t + clockOf('R', t), -s), t + 30);
    src.read(t + 30);
  }
}

test('phone page reload (clock restarts, hello re-sent) keeps running working', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  swingWith(src, 0, 3000, () => 1e6);
  // the reloaded page's performance.now() starts near 0 again
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'L' }, 3030);
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'R' }, 3030);
  swingWith(src, 3000, 3000, () => -3000);
  expect(src.read(6030).speed).toBeGreaterThan(0.9);
});

test('phone clock stalls during a screen lock (no reconnect) -> re-baselines, running works again', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  swingWith(src, 0, 3000, () => 1e6);
  // after the lock, samples carry timestamps 5 s behind where they used to be
  swingWith(src, 3000, 3000, () => 1e6 - 5000);
  expect(src.read(6030).speed).toBeGreaterThan(0.9);
});

test('one phone of two goes silent -> not connected (HUD shows the drop)', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  swingWith(src, 0, 2000, () => 0);
  for (let t = 2000; t < 3300; t += DT) src.handleMessage(m('L', t, 0), t + 30);
  expect(src.connected(3300)).toBe(false);
});

test('a sample with an absurd timestamp cannot wreck the clock', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  swingWith(src, 0, 1500, () => 0);
  src.handleMessage(m('L', 1e15, 0), 1530);
  src.handleMessage(m('R', Number.NaN, 0), 1530);
  swingWith(src, 1500, 1500, () => 0);
  expect(src.read(3030).speed).toBeGreaterThan(0.9);
});

test('tap on the left phone = lane left, right phone = lane right, once each', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage({ t: 'tap', hand: 'L', ts: 1 }, 100);
  expect(src.read(100).laneDelta).toBe(-1);
  expect(src.read(116).laneDelta).toBe(0);
  src.handleMessage({ t: 'tap', hand: 'R', ts: 2 }, 200);
  expect(src.read(200).laneDelta).toBe(1);
  src.handleMessage({ t: 'tap', hand: 'X', ts: 3 }, 300);
  expect(src.read(300).laneDelta).toBe(0);
});

/** Detector stand-in that records pushed samples (the real one is tested in motion.test.js). */
const recorder = () => {
  const pushed = [];
  return { pushed, push: (s) => pushed.push(s), read: () => ({ speed: 0, jump: false, laneDelta: 0, steps: 0 }) };
};
const sm = (hand, ts, dev) => ({ t: 'm', hand, dev, ts, a: null, ag: [0, 9.81, 0], r: [0, 0, 0] });

test('big button = lane', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage({ t: 'btn', hand: 'L', dev: 'stick', b: 'big', ts: 1 }, 100);
  expect(src.read(100).laneDelta).toBe(-1);
  src.handleMessage({ t: 'btn', hand: 'R', dev: 'stick', b: 'big', ts: 2 }, 200);
  expect(src.read(200).laneDelta).toBe(1);
  expect(src.read(216).laneDelta).toBe(0);
});

test('small button = start action once', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  expect(src.takeAction()).toBe(null);
  src.handleMessage({ t: 'btn', hand: 'R', dev: 'stick', b: 'small', ts: 1 }, 100);
  expect(src.read(100).laneDelta).toBe(0);
  expect(src.takeAction()).toBe('start');
  expect(src.takeAction()).toBe(null);
});

test('stick wins, phone takes over', () => {
  const det = recorder();
  const src = createPhoneSource({ detector: det });
  for (let t = 0; t < 500; t += DT) {
    src.handleMessage(sm('L', t, 'stick'), t + 20);
    src.handleMessage(sm('L', t + 7e5, 'phone'), t + 20);
  }
  expect(det.pushed.length).toBeGreaterThan(20);
  expect(det.pushed.every((s) => s.dev === 'stick')).toBe(true);
  // stick goes quiet; phone keeps sending
  const n = det.pushed.length;
  for (let t = 500; t < 1600; t += DT) src.handleMessage(sm('L', t + 7e5, 'phone'), t + 20);
  const after = det.pushed.slice(n);
  expect(after.length).toBeGreaterThan(0);
  expect(after.every((s) => s.dev === 'phone')).toBe(true);
  // the first phone sample used is past disconnectAfterMs since the last stick sample
  const lastStickRecv = Math.max(...[...Array(30).keys()].map((k) => k * DT).filter((t) => t < 500)) + 20;
  expect(after[0].ts).toBeGreaterThan(lastStickRecv + 1000 - 1);
});

test('hello after drop resets offset', () => {
  const det = recorder();
  const src = createPhoneSource({ detector: det });
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'L', dev: 'stick' }, 4990);
  src.handleMessage(sm('L', 1000, 'stick'), 5000);
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'L', dev: 'stick' }, 8990); // stick rebooted
  src.handleMessage(sm('L', 10, 'stick'), 9000);
  expect(det.pushed.at(-1).ts).toBeCloseTo(9000, 0);
});

test('status reports battery and device', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'L', dev: 'stick' }, 0);
  src.handleMessage(sm('L', 5, 'stick'), 10);
  src.handleMessage({ t: 'bat', hand: 'L', dev: 'stick', v: 3.92, pct: 71 }, 20);
  expect(src.status(30).L).toEqual({ dev: 'stick', connected: true, pct: 71 });
  expect(src.status(30).R).toEqual({ dev: null, connected: false, pct: null });
});

test('status shows a phone hand', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage(m('R', 5, 0), 10); // phones send no dev; relay tags them 'phone' but old relays did not
  expect(src.status(30).R).toEqual({ dev: 'phone', connected: true, pct: null });
});

test('sticksLost', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  expect(src.sticksLost(0)).toBe(false);
  src.handleMessage(sm('L', 0, 'stick'), 100);
  expect(src.sticksLost(500)).toBe(false);
  expect(src.sticksLost(1101)).toBe(true);
  src.handleMessage(sm('L', 1200, 'stick'), 1300);
  expect(src.sticksLost(1310)).toBe(false);
});

test('sticksLost is false while a backup phone feeds the hand', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage(sm('L', 0, 'stick'), 100);
  for (let t = 100; t < 1500; t += DT) src.handleMessage(sm('L', t, 'phone'), t);
  expect(src.sticksLost(1500)).toBe(false);
  expect(src.status(1500).L.dev).toBe('phone');
});

test('buzz without a socket is a no-op', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  expect(() => src.buzz('hit')).not.toThrow();
});

test('a stick that only said hello (no motion, e.g. MPU6050 missing) never pauses the game', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage({ t: 'hello', role: 'phone', hand: 'R', dev: 'stick' }, 0);
  src.handleMessage({ t: 'bat', hand: 'R', dev: 'stick', v: 3.9, pct: 70 }, 10);
  expect(src.sticksLost(5000)).toBe(false);
});

test('forgetSticks: keyboard restart after a dead stick is not stuck paused', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  src.handleMessage(sm('L', 0, 'stick'), 100);
  expect(src.sticksLost(3000)).toBe(true);
  src.forgetSticks();
  expect(src.sticksLost(3000)).toBe(false);
  src.handleMessage(sm('L', 3100, 'stick'), 3100); // stick comes back: tracked again
  expect(src.sticksLost(5000)).toBe(true);
});
