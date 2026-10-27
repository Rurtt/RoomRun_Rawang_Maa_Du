// Phones as an input source: WebSocket to the relay, samples into the motion
// detector on the game clock.
//
// Clock: each phone stamps samples with its own performance.now(). Per hand,
// offset = min(receive - ts) seen so far, i.e. the least-delayed sample; ts +
// offset puts samples on the game clock with the network jitter taken out.
import config from '../config.js';

const GRAVITY_SMOOTH = 0.1; // low-pass for phones that only report accelerationIncludingGravity

/**
 * @param {{ url?: string, detector: ReturnType<typeof import('./motion.js').createMotionDetector>, cfg?: typeof config.phone }} opts
 *   url: relay WebSocket; omit to feed handleMessage yourself (tests)
 */
export function createPhoneSource({ url, detector, cfg = config.phone }) {
  const offset = { L: Infinity, R: Infinity };
  const gravity = { L: null, R: null };
  /** @type {Record<'L'|'R', number|null>} */
  const rtt = { L: null, R: null };
  let lastSample = -Infinity;
  let everConnected = false;

  /** @param {any} msg @param {number} recvMs game clock at arrival */
  function handleMessage(msg, recvMs = performance.now()) {
    if (!msg || typeof msg !== 'object') return;
    const hand = msg.hand === 'L' || msg.hand === 'R' ? msg.hand : null;
    if (msg.t === 'rtt' && hand && typeof msg.ms === 'number') {
      rtt[hand] = msg.ms;
    } else if (msg.t === 'm' && hand && typeof msg.ts === 'number') {
      lastSample = recvMs;
      everConnected = true;
      offset[hand] = Math.min(offset[hand], recvMs - msg.ts);
      let a = msg.a;
      if ((!a || a.some((x) => x == null)) && Array.isArray(msg.ag) && msg.ag.every((x) => typeof x === 'number')) {
        // no linear acceleration on this phone: take gravity out ourselves
        const g = (gravity[hand] ??= [...msg.ag]);
        for (let i = 0; i < 3; i++) g[i] += (msg.ag[i] - g[i]) * GRAVITY_SMOOTH;
        a = msg.ag.map((x, i) => x - g[i]);
      }
      detector.push({ hand, ts: msg.ts + offset[hand], a });
    }
  }

  if (url) {
    const open = () => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'hello', role: 'game' })));
      ws.addEventListener('message', (ev) => {
        try { handleMessage(JSON.parse(String(ev.data))); } catch { /* not ours */ }
      });
      // relay not running yet, or restarted: keep trying quietly
      ws.addEventListener('close', () => setTimeout(open, 2000));
    };
    open();
  }

  return {
    handleMessage,
    rtt,
    /** True once any phone has sent motion: lets the HUD tell "lost" from "never used". */
    get everConnected() { return everConnected; },
    connected(nowMs) { return nowMs - lastSample <= cfg.disconnectAfterMs; },
    read(nowMs) { return detector.read(nowMs); },
  };
}
