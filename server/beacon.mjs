// UDP beacon so sticks find the laptop on a phone hotspot (IP changes every time).
import dgram from 'node:dgram';
import os from 'node:os';

/** Directed broadcast of every non-internal IPv4 interface, plus 255.255.255.255, deduped. */
export function broadcastAddresses(ifaces) {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(ifaces ?? {})) {
    for (const i of list ?? []) {
      if (i.internal || !(i.family === 'IPv4' || i.family === 4)) continue;
      const a = i.address.split('.').map(Number);
      const m = i.netmask.split('.').map(Number);
      if (a.length !== 4 || m.length !== 4) continue;
      out.add(a.map((x, k) => (x | (~m[k] & 255)) & 255).join('.'));
    }
  }
  return [...out];
}

/** Send {"t":"beacon","port":relayPort} to every broadcast address each tick. */
export function startBeacon({ port = 8788, relayPort = 8787, everyMs = 1000 } = {}) {
  const sock = dgram.createSocket('udp4');
  const payload = Buffer.from(JSON.stringify({ t: 'beacon', port: relayPort }));
  let ready = false;
  sock.on('error', () => {});
  sock.bind(() => { sock.setBroadcast(true); ready = true; tick(); });
  const tick = () => {
    if (!ready) return;
    // recomputed every tick: the hotspot adapter may come up after start
    for (const addr of broadcastAddresses(os.networkInterfaces())) sock.send(payload, port, addr, () => {});
  };
  const timer = setInterval(tick, everyMs);
  return { stop() { clearInterval(timer); try { sock.close(); } catch { /* already closed */ } } };
}
