import { test, expect } from 'vitest';
import { parseVolume } from '../src/hud/volume.js';

test('parseVolume clamps saved values and falls back to 0.7', () => {
  expect(parseVolume(null)).toBe(0.7);
  expect(parseVolume('junk')).toBe(0.7);
  expect(parseVolume('0.3')).toBe(0.3);
  expect(parseVolume('0')).toBe(0);
  expect(parseVolume('5')).toBe(1);
  expect(parseVolume('-1')).toBe(0);
});
