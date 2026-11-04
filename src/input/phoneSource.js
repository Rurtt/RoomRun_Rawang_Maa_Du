// Phones as an input source: WebSocket to the relay, samples into the motion
// detector on the game clock. Sticks speak the same protocol with dev:'stick'
// (plus btn/bat), and win over a backup phone on the same hand.
//
// Clock: each phone stamps samples with its own performance.now(). Per hand,
// offset = min(receive - ts) seen so far, i.e. the least-delayed sample; ts +
// offset puts samples on the game clock with the network jitter taken out.
// The phone clock restarts on a page reload (hello resets the offset) and can
// stall while the screen is locked (samples arrive persistently late: re-baseline).
import config from '../config.js';

const GRAVITY_SMOOTH = 0.1; // low-pass for phones that only report accelerationIncludingGravity
const LATE_MS = 500; // a sample this much later than the baseline predicts is "late"
const LATE_RUN = 10; // this many late samples in a row: the phone clock jumped, re-baseline
const FUTURE_MS = 5000; // samples claiming to arrive this much early are bogus

/**
 * @param {{ url?: string, detector: ReturnType<typeof import('./motion.js').createMotionDetector>, cfg?: typeof config.phone }} opts
 *   url: relay WebSocket; omit to feed handleMessage yourself (tests)
 */
