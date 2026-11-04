import { test, expect } from 'vitest';
import { buzzForEvent } from '../src/input/haptics.js';

test('game events map to stick buzz patterns', () => {
  expect(buzzForEvent('hit')).toBe('hit');
  expect(buzzForEvent('caught')).toBe('caught');
  expect(buzzForEvent('chase-warning')).toBe('pack');
  expect(buzzForEvent('jump')).toBe('jump');
  for (const e of ['hit-cart', 'coin', 'lane', 'land', 'run-start', 'chase-start', '']) expect(buzzForEvent(e)).toBe(null);
});
