// Game events -> stick buzz patterns. The firmware owns the on/off timings.
const MAP = { hit: 'hit', caught: 'caught', 'chase-warning': 'pack', jump: 'jump' };

/** @returns {'hit'|'caught'|'pack'|'jump'|null} */
export function buzzForEvent(e) {
  return Object.hasOwn(MAP, e) ? MAP[e] : null;
}
