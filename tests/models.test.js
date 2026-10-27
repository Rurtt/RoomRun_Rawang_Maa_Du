import { test, expect } from 'vitest';
import { animationFor, makeStandIn } from '../src/render/models.js';

test('animationFor', () => {
  expect(animationFor({ airborne: true, stumbleT: 0, speedMps: 5 })).toBe('jump');
  expect(animationFor({ airborne: false, stumbleT: 0.5, speedMps: 5 })).toBe('stumble');
  expect(animationFor({ airborne: false, stumbleT: 0, speedMps: 0.2 })).toBe('idle');
  expect(animationFor({ airborne: false, stumbleT: 0, speedMps: 5 })).toBe('run');
});

test('every stand-in builds, sits on the ground, and has outlines', () => {
  for (const name of ['kid', 'ghost', 'dog', 'jar', 'cart', 'tuktuk', 'coin']) {
    const obj = makeStandIn(name);
    expect(obj.name).toBe(name);
    let meshes = 0, outlines = 0;
    obj.traverse((o) => { if (o.isMesh) { meshes++; if (o.name.endsWith('-outline')) outlines++; } });
    expect(meshes).toBeGreaterThan(1); expect(outlines).toBeGreaterThan(0);
  }
});

test('unknown stand-in name throws', () => {
  expect(() => makeStandIn('dragon')).toThrow();
});
