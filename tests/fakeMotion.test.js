// @vitest-environment node
import { test, expect } from 'vitest';
import { fakeAg } from '../server/fakeMotion.mjs';
import { createMotionDetector } from '../src/input/motion.js';
import { createPhoneSource } from '../src/input/phoneSource.js';

test('fakeAg: gravity at rest, bounce while running, push on jump', () => {
  expect(fakeAg(0, { running: false, jumpAtMs: null })).toEqual([0, 9.81, 0]);
  const ys = Array.from({ length: 60 }, (_, i) => fakeAg(i * 1000 / 60, { running: true, jumpAtMs: null })[1]);
  expect(Math.max(...ys) - 9.81).toBeCloseTo(14, 0);
  expect(fakeAg(1050, { running: false, jumpAtMs: 1000 })[1]).toBeCloseTo(9.81 + 25);
  expect(fakeAg(1150, { running: false, jumpAtMs: 1000 })[1]).toBeCloseTo(9.81);
});

test('fake motion runs and jumps through the real pipeline', () => {
  const src = createPhoneSource({ detector: createMotionDetector() });
  for (const hand of ['L', 'R']) src.handleMessage({ t: 'hello', role: 'phone', hand, dev: 'stick' }, 0);
  const state = { running: true, jumpAtMs: 2000 };
  let steps = 0, jumps = 0, nextRead = 0;
  for (let t = 0; t < 4000; t += 1000 / 60) {
    for (const hand of ['L', 'R']) {
      src.handleMessage({ t: 'm', hand, dev: 'stick', ts: t, ag: fakeAg(t, state), a: null, r: [0, 0, 0] }, t + 15);
    }
    while (nextRead <= t) {
      const f = src.read(nextRead + 15);
      steps += f.steps; if (f.jump) jumps++;
      nextRead += 16;
    }
  }
  expect(steps).toBeGreaterThanOrEqual(6);
  expect(jumps).toBe(1);
});

test('fake running never reads as free fall, and 30 s of jittery ~32 Hz running fires no jump', async () => {
  const { default: config } = await import('../src/config.js');
  for (let t = 0; t < 2000; t += 5) expect(Math.hypot(...fakeAg(t, { running: true, jumpAtMs: null }))).toBeGreaterThan(config.motion.freefallThreshold + 2);
  const src = createPhoneSource({ detector: createMotionDetector() });
  let jumps = 0, steps = 0;
  const gaps = [15, 16, 31, 31, 32, 31, 16, 45]; // Windows timer granularity
  for (let t = 0, k = 0; t < 30000; t += gaps[k++ % gaps.length]) {
    for (const hand of ['L', 'R']) src.handleMessage({ t: 'm', hand, dev: 'stick', ts: t, ag: fakeAg(t, { running: t > 1000, jumpAtMs: null }), a: null, r: [0, 0, 0] }, t + 10);
    const f = src.read(t + 10); jumps += f.jump ? 1 : 0; steps += f.steps;
  }
  expect(jumps).toBe(0);
  expect(steps).toBeGreaterThan(60);
});
