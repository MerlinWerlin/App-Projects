import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MDNS_ALIAS_TYPES,
  MDNS_BROWSE_TYPES,
  MDNS_TYPES,
  SEARCH_TARGETS,
  buildMSearch,
  dedupeCandidates,
  isIpv4,
  mdnsToCandidate,
  parseSsdpResponse,
  type TvCandidate,
} from './discovery';

const fx = (name: string): string => readFileSync(join(__dirname, 'drivers', '__fixtures__', 'ssdp', name), 'utf8');

describe('buildMSearch', () => {
  it('formats exactly with CRLF and a terminating blank line', () => {
    expect(buildMSearch('roku:ecp', 3)).toBe(
      'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 3\r\nST: roku:ecp\r\n\r\n',
    );
  });
  it('clamps MX to 1..5', () => {
    expect(buildMSearch('x', 0)).toContain('MX: 1\r\n');
    expect(buildMSearch('x', 99)).toContain('MX: 5\r\n');
  });
  it('has a target per SSDP platform', () => {
    expect(SEARCH_TARGETS).toEqual({
      roku: 'roku:ecp',
      samsung: 'urn:samsung.com:device:RemoteControlReceiver:1',
      webos: 'urn:lge-com:service:webos-second-screen:1',
      sony: 'urn:schemas-sony-com:service:ScalarWebAPI:1',
    });
  });
});

describe('parseSsdpResponse (fixtures)', () => {
  it('Roku', () => {
    expect(parseSsdpResponse(fx('roku.txt'), '192.168.1.134')).toEqual({
      platform: 'roku',
      host: '192.168.1.134',
      port: 8060,
      location: 'http://192.168.1.134:8060/',
      usn: 'uuid:roku:ecp:X01900ABCDEF',
      server: 'Roku/12.5.0 UPnP/1.0 Roku/12.5.0',
      source: 'ssdp',
    });
  });
  it('Samsung', () => {
    const c = parseSsdpResponse(fx('samsung.txt'), '192.168.1.52');
    expect(c).toMatchObject({ platform: 'samsung', host: '192.168.1.52', port: 7678, source: 'ssdp' });
    expect(c?.usn).toContain('uuid:0ee6a5d4');
  });
  it('LG with URL-encoded friendly name', () => {
    expect(parseSsdpResponse(fx('lg.txt'), '192.168.1.77')).toMatchObject({
      platform: 'webos',
      host: '192.168.1.77',
      port: 1956,
      name: '[LG] webOS TV OLED55C1',
    });
  });
  it('Sony with model from SERVER and name from X-AV-Server-Info', () => {
    expect(parseSsdpResponse(fx('sony.txt'), '192.168.1.88')).toMatchObject({
      platform: 'sony',
      host: '192.168.1.88',
      port: 52323,
      model: 'KD-55X85J',
      name: 'BRAVIA KD-55X85J',
    });
  });
  it('ignores non-TV devices', () => {
    expect(parseSsdpResponse(fx('router.txt'), '192.168.1.1')).toBeNull();
  });
});

describe('parseSsdpResponse (edge cases)', () => {
  it('is case-insensitive on header names and accepts LF only', () => {
    const c = parseSsdpResponse('HTTP/1.1 200 OK\nst: ROKU:ECP\nlocation: http://10.0.0.9:8060/\n\n');
    expect(c).toMatchObject({ platform: 'roku', host: '10.0.0.9', port: 8060 });
  });
  it('datagram source wins over LOCATION host', () => {
    expect(parseSsdpResponse(fx('roku.txt'), '192.168.1.200')?.host).toBe('192.168.1.200');
  });
  it('accepts NOTIFY alive, rejects byebye and requests', () => {
    const alive = 'NOTIFY * HTTP/1.1\r\nNT: roku:ecp\r\nNTS: ssdp:alive\r\nLOCATION: http://192.168.1.5:8060/\r\n\r\n';
    expect(parseSsdpResponse(alive, '192.168.1.5')?.platform).toBe('roku');
    expect(parseSsdpResponse(alive.replace('ssdp:alive', 'ssdp:byebye'), '192.168.1.5')).toBeNull();
    expect(parseSsdpResponse(buildMSearch('roku:ecp'), '192.168.1.5')).toBeNull();
  });
  it('falls back to SERVER header for generic ST', () => {
    const t = 'HTTP/1.1 200 OK\r\nST: upnp:rootdevice\r\nSERVER: Roku/11.0 UPnP/1.0\r\nLOCATION: http://192.168.1.6:8060/\r\n\r\n';
    expect(parseSsdpResponse(t, '192.168.1.6')?.platform).toBe('roku');
  });
  it('returns null for garbage or missing host', () => {
    expect(parseSsdpResponse('')).toBeNull();
    expect(parseSsdpResponse('HTTP/1.1 200 OK\r\nST: roku:ecp\r\n\r\n')).toBeNull();
    expect(parseSsdpResponse('HTTP/1.1 404 Not Found\r\nST: roku:ecp\r\n\r\n', '1.2.3.4')).toBeNull();
  });
});

