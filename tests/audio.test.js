import { test, expect } from 'vitest';
import { soundForEvent, SOUND_NAMES, FILES } from '../src/audio/audio.js';
import { SYNTH } from '../src/audio/synth.js';

test('soundForEvent maps world events to sounds', () => {
  expect(soundForEvent('coin')).toBe('coin'); expect(soundForEvent('jump')).toBe('jump');
  expect(soundForEvent('land')).toBe('land'); expect(soundForEvent('hit')).toBe('hit');
  expect(soundForEvent('chase-warning')).toBe('alarm'); expect(soundForEvent('chase-survived')).toBe('escape');
  expect(soundForEvent('caught')).toBe('caught'); expect(soundForEvent('lane')).toBeNull();
  expect(soundForEvent('ghost-near')).toBe('ghost'); expect(soundForEvent('nonsense')).toBeNull();
});

test('every sound has a synth fallback, so the game never goes silent', () => {
  for (const name of SOUND_NAMES) expect(typeof SYNTH[name]).toBe('function');
});

test('every sound but the synth siren, and both music tracks, have files', () => {
  for (const name of [...SOUND_NAMES.filter((n) => n !== 'alarm'), 'music', 'music_chase']) {
    expect(FILES[name]?.length).toBeGreaterThan(0);
  }
  expect(FILES.alarm).toBeUndefined();
  expect(FILES.step.length).toBe(4); // footstep variants so a run doesn't machine-gun one sample
});
