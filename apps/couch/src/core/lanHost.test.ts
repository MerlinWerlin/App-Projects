import { isRfc1918Host, isRfc1918Url, parseIpv4, urlHost } from './lanHost';

describe('isRfc1918Host', () => {
  it.each(['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.254', '192.168.0.1', '192.168.1.52'])(
    'accepts %s',
    (h) => {
      expect(isRfc1918Host(h)).toBe(true);
    },
  );

  it.each([
    '172.15.0.1',
    '172.32.0.1',
    '192.169.1.1',
    '11.0.0.1',
    '8.8.8.8',
    '127.0.0.1',
    '169.254.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '',
    'localhost',
    'tv.local',
    '192.168.1',
    '192.168.1.1.1',
    '192.168.01.1',
    '010.0.0.1',
    '192.168.1.256',
    ' 192.168.1.1',
    '192.168.1.1 ',
    '192.168.1.1:8002',
    '10.0.0.1.evil.com',
    '::1',
    'fe80::1',
    '[fd00::1]',
    '0x0a.0.0.1',
  ])('rejects %j', (h) => {
    expect(isRfc1918Host(h)).toBe(false);
  });
});

describe('parseIpv4', () => {
  it('parses strict dotted quads', () => {
    expect(parseIpv4('192.168.1.52')).toEqual([192, 168, 1, 52]);
    expect(parseIpv4('1.2.3')).toBeNull();
    expect(parseIpv4('1.2.3.-4')).toBeNull();
  });
});

describe('urlHost / isRfc1918Url', () => {
  it('extracts IPv4 hosts', () => {
    expect(urlHost('wss://192.168.1.52:8002/api/v2/channels/samsung.remote.control?name=x')).toBe('192.168.1.52');
    expect(urlHost('ws://10.0.0.2/')).toBe('10.0.0.2');
    expect(urlHost('wss://10.0.0.2')).toBe('10.0.0.2');
  });

  it('applies the RFC 1918 rule to URLs', () => {
    expect(isRfc1918Url('wss://192.168.1.52:8002/api')).toBe(true);
    expect(isRfc1918Url('wss://example.com:8002/api')).toBe(false);
    expect(isRfc1918Url('wss://user@192.168.1.52:8002/')).toBe(false);
    expect(isRfc1918Url('wss://192.168.1.52.nip.io/')).toBe(false);
    expect(isRfc1918Url('not a url')).toBe(false);
  });
});
