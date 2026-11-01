/**
 * src/native/bonjour.ts over a fake lan-wss module: browse -> onBonjourService -> bonjourResolve ->
 * MdnsRecord, and the records map to candidates through discoverTvs. Pure TS.
 */
import type { FetchLike } from '../src/core/driver';
import { MDNS_BROWSE_TYPES, mdnsToCandidate, type MdnsRecord } from '../src/core/discovery';
import { discoverTvs } from '../src/core/discoveryService';
import { bonjourFromModule, hasBonjour, loadBonjour, type BonjourServiceEvent, type LanBonjourModule } from '../src/native/bonjour';

type Resolved = { host?: unknown; port?: unknown } | null;

function fakeModule(resolveTable: Record<string, Resolved | Error> = {}) {
  const listeners: ((e: BonjourServiceEvent) => void)[] = [];
  const calls = { browse: [] as { id: string; types: string[]; timeoutMs: number }[], stop: [] as string[], resolve: [] as string[] };
  const gates: (() => void)[] = [];
  let hold = false;
  const mod: LanBonjourModule = {
    bonjourBrowse(id, types, timeoutMs) {
      calls.browse.push({ id, types, timeoutMs });
      return true;
    },
    bonjourStop(id) {
      calls.stop.push(id);
    },
    bonjourResolve(type, name) {
      calls.resolve.push(`${type}|${name}`);
      const r = resolveTable[`${type}|${name}`];
      const settle = (): Promise<Resolved> => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r ?? null));
      if (!hold) return settle();
      return new Promise<void>((res) => gates.push(res)).then(settle);
    },
    addListener(_event, cb) {
      listeners.push(cb);
      return { remove: () => listeners.splice(listeners.indexOf(cb), 1) };
    },
  };
  const emit = (e: Omit<BonjourServiceEvent, 'id'> & { id?: string }) => {
    const id = e.id ?? calls.browse[calls.browse.length - 1]!.id;
    for (const l of [...listeners]) l({ ...e, id });
  };
  return {
    mod,
    calls,
    emit,
    listeners,
    holdResolves: () => (hold = true),
    releaseResolves: () => gates.splice(0).forEach((g) => g()),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('bonjour adapter', () => {
  it('is null without the native module (Expo Go / tests)', () => {
    expect(loadBonjour()).toBeNull();
    expect(hasBonjour()).toBe(false);
  });

  it('browses the given types, resolves each service to IPv4 and hands back an MdnsRecord', async () => {
    const f = fakeModule({ '_googlecast._tcp|Google-TV-abc': { host: '192.168.1.70', port: 8009 } });
    const got: MdnsRecord[] = [];
    const stop = bonjourFromModule(f.mod, { browseMs: 9000, resolveMs: 1000 }).browse(MDNS_BROWSE_TYPES, (r) => got.push(r));
    expect(f.calls.browse).toHaveLength(1);
    expect(f.calls.browse[0]!.types).toEqual([...MDNS_BROWSE_TYPES]);
    expect(f.calls.browse[0]!.timeoutMs).toBe(9000);

    f.emit({ type: '_googlecast._tcp', name: 'Google-TV-abc', txt: { fn: 'Living Room TV', md: 'C7K', ca: '463365' } });
    await flush();
    expect(got).toEqual([
      {
        type: '_googlecast._tcp',
        name: 'Google-TV-abc',
        fullName: 'Google-TV-abc._googlecast._tcp.local.',
        host: '192.168.1.70',
        addresses: ['192.168.1.70'],
        port: 8009,
        txt: { fn: 'Living Room TV', md: 'C7K', ca: '463365' },
      },
    ]);
    expect(mdnsToCandidate(got[0]!)).toMatchObject({ platform: 'androidtv', host: '192.168.1.70', name: 'Living Room TV', model: 'C7K' });
    stop();
    expect(f.calls.stop).toEqual([f.calls.browse[0]!.id]);
    expect(f.listeners).toHaveLength(0);
  });

  it('resolves a service once; a TXT update re-delivers with the same address', async () => {
    const f = fakeModule({ '_androidtvremote2._tcp|Bedroom TV': { host: '192.168.1.60', port: 6466 } });
    const got: MdnsRecord[] = [];
    bonjourFromModule(f.mod).browse(['_androidtvremote2._tcp'], (r) => got.push(r));
    f.emit({ type: '_androidtvremote2._tcp', name: 'Bedroom TV', txt: {} });
    await flush();
    f.emit({ type: '_androidtvremote2._tcp', name: 'Bedroom TV', txt: { bt: 'AA:BB' } });
    await flush();
    expect(f.calls.resolve).toEqual(['_androidtvremote2._tcp|Bedroom TV']);
    expect(got.map((r) => [r.host, r.txt])).toEqual([
      ['192.168.1.60', {}],
      ['192.168.1.60', { bt: 'AA:BB' }],
    ]);
  });

  it('drops services that fail to resolve, resolve to IPv6 / junk, or carry odd data', async () => {
    const f = fakeModule({
      '_googlecast._tcp|v6': null,
      '_googlecast._tcp|bad-host': { host: 'fe80::1', port: 8009 },
      '_googlecast._tcp|bad-port': { host: '192.168.1.9', port: 70000 },
      '_googlecast._tcp|throws': new Error('nope'),
      '_googlecast._tcp|ok': { host: '192.168.1.10', port: 8009 },
    });
    const got: MdnsRecord[] = [];
    bonjourFromModule(f.mod).browse(['_googlecast._tcp'], (r) => got.push(r));
    for (const name of ['v6', 'bad-host', 'bad-port', 'throws']) f.emit({ type: '_googlecast._tcp', name, txt: {} });
    f.emit({ type: '_googlecast._tcp', name: '', txt: {} });
    f.emit({ type: '_googlecast._tcp', name: 'other-session', id: 'someone-else', txt: {} });
    f.emit({ type: '_googlecast._tcp', name: 'ok', txt: { fn: 'TV', n: 5 as unknown as string, '': 'x' } as Record<string, string> });
    await flush();
    expect(got.map((r) => r.name)).toEqual(['ok']);
    expect(got[0]!.txt).toEqual({ fn: 'TV' });
    expect(f.calls.resolve).not.toContain('_googlecast._tcp|other-session');
  });

  it('ignores new services after stop but lets in-flight resolves deliver', async () => {
    const f = fakeModule({
      '_googlecast._tcp|early': { host: '192.168.1.20', port: 8009 },
      '_googlecast._tcp|late': { host: '192.168.1.21', port: 8009 },
    });
    f.holdResolves();
    const got: string[] = [];
    const stop = bonjourFromModule(f.mod).browse(['_googlecast._tcp'], (r) => got.push(r.host!));
    f.emit({ type: '_googlecast._tcp', name: 'early', txt: {} });
    stop();
    stop(); // idempotent
    expect(f.calls.stop).toHaveLength(1);
    f.emit({ type: '_googlecast._tcp', name: 'late', txt: {} }); // listener already removed
    f.releaseResolves();
    await flush();
    expect(got).toEqual(['192.168.1.20']);
    expect(f.calls.resolve).toEqual(['_googlecast._tcp|early']);
  });

  it('caps resolves per session and survives a throwing consumer / native', async () => {
    const f = fakeModule({ '_googlecast._tcp|a': { host: '192.168.1.30', port: 8009 }, '_googlecast._tcp|b': { host: '192.168.1.31', port: 8009 } });
    let calls = 0;
    bonjourFromModule(f.mod, { maxResolves: 1 }).browse(['_googlecast._tcp'], () => {
      calls++;
      throw new Error('consumer bug');
    });
    f.emit({ type: '_googlecast._tcp', name: 'a', txt: {} });
    f.emit({ type: '_googlecast._tcp', name: 'b', txt: {} });
    await flush();
    expect(calls).toBe(1);
    expect(f.calls.resolve).toEqual(['_googlecast._tcp|a']);

    const broken: LanBonjourModule = {
      ...f.mod,
      bonjourBrowse: () => {
        throw new Error('native');
      },
    };
    const stop = bonjourFromModule(broken).browse(['_googlecast._tcp'], () => undefined);
    expect(() => stop()).not.toThrow();

    const refused = fakeModule();
    refused.mod.bonjourBrowse = () => false;
    bonjourFromModule(refused.mod).browse(['_googlecast._tcp'], () => undefined);
    expect(refused.listeners).toHaveLength(0);
  });

  it('feeds discoverTvs: a Google TV found over Bonjour is a candidate and is not re-probed', async () => {
    const f = fakeModule({ '_googlecast._tcp|Google-TV-abc': { host: '192.168.1.70', port: 8009 } });
    const probed = new Set<string>();
    const fetch: FetchLike = async (url) => {
      probed.add(url.split('/')[2]?.split(':')[0] ?? '');
      throw new Error('x');
    };
    const sleep = async () => {
      // the TV answers while discovery listens
      f.emit({ type: '_googlecast._tcp', name: 'Google-TV-abc', txt: { fn: 'Living Room TV', md: 'C7K' } });
      await flush();
    };
    const res = await discoverTvs({ fetch, mdns: bonjourFromModule(f.mod), localIp: '192.168.1.40', sleep });
    expect(res.methods).toContain('mdns');
    expect(res.candidates).toEqual([
      expect.objectContaining({ platform: 'androidtv', host: '192.168.1.70', name: 'Living Room TV', model: 'C7K', source: 'mdns' }),
    ]);
    expect(probed.has('192.168.1.70')).toBe(false);
    expect(f.calls.stop).toHaveLength(1);
  });
});
