import { DEMO_CANDIDATES, SUPPORTED_PLATFORMS, pairStepFor } from './addTv';
import { candidateNotice, lostRemoteHelp, pairingNotice, platformList, type PairingNoticeKind } from './pairingNotice';
import type { Platform } from './types';

describe('pairingNotice (T71)', () => {
  const cases: [Platform, PairingNoticeKind, boolean][] = [
    ['roku', 'none', false],
    ['samsung', 'allow', true],
    ['webos', 'allow', true],
    ['androidtv', 'pin', false],
    ['firetv', 'pin', false],
    ['vizio', 'pin', false],
    ['philips', 'pin', false],
    ['sony', 'key', true],
    ['ir', 'none', false],
    ['mock', 'none', false],
  ];
  it.each(cases)('%s -> %s (needs the TV once: %s)', (platform, kind, once) => {
    expect(pairingNotice(platform)).toEqual({ kind, needsPhysicalRemoteOnce: once });
  });

  it('only allow and key prompts need input on the TV', () => {
    for (const [platform] of cases) {
      const n = pairingNotice(platform);
      expect(n.needsPhysicalRemoteOnce).toBe(n.kind === 'allow' || n.kind === 'key');
    }
  });

  it("agrees with the add-TV pair step for platforms that have one", () => {
    const stepToKind = { prompt: 'allow', code: 'pin', psk: 'key', none: 'none' } as const;
    for (const p of [...SUPPORTED_PLATFORMS, 'androidtv', 'firetv'] as Platform[]) {
      expect(pairingNotice(p).kind).toBe(stepToKind[pairStepFor(p).kind]);
    }
  });

  it('returns a fresh object (callers cannot mutate the table)', () => {
    const a = pairingNotice('samsung');
    a.kind = 'none';
    expect(pairingNotice('samsung').kind).toBe('allow');
  });

  it('demo candidates use their pairAs platform', () => {
    const kinds = DEMO_CANDIDATES.map((c) => candidateNotice(c).kind);
    expect(kinds).toEqual(['allow', 'pin', 'none', 'pin']);
    expect(candidateNotice({ platform: 'webos' }).kind).toBe('allow');
  });
});

describe('lostRemoteHelp (T71)', () => {
  it('fetch only (Expo Go): Roku needs nothing on the TV, Sony needs its menus once', () => {
    const h = lostRemoteHelp({ os: 'ios', caps: { fetch: true, ws: false }, hasUdpSender: false });
    expect(h.noConfirm).toEqual(['roku']);
    expect(h.needsTvOnce).toEqual(['sony']);
    expect(h.wake).toBe(false);
    expect(h.ir).toBe(false);
  });

  it('with WebSockets, Samsung and LG join the needs-the-TV-once list', () => {
    const h = lostRemoteHelp({ os: 'android', caps: { fetch: true, ws: true }, hasUdpSender: true });
    expect(h.noConfirm).toEqual(['roku']);
    expect(h.needsTvOnce).toEqual(['samsung', 'webos', 'sony']);
    expect(h.wake).toBe(true);
    expect(h.ir).toBe(true);
  });

  it('defaults to fetch-only caps and never lists ir or the demo TV', () => {
    const h = lostRemoteHelp({ os: 'android', hasUdpSender: false });
    expect(h.noConfirm).toEqual(['roku']);
    expect([...h.noConfirm, ...h.needsTvOnce]).not.toContain('mock');
    expect([...h.noConfirm, ...h.needsTvOnce]).not.toContain('ir');
  });

  it('lists no platform Couch cannot pair with yet', () => {
    const h = lostRemoteHelp({ os: 'android', caps: { fetch: true, ws: true }, hasUdpSender: false });
    for (const p of ['androidtv', 'firetv', 'vizio', 'philips'] as Platform[]) {
      expect(h.noConfirm).not.toContain(p);
      expect(h.needsTvOnce).not.toContain(p);
    }
  });
});

describe('platformList (T71)', () => {
  it('joins platform labels for the language', () => {
    expect(platformList(['roku'], 'en-US')).toBe('Roku');
    const two = platformList(['samsung', 'webos'], 'en-US');
    expect(two).toContain('Samsung');
    expect(two).toContain('LG');
    expect(platformList([], 'en-US')).toBe('');
  });

  it('falls back to commas on a bad tag', () => {
    expect(platformList(['roku', 'sony'], 'not a tag!!')).toMatch(/Roku.*Sony/);
  });
});
