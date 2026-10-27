// WebAudio synth sounds. Every SoundName has one, so a missing or broken file
// still makes a noise. The chase siren and the ghost's "wooo" loop are synth
// on purpose: the siren must last exactly the warning time, the loop must
// follow the danger meter smoothly.

/** One enveloped oscillator: frequency slides from f0 to f1 over `dur`. */
function blip(ctx, out, { type = 'square', f0, f1 = f0, dur, vol = 0.2, at = 0 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Short filtered noise burst (footsteps, thuds). */
function noise(ctx, out, { dur, freq, vol = 0.3 }) {
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = freq;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

/** @type {Record<string, (ctx: AudioContext, out: AudioNode, opts?: { duration?: number }) => void>} */
export const SYNTH = {
  step: (ctx, out) => noise(ctx, out, { dur: 0.08, freq: 900, vol: 0.35 }),
  coin: (ctx, out) => { blip(ctx, out, { f0: 988, dur: 0.07, vol: 0.12 }); blip(ctx, out, { f0: 1319, dur: 0.18, vol: 0.12, at: 0.07 }); },
  jump: (ctx, out) => blip(ctx, out, { type: 'triangle', f0: 300, f1: 700, dur: 0.18, vol: 0.25 }),
  land: (ctx, out) => noise(ctx, out, { dur: 0.12, freq: 400, vol: 0.4 }),
  hit: (ctx, out) => { noise(ctx, out, { dur: 0.25, freq: 600, vol: 0.6 }); blip(ctx, out, { type: 'sawtooth', f0: 180, f1: 60, dur: 0.25, vol: 0.25 }); },
  ghost: (ctx, out) => blip(ctx, out, { type: 'sine', f0: 520, f1: 260, dur: 0.9, vol: 0.25 }),
  /** Two-tone wailing siren for the whole chase warning. */
  alarm: (ctx, out, { duration = 3 } = {}) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    for (let s = 0; s < duration; s += 0.5) {
      osc.frequency.setValueAtTime(660, t + s);
      osc.frequency.linearRampToValueAtTime(990, t + s + 0.25);
      osc.frequency.linearRampToValueAtTime(660, t + s + 0.5);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
    g.gain.setValueAtTime(0.09, t + duration - 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },
  caught: (ctx, out) => [523, 440, 349, 262].forEach((f, i) => blip(ctx, out, { f0: f, dur: 0.22, vol: 0.18, at: i * 0.16 })),
  escape: (ctx, out) => [523, 659, 784, 1047].forEach((f, i) => blip(ctx, out, { f0: f, dur: 0.2, vol: 0.16, at: i * 0.1 })),
};

/**
 * The ghost's breathy "wooo": a wobbling sine through a lowpass, plus a quiet
 * airy noise bed. Silent until setLevel raises it.
 * @param {AudioContext} ctx @param {AudioNode} out
 */
export function createGhostLoop(ctx, out) {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out);

  const voice = ctx.createOscillator();
  voice.type = 'sine';
  voice.frequency.value = 330;
  const vibrato = ctx.createOscillator(); // slow pitch wobble = the "oooOOOooo"
  vibrato.frequency.value = 0.7;
  const vibAmt = ctx.createGain();
  vibAmt.gain.value = 70;
  vibrato.connect(vibAmt).connect(voice.frequency);
  const tremolo = ctx.createOscillator();
  tremolo.frequency.value = 5.5;
  const tremAmt = ctx.createGain();
  tremAmt.gain.value = 0.25;
  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 0.6;
  tremolo.connect(tremAmt).connect(voiceGain.gain);
  voice.connect(voiceGain).connect(master);

  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const air = ctx.createBufferSource();
  air.buffer = buf;
  air.loop = true;
  const airF = ctx.createBiquadFilter();
  airF.type = 'bandpass';
  airF.frequency.value = 700;
  airF.Q.value = 0.8;
  const airG = ctx.createGain();
  airG.gain.value = 0.25;
  air.connect(airF).connect(airG).connect(master);

  for (const n of [voice, vibrato, tremolo, air]) n.start();
  return {
    /** @param {number} level 0..1 (danger meter fill) */
    setLevel(level) {
      const v = 0.22 * Math.max(0, Math.min(1, level)) ** 2;
      master.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
      voice.frequency.setTargetAtTime(300 + 120 * level, ctx.currentTime, 0.3);
    },
  };
}
