/**
 * T66: per-platform audit of where app tile icons come from (docs/APP_ICONS.md).
 *
 * Every assertion runs against recorded/reconstructed fixtures only; nothing here claims hardware
 * behaviour. Drivers that can supply icons must return an icon source (LAN URL or data: URI) via
 * appIcon() after listApps(); drivers that cannot must expose no icon fetcher at all, so the
 * Apps grid falls back to the typographic house tile. Icons are never bundled, drawn or matched
 * by name: the only source is what the TV itself returns.
 *
 * Samsung (ed.apps.icon -> data: URI), LG webOS (launch point URLs) and Fire TV (LAN-only icons)
 * are covered in their own driver tests, which need socket / pairing fakes; the cloud-URL guard
 * for webOS is in webos.test.ts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppIconCache, driverIconFetch, isDisplayableIconUri } from '../appIconCache';
import type { FetchLike, TvDriver } from '../driver';
import { IR_CODE_SETS } from '../ir/codes';
import { AndroidTvDriver, type ClientIdentity } from './androidtv/driver';
import { IrDriver } from './ir';
import { MockTv } from './mock';
import { PhilipsDriver, parsePhilipsApps } from './philips';
import { RokuDriver } from './roku';
import { SonyDriver } from './sony';
import { VizioDriver } from './vizio';

const FIX = join(__dirname, '__fixtures__');
const read = (...p: string[]) => readFileSync(join(FIX, ...p), 'utf8');

function fixtureFetch(respond: (url: string, body: string) => string | null): FetchLike {
  return async (url, init) => {
    const body = respond(url, init?.body ?? '');
    const status = body === null ? 404 : 200;
    return { status, ok: status === 200, text: async () => body ?? '' };
  };
}

/** listApps then the driver's own icon fetcher for each app, as the Apps tab does. */
async function iconsFor(tv: TvDriver): Promise<Record<string, string | null>> {
  const apps = await tv.listApps!();
  const fetch = driverIconFetch(tv);
  const out: Record<string, string | null> = {};
  for (const a of apps) out[a.id] = fetch ? await fetch(a) : null;
  return out;
}

describe('Roku: GET /query/icon/<id> (documented ECP)', () => {
  it('every app from the /query/apps fixture gets its LAN icon URL', async () => {
    const apps = read('roku', 'apps.xml');
    const fetch = fixtureFetch((url) => (url.endsWith('/query/apps') ? apps : url.endsWith('/query/device-info') ? read('roku', 'device-info.xml') : ''));
    const tv = new RokuDriver({ host: '192.168.1.33', fetch, now: () => 0 });
    await tv.connect();
    const icons = await iconsFor(tv);
    const ids = Object.keys(icons);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(icons[id]).toBe(`http://192.168.1.33:8060/query/icon/${encodeURIComponent(id)}`);
      expect(isDisplayableIconUri(icons[id]!)).toBe(true);
    }
  });
});

describe('Sony Bravia: icon URLs from appControl getApplicationList', () => {
  const sonyFetch = (appList: string) =>
    fixtureFetch((url, body) => {
      if (!body.startsWith('{')) return '';
      const m = (JSON.parse(body) as { method: string }).method;
      if (m === 'getApplicationList') return appList;
      if (m === 'getPowerStatus') return '{"result":[{"status":"active"}],"id":1}';
      if (m === 'getRemoteControllerInfo') return read('sony', 'remote-controller-info.json');
      if (m === 'getSystemInformation') return read('sony', 'system-information.json');
      return '{"result":[],"id":1}';
    });

  it('returns the TV-served icon URL where the list has one, none where it is empty or missing', async () => {
    const tv = new SonyDriver({ host: '192.168.1.88', fetch: sonyFetch(read('sony', 'application-list.json')), psk: '0000', now: () => 0 });
    await tv.connect();
    const icons = Object.values(await iconsFor(tv));
    expect(icons).toEqual([
      'http://192.168.1.88/DIAL/icon/com.netflix.ninja.png',
      'http://192.168.1.88/DIAL/icon/com.google.android.youtube.tv.png',
      'http://192.168.1.88/DIAL/icon/com.amazon.amazonvideo.livingroom.png',
      null,
      null,
    ]);
  });

  it('never returns an icon hosted off the LAN', async () => {
    const list = JSON.stringify({
      result: [
        [
          { title: 'Cloud', uri: 'com.sony.dtv.cloud', icon: 'https://cdn.example.com/icon.png' },
          { title: 'Local', uri: 'com.sony.dtv.local', icon: 'http://192.168.1.88/DIAL/icon/local.png' },
          { title: 'Path', uri: 'com.sony.dtv.path', icon: '/DIAL/icon/path.png' },
        ],
      ],
      id: 5,
    });
    const tv = new SonyDriver({ host: '192.168.1.88', fetch: sonyFetch(list), psk: '0000', now: () => 0 });
    await tv.connect();
    expect(await iconsFor(tv)).toEqual({
      'com.sony.dtv.cloud': null,
      'com.sony.dtv.local': 'http://192.168.1.88/DIAL/icon/local.png',
      'com.sony.dtv.path': null,
    });
  });
});

describe('platforms whose remote protocol exposes no app icons (typographic tile)', () => {
  it('Vizio SmartCast: static app table, no icon fetcher', async () => {
    const tv = new VizioDriver({ host: '192.168.1.60', fetch: fixtureFetch(() => '{}') });
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(driverIconFetch(tv)).toBeNull();
    expect(Object.values(await iconsFor(tv)).every((v) => v === null)).toBe(true);
  });

  it('Philips JointSpace: app list carries no icon (icons are binary behind Digest auth)', () => {
    const tv = new PhilipsDriver({ host: '192.168.1.70', fetch: fixtureFetch(() => '{}') });
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(driverIconFetch(tv)).toBeNull();
    const R = JSON.parse(read('philips', 'replies.json')) as Record<string, unknown>;
    const apps = parsePhilipsApps(JSON.stringify(R.applications));
    expect(apps.length).toBeGreaterThan(0);
    for (const a of apps) expect(Object.keys(a).some((k) => /icon/i.test(k))).toBe(false);
  });

  it('Android TV / Google TV (Remote v2): fixed app list, no icons', async () => {
    const identity = { certPem: 'CERT', keyPem: 'KEY', publicKey: { modulus: new Uint8Array([1]), exponent: new Uint8Array([1]) } } as unknown as ClientIdentity;
    const tv = new AndroidTvDriver({ host: '192.168.1.90', tls: async () => Promise.reject(new Error('unused')), identity });
    expect((await tv.listApps!()).map((a) => a.name)).toContain('Netflix'); // fixed list, launched by link (owner 1 Nov 2026)
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(driverIconFetch(tv)).toBeNull();
  });

  it('Infrared: no apps and no icons', () => {
    const tv = new IrDriver(IR_CODE_SETS.LG[0]!, { transmit: async () => {} });
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(driverIconFetch(tv)).toBeNull();
  });

  it('Demo TV: original demo art only, never a TV icon fetch', () => {
    const tv = new MockTv();
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(driverIconFetch(tv)).toBeNull();
  });

  it('the cache resolves a driver without a fetcher to "no icon" without calling anything', async () => {
    const c = new AppIconCache({ sleep: () => new Promise(() => {}) });
    expect(await c.get('tv', { id: 'x', name: 'X' }, driverIconFetch(new MockTv()))).toBeNull();
  });
});