describe('mdnsToCandidate', () => {
  it('Google TV', () => {
    expect(
      mdnsToCandidate({
        type: '_androidtvremote2._tcp.local.',
        name: 'Bedroom TV',
        fullName: 'Bedroom TV._androidtvremote2._tcp.local.',
        host: 'Android.local.',
        addresses: ['fe80::1', '192.168.1.60'],
        port: 6466,
        txt: { bt: 'AA:BB:CC:DD:EE:FF' },
      }),
    ).toEqual({
      platform: 'androidtv',
      host: '192.168.1.60',
      port: 6466,
      name: 'Bedroom TV',
      usn: 'Bedroom TV._androidtvremote2._tcp.local.',
      source: 'mdns',
    });
  });
  it('Fire TV and Vizio', () => {
    expect(mdnsToCandidate({ type: '_amzn-wplay._tcp', addresses: ['192.168.1.61'], txt: { n: 'Kitchen Fire TV' } })).toMatchObject({
      platform: 'firetv',
      name: 'Kitchen Fire TV',
    });
    expect(mdnsToCandidate({ type: '_viziocast._tcp', name: 'Den', host: '192.168.1.62', port: 7345, txt: { mdl: 'M55Q7-J01' } })).toMatchObject({
      platform: 'vizio',
      host: '192.168.1.62',
      model: 'M55Q7-J01',
    });
  });
  it('rejects unknown types and IPv6-only records', () => {
    expect(mdnsToCandidate({ type: '_http._tcp', addresses: ['192.168.1.2'] })).toBeNull();
    expect(mdnsToCandidate({ type: '_androidtvremote2._tcp', addresses: ['fe80::1'] })).toBeNull();
  });
  it('Google Cast (Google TV with Chromecast built in): fn is the name, md the model', () => {
    expect(
      mdnsToCandidate({
        type: '_googlecast._tcp',
        name: 'Google-TV-0a1b2c3d4e5f60718293a4b5c6d7e8f9',
        fullName: 'Google-TV-0a1b2c3d4e5f60718293a4b5c6d7e8f9._googlecast._tcp.local.',
        addresses: ['192.168.1.70'],
        port: 8009,
        txt: { id: '0a1b2c3d4e5f60718293a4b5c6d7e8f9', md: 'C7K', fn: 'Living Room TV', ca: '463365', rs: '' },
      }),
    ).toEqual({
      platform: 'androidtv',
      host: '192.168.1.70',
      port: 8009,
      name: 'Living Room TV',
      model: 'C7K',
      usn: 'Google-TV-0a1b2c3d4e5f60718293a4b5c6d7e8f9._googlecast._tcp.local.',
      source: 'mdns',
    });
    // trailing-dot / .local forms and no fn: falls back to the instance name
    expect(mdnsToCandidate({ type: '_googlecast._tcp.local.', name: 'Den', addresses: ['192.168.1.71'], txt: { fn: '' } })).toMatchObject({
      platform: 'androidtv',
      name: 'Den',
    });
  });
  it('Google Cast: speakers and speaker groups (no video-out capability) are skipped', () => {
    expect(mdnsToCandidate({ type: '_googlecast._tcp', addresses: ['192.168.1.72'], txt: { fn: 'Kitchen speaker', md: 'Google Nest Mini', ca: '199172' } })).toBeNull();
    expect(mdnsToCandidate({ type: '_googlecast._tcp', addresses: ['192.168.1.73'], txt: { fn: 'Whole house', md: 'Google Cast Group', ca: '2084' } })).toBeNull();
    // Chromecast dongle (ca has the video-out bit) and a record without ca are kept
    expect(mdnsToCandidate({ type: '_googlecast._tcp', addresses: ['192.168.1.74'], txt: { fn: 'Bedroom', ca: '4101' } })?.platform).toBe('androidtv');
    expect(mdnsToCandidate({ type: '_googlecast._tcp', addresses: ['192.168.1.75'], txt: { fn: 'Office', ca: 'junk' } })?.platform).toBe('androidtv');
  });
  it('the Cast and remote records of one Google TV merge into one candidate', () => {
    const cast = mdnsToCandidate({ type: '_googlecast._tcp', name: 'Google-TV-x', addresses: ['192.168.1.70'], port: 8009, txt: { fn: 'Living Room TV', md: 'C7K' } })!;
    const remote = mdnsToCandidate({ type: '_androidtvremote2._tcp', name: 'Living Room TV', addresses: ['192.168.1.70'], port: 6466 })!;
    const merged = dedupeCandidates([remote, cast]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ platform: 'androidtv', host: '192.168.1.70', name: 'Living Room TV', model: 'C7K' });
  });
  it('browses every primary and alias type', () => {
    expect(MDNS_BROWSE_TYPES).toEqual(expect.arrayContaining([...Object.values(MDNS_TYPES), '_googlecast._tcp']));
    expect(MDNS_ALIAS_TYPES['_googlecast._tcp']).toBe('androidtv');
    expect(MDNS_TYPES.androidtv).toBe('_androidtvremote2._tcp');
  });
});

describe('dedupeCandidates', () => {
  it('keeps one per host, prefers the richer record and fills gaps', () => {
    const a: TvCandidate = { platform: 'roku', host: '192.168.1.5', port: 8060, location: 'http://192.168.1.5:8060/', source: 'ssdp' };
    const b: TvCandidate = { platform: 'roku', host: '192.168.1.5', name: 'Living Room', model: 'Roku Ultra', source: 'probe' };
    const c: TvCandidate = { platform: 'samsung', host: '192.168.1.6', source: 'ssdp' };
    const out = dedupeCandidates([a, c, b]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ ...b, port: 8060, location: 'http://192.168.1.5:8060/' });
    expect(out[1]).toEqual(c);
  });
});

describe('isIpv4', () => {
  it('validates', () => {
    expect(isIpv4('192.168.1.1')).toBe(true);
    expect(isIpv4('256.1.1.1')).toBe(false);
    expect(isIpv4('01.1.1.1')).toBe(false);
    expect(isIpv4('1.1.1')).toBe(false);
  });
});