export function createPhoneSource({ url, detector, cfg = config.phone }) {
  const HANDS = /** @type {const} */ (['L', 'R']);
  /** @returns {Record<'L'|'R', Record<'stick'|'phone', any>>} */
  const perDev = (v) => ({ L: { stick: v, phone: v }, R: { stick: v, phone: v } });
  // clock offset, gravity estimate and late-run counter are per device: a stick
  // and a backup phone on the same hand have unrelated clocks
  const offset = perDev(Infinity);
  const gravity = perDev(null);
  const late = perDev(0);
  /** last motion sample per hand + device, game clock; never seen = -Infinity */
  const last = perDev(-Infinity);
  /** battery % per hand + device (sticks report it) */
  const pct = perDev(null);
  /** @type {Record<'L'|'R', number|null>} */
  const rtt = { L: null, R: null };
  /** device that last fed the detector per hand */
  const feeding = { L: null, R: null };
  const everStick = { L: false, R: false };
  let everConnected = false;
  /** @type {-1|0|1} lane from a phone tap / stick big button, waiting for the next read */
  let tapLane = 0;
  /** @type {'start'|null} one-shot action from a stick small button */
  let action = null;
  /** @type {WebSocket|null} */
  let socket = null;

  const devOf = (msg) => (msg.dev === 'stick' ? 'stick' : 'phone');
  const live = (hand, dev, nowMs) => nowMs - last[hand][dev] <= cfg.disconnectAfterMs;

  /** @param {any} msg @param {number} recvMs game clock at arrival */
  function handleMessage(msg, recvMs = performance.now()) {
    if (!msg || typeof msg !== 'object') return;
    const hand = msg.hand === 'L' || msg.hand === 'R' ? msg.hand : null;
    if (!hand) return;
    const dev = devOf(msg);
    if (msg.t === 'rtt' && typeof msg.ms === 'number') {
      rtt[hand] = msg.ms;
    } else if (msg.t === 'tap' || (msg.t === 'btn' && msg.b === 'big')) {
      // tap anywhere on the left phone / left stick big button = lane left; right = lane right
      tapLane = hand === 'L' ? -1 : 1;
    } else if (msg.t === 'btn' && msg.b === 'small') {
      action = 'start';
    } else if (msg.t === 'bat' && typeof msg.pct === 'number') {
      pct[hand][dev] = msg.pct;
    } else if (msg.t === 'hello') {
      // (re)connected phone page or rebooted stick: its clock may have restarted
      offset[hand][dev] = Infinity;
      gravity[hand][dev] = null;
      late[hand][dev] = 0;
    } else if (msg.t === 'm' && Number.isFinite(msg.ts)) {
      const off = offset[hand];
      const delay = recvMs - msg.ts;
      if (Number.isFinite(off[dev]) && delay < off[dev] - FUTURE_MS) return;
      const lt = late[hand];
      lt[dev] = delay - off[dev] > LATE_MS ? lt[dev] + 1 : 0;
      off[dev] = lt[dev] >= LATE_RUN ? delay : Math.min(off[dev], delay);
      if (lt[dev] >= LATE_RUN) lt[dev] = 0;
      // a backup phone only counts once the stick on its hand has gone quiet
      if (dev === 'phone' && live(hand, 'stick', recvMs)) return;
      last[hand][dev] = recvMs;
      if (dev === 'stick') everStick[hand] = true;
      feeding[hand] = dev;
      everConnected = true;
      let a = msg.a;
      if ((!a || a.some((x) => x == null)) && Array.isArray(msg.ag) && msg.ag.every((x) => typeof x === 'number')) {
        // no linear acceleration on this device: take gravity out ourselves
        const g = (gravity[hand][dev] ??= [...msg.ag]);
        for (let i = 0; i < 3; i++) g[i] += (msg.ag[i] - g[i]) * GRAVITY_SMOOTH;
        a = msg.ag.map((x, i) => x - g[i]);
      }
      detector.push({ hand, dev, ts: msg.ts + off[dev], a, ag: msg.ag });
    }
  }

  const lastAny = (hand) => Math.max(last[hand].stick, last[hand].phone);

  if (url) {
    const open = () => {
      const ws = new WebSocket(url);
      socket = ws;
      ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'hello', role: 'game' })));
      ws.addEventListener('message', (ev) => {
        try { handleMessage(JSON.parse(String(ev.data))); } catch { /* not ours */ }
      });
      // relay not running yet, or restarted: keep trying quietly
      ws.addEventListener('close', () => { if (socket === ws) socket = null; setTimeout(open, 2000); });
    };
    open();
  }

  return {
    handleMessage,
    rtt,
    /** True once any phone has sent motion: lets the HUD tell "lost" from "never used". */
    get everConnected() { return everConnected; },
    /** False until a device sends motion, and when any hand that has sent motion goes quiet. */
    connected(nowMs) {
      const seen = HANDS.filter((h) => lastAny(h) > -Infinity);
      return seen.length > 0 && seen.every((h) => nowMs - lastAny(h) <= cfg.disconnectAfterMs);
    },
    /** Per hand: which device feeds it, whether it is live, its battery %. */
    status(nowMs) {
      const one = (h) => {
        const dev = live(h, 'stick', nowMs) ? 'stick' : live(h, 'phone', nowMs) ? 'phone' : feeding[h];
        return { dev, connected: dev ? live(h, dev, nowMs) : false, pct: dev ? pct[h][dev] : null };
      };
      return { L: one('L'), R: one('R') };
    },
    /** A hand that has had a stick now has no live source at all. */
    sticksLost(nowMs) {
      return HANDS.some((h) => everStick[h] && !live(h, 'stick', nowMs) && !live(h, 'phone', nowMs));
    },
    /** Forget that sticks were ever here (keyboard restart: play on without a dead stick). */
    forgetSticks() { everStick.L = false; everStick.R = false; },
    /** @returns {'start'|null} one-shot small-button action */
    takeAction() { const a = action; action = null; return a; },
    /** @param {'hit'|'caught'|'pack'|'jump'} pattern @param {'L'|'R'|'both'} hand */
    buzz(pattern, hand = 'both') {
      if (socket && socket.readyState === 1) socket.send(JSON.stringify({ t: 'buzz', hand, pattern }));
    },
    read(nowMs) {
      const frame = detector.read(nowMs);
      if (tapLane && !frame.laneDelta) frame.laneDelta = tapLane;
      tapLane = 0;
      return frame;
    },
  };
}
