// @vitest-environment node
import { test, expect } from 'vitest';
import { broadcastAddresses } from '../server/beacon.mjs';

test('broadcastAddresses covers every IPv4 interface', () => {
  const ifaces = {
    'Wi-Fi': [
      { address: '192.168.43.120', netmask: '255.255.255.0', family: 'IPv4', internal: false },
      { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false },
    ],
    Ethernet: [{ address: '10.0.0.5', netmask: '255.0.0.0', family: 'IPv4', internal: false }],
    Loopback: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
    Dup: [{ address: '192.168.43.7', netmask: '255.255.255.0', family: 4, internal: false }],
  };
  expect(broadcastAddresses(ifaces).sort()).toEqual(['10.255.255.255', '192.168.43.255', '255.255.255.255']);
});
