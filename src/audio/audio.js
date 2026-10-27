// Sound: CC0 files from public/audio (see CREDITS.md), synth fallback for any
// file that fails to load. The AudioContext is made on the first key press
// (browser autoplay rule); files are fetched right away so they're ready.
import config from '../config.js';
import { SYNTH, createGhostLoop } from './synth.js';

/** @typedef {'step'|'coin'|'jump'|'land'|'hit'|'ghost'|'alarm'|'caught'|'escape'} SoundName */

/** @type {SoundName[]} */
export const SOUND_NAMES = ['step', 'coin', 'jump', 'land', 'hit', 'ghost', 'alarm', 'caught', 'escape'];

/** Files per sound (variants picked at random). 'alarm' has none: synth siren. */
export const FILES = {
  step: ['step', 'step2', 'step3', 'step4'],
  coin: ['coin'], jump: ['jump'], land: ['land'], hit: ['hit'], ghost: ['ghost'],
  caught: ['caught'], escape: ['escape'],
  music: ['music'], music_chase: ['music_chase'],
};

const EVENT_SOUND = {
  coin: 'coin', jump: 'jump', land: 'land', hit: 'hit', 'ghost-near': 'ghost',
  'chase-warning': 'alarm', 'chase-survived': 'escape', caught: 'caught',
};

/** @param {string} event @returns {SoundName|null} */
export function soundForEvent(event) {
  return EVENT_SOUND[event] ?? null;
}

const VOLUME = { step: 0.5, coin: 0.45, jump: 0.5, land: 0.45, hit: 0.8, ghost: 0.6, alarm: 1, caught: 0.7, escape: 0.7 };
const MUSIC_VOLUME = 0.32;
const CROSSFADE = 0.6; // seconds

export function createAudio(cfg = config) {
  /** @type {Record<string, Promise<ArrayBuffer|null>>} raw bytes, fetched before unlock */
  const raw = {};
  for (const list of Object.values(FILES)) {
    for (const file of list) {
      raw[file] = fetch(`${import.meta.env?.BASE_URL ?? '/'}audio/${file}.ogg`)
        .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('html') ? r.arrayBuffer() : null))
        .catch(() => null);
    }
  }

  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode} */ let sfx;
  /** @type {Record<string, AudioBuffer[]>} */
  const buffers = {};
  let ghostLoop = null;
  let musicGain = null, chaseGain = null;
  let chaseOn = false;
  let unlocking = null;

  async function decode(file) {
    const bytes = await raw[file];
    if (!bytes) return null;
    try { return await ctx.decodeAudioData(bytes.slice(0)); } catch { return null; }
  }

  async function startMusic() {
    const [a, b] = await Promise.all([decode('music'), decode('music_chase')]);
    if (!a) return; // no music file: play on without music
    musicGain = ctx.createGain();
    chaseGain = ctx.createGain();
    musicGain.gain.value = chaseOn ? 0 : MUSIC_VOLUME;
    chaseGain.gain.value = chaseOn && b ? MUSIC_VOLUME : 0;
    // both layers run in lockstep (same length), so the crossfade lands on the beat
    const at = ctx.currentTime + 0.05;
    for (const [buf, g] of [[a, musicGain], [b, chaseGain]]) {
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(g).connect(ctx.destination);
      src.start(at);
    }
    if (!b) chaseGain = null;
  }

  return {
    /** Create the AudioContext and start music + ghost loop. Safe to call often. */
    unlock() {
      if (unlocking) return unlocking;
      unlocking = (async () => {
        ctx = new AudioContext();
        await ctx.resume();
        sfx = ctx.createGain();
        sfx.connect(ctx.destination);
        ghostLoop = createGhostLoop(ctx, sfx);
        await Promise.all(SOUND_NAMES.filter((n) => FILES[n]).map(async (n) => {
          buffers[n] = (await Promise.all(FILES[n].map(decode))).filter(Boolean);
        }));
        await startMusic();
      })();
      return unlocking;
    },

    /** @param {SoundName} name */
    play(name) {
      if (!ctx || ctx.state !== 'running') return;
      const list = buffers[name];
      if (!list?.length) {
        SYNTH[name]?.(ctx, sfx, { duration: cfg.chase.warningTime });
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = list[Math.floor(Math.random() * list.length)];
      if (name === 'step') src.playbackRate.value = 0.92 + Math.random() * 0.16;
      const g = ctx.createGain();
      g.gain.value = VOLUME[name] ?? 0.5;
      src.connect(g).connect(sfx);
      src.start();
    },

    /** For the debug panel: context state, which sounds have files, music running. */
    status() {
      return {
        state: ctx?.state ?? 'locked',
        files: SOUND_NAMES.filter((n) => buffers[n]?.length),
        music: !!musicGain,
        chaseMusic: !!chaseGain,
      };
    },

    /** @param {number} level danger meter fill 0..1 */
    setDanger(level) {
      ghostLoop?.setLevel(level);
    },

    /** @param {boolean} active chase event running */
    setChase(active) {
      if (active === chaseOn) return;
      chaseOn = active;
      if (!ctx || !musicGain || !chaseGain) return;
      const t = ctx.currentTime;
      for (const [g, v] of [[musicGain, active ? 0 : MUSIC_VOLUME], [chaseGain, active ? MUSIC_VOLUME : 0]]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(v, t + CROSSFADE);
      }
    },
  };
}
