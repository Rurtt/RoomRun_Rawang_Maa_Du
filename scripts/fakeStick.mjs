// Fake stick pair on the laptop: speaks the stick protocol to the relay so the
// game, relay and HUD can be tested with no hardware.
//   npm run fakestick              (finds the relay by its UDP beacon, else localhost)
//   npm run fakestick -- --host 192.168.43.120
// Keys: r run on/off, j jump, a big L (lane left), d big R (lane right),
//       s small (start/restart), q quit. Prints every buzz the sticks get.
import dgram from 'node:dgram';
import WebSocket from 'ws';
import { fakeAg } from '../server/fakeMotion.mjs';

const argHost = process.argv.includes('--host') ? process.argv[process.argv.indexOf('--host') + 1] : null;
const BEACON_PORT = 8788;
const t0 = Date.now();
const now = () => Date.now() - t0;
const state = { running: false, jumpAtMs: /** @type {number|null} */ (null) };

/** Wait up to 3 s for a relay beacon; resolves to `host:port` or null. */
function findRelay() {
  return new Promise((resolve) => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const done = (v) => { clearTimeout(timer); try { sock.close(); } catch { /* closed */ } resolve(v); };
    const timer = setTimeout(() => done(null), 3000);
    sock.on('error', () => done(null));
    sock.on('message', (buf, rinfo) => {
      try {
        const msg = JSON.parse(String(buf));
        if (msg.t === 'beacon' && Number.isInteger(msg.port)) done(`${rinfo.address}:${msg.port}`);
      } catch { /* not a beacon */ }
    });
    sock.bind(BEACON_PORT);
  });
}

const target = argHost ? `${argHost}:8787` : (await findRelay()) ?? 'localhost:8787';
console.log(`relay: ws://${target}/ws${argHost ? '' : ' (beacon or localhost fallback)'}`);

/** One stick: reconnects every 2 s while the relay is down. */
function stick(hand) {
  let ws = null;
  const send = (m) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
  const open = () => {
    ws = new WebSocket(`ws://${target}/ws`);
    ws.on('open', () => {
      console.log(`${hand} connected`);
      send({ t: 'hello', role: 'phone', hand, dev: 'stick', fw: 'fake' });
      send({ t: 'bat', hand, v: 3.98, pct: 80 });
    });
    ws.on('message', (d) => {
      try { const m = JSON.parse(String(d)); if (m.t === 'buzz') console.log(`${hand} buzz ${m.pattern}`); } catch { /* junk */ }
    });
    ws.on('close', () => { ws = null; setTimeout(open, 2000); });
    ws.on('error', () => {});
  };
  open();
  return { send };
}

const sticks = { L: stick('L'), R: stick('R') };
setInterval(() => {
  const t = now();
  for (const hand of ['L', 'R']) sticks[hand].send({ t: 'm', hand, ts: t, ag: fakeAg(t, state), a: null, r: [0, 0, 0] });
}, 1000 / 60);
setInterval(() => { for (const hand of ['L', 'R']) sticks[hand].send({ t: 'bat', hand, v: 3.98, pct: 80 }); }, 10_000);
let pingId = 0;
setInterval(() => { for (const hand of ['L', 'R']) sticks[hand].send({ t: 'ping', id: ++pingId, ts: now() }); }, 2000);

const btn = (hand, b) => sticks[hand].send({ t: 'btn', hand, b, ts: now() });
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('data', (buf) => {
  const k = String(buf).toLowerCase();
  if (k === 'r') { state.running = !state.running; console.log(`running ${state.running ? 'on' : 'off'}`); }
  else if (k === 'j') { state.jumpAtMs = now(); console.log('jump'); }
  else if (k === 'a') btn('L', 'big');
  else if (k === 'd') btn('R', 'big');
  else if (k === 's') btn('R', 'small');
  else if (k === 'q' || k === '\u0003') process.exit(0);
});
console.log('keys: r run, j jump, a lane left, d lane right, s start, q quit');
