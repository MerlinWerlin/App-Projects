import { artworkOf, normName, pickResult, serviceFor, STORE_SERVICES, StoreIconSource } from './storeIcons';

describe('store icons', () => {
  it('maps TV app names and aliases to services', () => {
    expect(serviceFor({ id: 'x', name: 'Netflix' })?.id).toBe('svc.netflix');
    expect(serviceFor({ id: 'x', name: 'Disney Plus' })?.id).toBe('svc.disneyplus');
    expect(serviceFor({ id: 'x', name: 'ABC iview' })?.id).toBe('svc.iview');
    expect(serviceFor({ id: 'x', name: 'Some Game' })).toBeNull();
    expect(new Set(STORE_SERVICES.map((s) => s.id)).size).toBe(STORE_SERVICES.length);
    expect(normName('  Disney+ ')).toBe('disney+');
  });

  it('picks the matching result, preferring the right seller, https only', () => {
    const svc = serviceFor({ id: 'svc.netflix', name: '' })!;
    const r = pickResult(svc, [
      { trackName: 'Netflix Party Tips', sellerName: 'Someone', artworkUrl512: 'https://a/1.jpg' },
      { trackName: 'Netflix', sellerName: 'Netflix, Inc.', artworkUrl512: 'https://a/2.jpg' },
    ]);
    expect(artworkOf(r)).toBe('https://a/2.jpg');
    expect(pickResult(svc, [{ trackName: 'Other', sellerName: 'Netflix' }])).toBeNull();
    expect(artworkOf({ artworkUrl512: 'http://a/x.jpg' })).toBeNull();
  });

  it('fetches once, caches success, falls back AU -> US, remembers failure', async () => {
    let now = 0;
    const calls: string[] = [];
    const src = new StoreIconSource({
      now: () => now,
      minGapMs: 0,
      fetchJson: async (url) => {
        calls.push(url);
        if (url.includes('country=au')) return { results: [] };
        return { results: [{ trackName: 'YouTube', sellerName: 'Google LLC', artworkUrl512: 'https://a/yt.jpg' }] };
      },
    });
    const app = { id: 'svc.youtube', name: 'YouTube' };
    const [a, b] = await Promise.all([src.get(app), src.get(app)]);
    expect(a).toBe('https://a/yt.jpg');
    expect(b).toBe('https://a/yt.jpg');
    expect(calls.length).toBe(2);
    expect(src.peek(app)).toBe('https://a/yt.jpg');
    const bad = new StoreIconSource({ now: () => now, minGapMs: 0, fetchJson: async () => { throw new Error('offline'); } });
    expect(await bad.get({ id: 'x', name: 'Stan' })).toBeNull();
    expect(bad.peek({ id: 'x', name: 'Stan' })).toBeNull();
    now = 10 * 60_000;
    expect(bad.peek({ id: 'x', name: 'Stan' })).toBeUndefined();
    expect(await src.get({ id: 'x', name: 'Unknown thing' })).toBeNull();
  });

  it('queues lookups one at a time with a gap (rate limit) in the order asked', async () => {
    let now = 0;
    const order: string[] = [];
    const waits: number[] = [];
    let active = 0;
    let maxActive = 0;
    const src = new StoreIconSource({
      now: () => now,
      countries: ['au'],
      minGapMs: 3000,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
      fetchJson: async (url) => {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(url);
        await Promise.resolve();
        active--;
        const name = url.includes('stan') ? 'Stan' : url.includes('netflix') ? 'Netflix' : 'YouTube';
        return { results: [{ trackName: name, sellerName: name, artworkUrl512: `https://a/${name}.jpg` }] };
      },
    });
    const got = await Promise.all([
      src.get({ id: 'svc.stan', name: 'Stan' }),
      src.get({ id: 'svc.netflix', name: 'Netflix' }),
      src.get({ id: 'svc.youtube', name: 'YouTube' }),
    ]);
    expect(got).toEqual(['https://a/Stan.jpg', 'https://a/Netflix.jpg', 'https://a/YouTube.jpg']);
    expect(maxActive).toBe(1);
    expect(order[0]).toContain('stan');
    expect(waits).toEqual([3000, 3000]);
  });

  it('keeps found icons on the phone and skips the lookup next launch', async () => {
    const data = new Map<string, string>();
    const kv = { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
    let calls = 0;
    const fetchJson = async () => {
      calls++;
      return { results: [{ trackName: 'Stan', sellerName: 'Stan Entertainment', artworkUrl512: 'https://a/stan.jpg' }] };
    };
    const a = new StoreIconSource({ kv, fetchJson, minGapMs: 0, countries: ['au'] });
    expect(await a.get({ id: 'svc.stan', name: 'Stan' })).toBe('https://a/stan.jpg');
    await Promise.resolve();
    const b = new StoreIconSource({ kv, fetchJson, minGapMs: 0, countries: ['au'] });
    expect(await b.get({ id: 'svc.stan', name: 'Stan' })).toBe('https://a/stan.jpg');
    expect(calls).toBe(1);
  });
});
