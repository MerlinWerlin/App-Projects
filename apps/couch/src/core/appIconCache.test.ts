import {
  AppIconCache,
  driverIconFetch,
  iconCacheKey,
  isDisplayableIconUri,
  isTvSuppliedIcon,
  type IconFetch,
} from './appIconCache';
import type { TvDriver } from './driver';
import type { Capability, TvApp } from './types';

const A: TvApp = { id: 'a', name: 'A' };
const B: TvApp = { id: 'b', name: 'B' };
const C: TvApp = { id: 'c', name: 'C' };

function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/** A fetch whose calls are recorded and resolved by the test. */
function manualFetch() {
  const calls: string[] = [];
  const waiting = new Map<string, Array<(v: string | null) => void>>();
  const fetch: IconFetch = (app) => {
    calls.push(app.id);
    return new Promise((res) => {
      const list = waiting.get(app.id) ?? [];
      list.push(res);
      waiting.set(app.id, list);
    });
  };
  const resolve = (id: string, v: string | null) => {
    for (const r of waiting.get(id) ?? []) r(v);
    waiting.delete(id);
  };
  return { fetch, calls, resolve };
}

const never = () => new Promise<void>(() => {});
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('AppIconCache', () => {
  it('dedupes concurrent fetches for the same TV + app and caches the result', async () => {
    const f = manualFetch();
    const c = new AppIconCache({ sleep: never });
    const p1 = c.get('tv1', A, f.fetch);
    const p2 = c.get('tv1', A, f.fetch);
    expect(p2).toBe(p1);
    expect(c.peek('tv1', 'a')).toBeUndefined();
    await tick();
    f.resolve('a', 'http://10.0.0.2:8060/query/icon/a');
    expect(await p1).toBe('http://10.0.0.2:8060/query/icon/a');
    expect(await p2).toBe('http://10.0.0.2:8060/query/icon/a');
    expect(await c.get('tv1', A, f.fetch)).toBe('http://10.0.0.2:8060/query/icon/a');
    expect(c.peek('tv1', 'a')).toBe('http://10.0.0.2:8060/query/icon/a');
    expect(f.calls).toEqual(['a']);
  });

  it('keys by TV id + app id (same app on another TV is fetched separately)', async () => {
    const calls: string[] = [];
    const c = new AppIconCache({ sleep: never });
    const mk = (tv: string): IconFetch => async (app) => {
      calls.push(`${tv}/${app.id}`);
      return `http://${tv}/${app.id}`;
    };
    expect(await c.get('tv1', A, mk('tv1'))).toBe('http://tv1/a');
    expect(await c.get('tv2', A, mk('tv2'))).toBe('http://tv2/a');
    // A new driver instance for tv1 (reconnect) still hits the cache.
    expect(await c.get('tv1', A, mk('tv1-again'))).toBe('http://tv1/a');
    expect(calls).toEqual(['tv1/a', 'tv2/a']);
    expect(iconCacheKey('a|b', 'c')).not.toBe(iconCacheKey('a', 'b|c'));
  });

  it('remembers failures (null, throw, empty) and retries after retryAfterMs', async () => {
    const k = clock();
    let n = 0;
    const fetch: IconFetch = async (app) => {
      n += 1;
      if (app.id === 'a') throw new Error('boom');
      if (app.id === 'b') return '';
      return n > 3 ? 'data:image/png;base64,AAAA' : null;
    };
    const c = new AppIconCache({ now: k.now, sleep: never, retryAfterMs: 60_000 });
    expect(await c.get('tv', A, fetch)).toBeNull();
    expect(await c.get('tv', B, fetch)).toBeNull();
    expect(await c.get('tv', C, fetch)).toBeNull();
    expect(n).toBe(3);
    expect(c.peek('tv', 'a')).toBeNull();
    k.advance(59_999);
    expect(await c.get('tv', C, fetch)).toBeNull();
    expect(n).toBe(3);
    k.advance(1);
    expect(c.peek('tv', 'c')).toBeUndefined(); // due a retry
    expect(await c.get('tv', C, fetch)).toBe('data:image/png;base64,AAAA');
    expect(n).toBe(4);
  });

  it('treats a fetch that outlives timeoutMs as a failure', async () => {
    let fire: () => void = () => {};
    const sleep = () => new Promise<void>((r) => (fire = r));
    const f = manualFetch();
    const c = new AppIconCache({ sleep, timeoutMs: 5000 });
    const p = c.get('tv', A, f.fetch);
    await tick();
    fire();
    expect(await p).toBeNull();
    expect(c.peek('tv', 'a')).toBeNull();
    f.resolve('a', 'http://late'); // ignored
    await tick();
    expect(c.peek('tv', 'a')).toBeNull();
  });

  it('without a fetcher gives null and remembers nothing', async () => {
    const c = new AppIconCache();
    expect(await c.get('tv', A, null)).toBeNull();
    expect(c.peek('tv', 'a')).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('markFailed (image error) holds the house tile until the retry window passes', async () => {
    const k = clock();
    let n = 0;
    const fetch: IconFetch = async () => `http://x/${++n}`;
    const c = new AppIconCache({ now: k.now, sleep: never, retryAfterMs: 1000 });
    expect(await c.get('tv', A, fetch)).toBe('http://x/1');
    c.markFailed('tv', 'a', 'http://other'); // stale report for another URI: ignored
    expect(c.peek('tv', 'a')).toBe('http://x/1');
    c.markFailed('tv', 'a', 'http://x/1');
    expect(c.peek('tv', 'a')).toBeNull();
    expect(await c.get('tv', A, fetch)).toBeNull();
    k.advance(1000);
    expect(await c.get('tv', A, fetch)).toBe('http://x/2');
  });

  it('is a bounded LRU by entry count', async () => {
    const fetch: IconFetch = async (app) => `http://u/${app.id}`;
    const c = new AppIconCache({ sleep: never, maxEntries: 2 });
    await c.get('tv', A, fetch);
    await c.get('tv', B, fetch);
    expect(c.peek('tv', 'a')).toBe('http://u/a'); // touch a: b is now least recent
    await c.get('tv', C, fetch);
    expect(c.size).toBe(2);
    expect(c.peek('tv', 'b')).toBeUndefined();
    expect(c.peek('tv', 'a')).toBe('http://u/a');
    expect(c.peek('tv', 'c')).toBe('http://u/c');
  });

  const BIG = 'http://' + 'x'.repeat(43); // 50 chars
  it('is bounded by total URI characters and skips a single oversize URI', async () => {
    const fetch: IconFetch = async (app) => (app.id === 'c' ? BIG : 'http://y/' + app.id);
    const c = new AppIconCache({ sleep: never, maxChars: 25 });
    await c.get('tv', A, fetch);
    await c.get('tv', B, fetch);
    expect(c.size).toBe(2);
    const D: TvApp = { id: 'd', name: 'D' };
    await c.get('tv', D, fetch);
    expect(c.peek('tv', 'a')).toBeUndefined();
    expect(c.size).toBe(2);
    expect(await c.get('tv', C, fetch)).toBe(BIG); // returned, not stored
    expect(c.peek('tv', 'c')).toBeUndefined();
    expect(c.size).toBe(2);
  });

  it('invalidate drops one TV (including in-flight results) or everything', async () => {
    const f = manualFetch();
    const ok: IconFetch = async (app) => `http://u/${app.id}`;
    const c = new AppIconCache({ sleep: never });
    await c.get('tv1', A, ok);
    await c.get('tv2', A, ok);
    const p = c.get('tv1', B, f.fetch);
    c.invalidate('tv1');
    await tick();
    f.resolve('b', 'http://u/late');
    expect(await p).toBe('http://u/late');
    expect(c.peek('tv1', 'b')).toBeUndefined();
    expect(c.peek('tv1', 'a')).toBeUndefined();
    expect(c.peek('tv2', 'a')).toBe('http://u/a');
    c.invalidate();
    expect(c.size).toBe(0);
  });
});

// 1x1 PNG (made for the test, not anyone's artwork).
const PNG_DATA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPtfDwAFAgJ/AXqvJAAAAABJRU5ErkJggg==';

describe('AppIconCache URI kinds', () => {
  it('caches data: URIs (Samsung) and http URLs (Roku/webOS/Sony) alike, fetching each once', async () => {
    const calls: string[] = [];
    const fetch: IconFetch = async (app) => {
      calls.push(app.id);
      return app.id === 'a' ? PNG_DATA : 'http://192.168.1.33:8060/query/icon/b';
    };
    const c = new AppIconCache({ sleep: never });
    expect(await c.get('tv', A, fetch)).toBe(PNG_DATA);
    expect(await c.get('tv', B, fetch)).toBe('http://192.168.1.33:8060/query/icon/b');
    expect(await c.get('tv', A, fetch)).toBe(PNG_DATA);
    expect(c.peek('tv', 'a')).toBe(PNG_DATA);
    expect(calls).toEqual(['a', 'b']);
  });

  it('treats URIs an Image must not load as "no icon" (remembered failure)', async () => {
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html;base64,PGI+', '/opt/share/icon.png', 'http://tv/a b', '  ']) {
      const c = new AppIconCache({ sleep: never });
      expect(await c.get('tv', A, async () => bad)).toBeNull();
      expect(c.peek('tv', 'a')).toBeNull();
    }
  });
});

describe('icon URI rules', () => {
  it('isDisplayableIconUri: base64 image data: URIs and http(s) URLs only', () => {
    expect(isDisplayableIconUri(PNG_DATA)).toBe(true);
    expect(isDisplayableIconUri('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isDisplayableIconUri('https://10.0.0.5/icon.png')).toBe(true);
    expect(isDisplayableIconUri('data:image/svg+xml,<svg/>')).toBe(false);
    expect(isDisplayableIconUri('data:image/png;base64,')).toBe(false);
    expect(isDisplayableIconUri('ftp://10.0.0.5/icon.png')).toBe(false);
    expect(isDisplayableIconUri('')).toBe(false);
  });

  it('isTvSuppliedIcon: inline, the TV host itself or a private LAN address; never the cloud', () => {
    expect(isTvSuppliedIcon(PNG_DATA)).toBe(true);
    expect(isTvSuppliedIcon('http://192.168.1.88/DIAL/icon/x.png')).toBe(true);
    expect(isTvSuppliedIcon('http://10.1.2.3:3000/resources/a.png')).toBe(true);
    expect(isTvSuppliedIcon('http://bravia.local/DIAL/icon/x.png', 'bravia.local')).toBe(true);
    expect(isTvSuppliedIcon('http://BRAVIA.local/DIAL/icon/x.png', 'bravia.local')).toBe(true);
    expect(isTvSuppliedIcon('http://bravia.local/DIAL/icon/x.png')).toBe(false);
    expect(isTvSuppliedIcon('https://cdn.example.com/icon.png', '192.168.1.88')).toBe(false);
    expect(isTvSuppliedIcon('http://8.8.8.8/icon.png')).toBe(false);
    expect(isTvSuppliedIcon('file:///opt/icon.png', '192.168.1.88')).toBe(false);
  });
});

describe('driverIconFetch', () => {
  function drv(caps: Capability[], withMethod = true) {
    return {
      platform: 'mock',
      capabilities: new Set<Capability>(caps),
      appIcon: withMethod ? async (app: TvApp) => `http://tv/${app.id}` : undefined,
    } as unknown as TvDriver;
  }

  it('needs both the method and the appIcons capability', async () => {
    expect(driverIconFetch(null)).toBeNull();
    expect(driverIconFetch(drv([]))).toBeNull();
    expect(driverIconFetch(drv(['appIcons'], false))).toBeNull();
    const f = driverIconFetch(drv(['appIcons']));
    expect(f).not.toBeNull();
    expect(await f!(A)).toBe('http://tv/a');
  });
});
