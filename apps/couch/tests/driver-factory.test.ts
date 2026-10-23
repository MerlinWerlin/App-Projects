/**
 * D4-1: the driver factory never throws and degrades to "coming soon" when a native transport is
 * missing. In tests the lan-wss module is absent, exactly like Expo Go.
 */
import { driverFor, isSupported } from '../src/core/addTv';
import { createDemoSession } from '../src/core/demo';
import type { FetchLike, WsFactory } from '../src/core/driver';
import { IrDriver } from '../src/core/drivers/ir';
import { MockTv } from '../src/core/drivers/mock';
import { RokuDriver } from '../src/core/drivers/roku';
import { SamsungDriver } from '../src/core/drivers/samsung';
import { SonyDriver } from '../src/core/drivers/sony';
import { WebOsDriver } from '../src/core/drivers/webos';
import { loadLanWssFactory } from '../src/native/lanWss';
import { appTransport } from '../src/native/transport';

const fetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => '' });
const ws: WsFactory = async () => {
  throw new Error('not used');
};
const host = '192.168.1.5';

describe('appTransport without the lan-wss module', () => {
  it('has fetch but no ws', () => {
    expect(loadLanWssFactory()).toBeNull();
    const t = appTransport();
    expect(typeof t.fetch).toBe('function');
    expect(t.ws).toBeUndefined();
    expect('ws' in t).toBe(false);
    expect('ir' in t).toBe(false);
  });

  it('driverFor: mock -> MockTv, roku -> RokuDriver, samsung -> null without throwing', () => {
    const t = appTransport();
    expect(driverFor({ platform: 'mock', host }, t)).toBeInstanceOf(MockTv);
    expect(driverFor({ platform: 'roku', host }, t)).toBeInstanceOf(RokuDriver);
    expect(() => driverFor({ platform: 'samsung', host }, t)).not.toThrow();
    expect(driverFor({ platform: 'samsung', host }, t)).toBeNull();
    expect(isSupported('samsung', t)).toBe(false);
    expect(isSupported('roku', t)).toBe(true);
  });

  it('other platforms stay null (coming soon)', () => {
    const t = appTransport();
    for (const platform of ['webos', 'androidtv', 'firetv', 'vizio', 'philips', 'ir'] as const) {
      expect(driverFor({ platform, host }, t)).toBeNull();
      expect(isSupported(platform, t)).toBe(false);
    }
  });
});

describe('driverFor with a ws factory (dev build)', () => {
  it('wires SamsungDriver when fetch and ws are both present', () => {
    const d = driverFor({ platform: 'samsung', host, token: 'tok1' }, { fetch, ws });
    expect(d).toBeInstanceOf(SamsungDriver);
    expect((d as SamsungDriver).token).toBe('tok1');
    expect((d as SamsungDriver).wsUrl).toContain(`wss://${host}:8002/`);
    expect(isSupported('samsung', { fetch, ws })).toBe(true);
  });

  it('samsung needs fetch too', () => {
    expect(driverFor({ platform: 'samsung', host }, { ws })).toBeNull();
    expect(isSupported('samsung', { ws })).toBe(false);
  });
});

describe('driverFor with an IR transmitter', () => {
  it("rebuilds the IR driver from a saved TV's irBrand / irSet", () => {
    const ir = { transmit: async (): Promise<void> => {} };
    expect(driverFor({ platform: 'ir', host: '', irBrand: 'Samsung', irSet: 1 }, { fetch, ir })).toBeInstanceOf(IrDriver);
    expect(driverFor({ platform: 'ir', host: '', irBrand: 'Samsung', irSet: 1 }, appTransport())).toBeNull();
  });
});

describe('demo session', () => {
  it('still yields MockTv drivers', async () => {
    const demo = await createDemoSession({ sleep: async () => {}, random: () => 0.5 });
    expect(demo.drivers.size).toBe(demo.tvs.length);
    for (const d of demo.drivers.values()) expect(d).toBeInstanceOf(MockTv);
  });
});

describe('webOS wiring (run 3)', () => {
  it('webos needs only a ws transport and is null without lan-wss', () => {
    expect(driverFor({ platform: 'webos', host: '192.168.1.60' }, {})).toBeNull();
    expect(isSupported('webos', {})).toBe(false);
    const ws: WsFactory = async () => ({ send() {}, close() {}, onMessage() {}, onClose() {} });
    expect(driverFor({ platform: 'webos', host: '192.168.1.60', token: 'k' }, { ws })).toBeInstanceOf(WebOsDriver);
    expect(isSupported('webos', { ws })).toBe(true);
  });
});

describe('Sony wiring (T30)', () => {
  it('sony needs fetch and a saved Pre-Shared Key (Tv.token)', () => {
    const t = appTransport();
    expect(isSupported('sony', t)).toBe(true);
    expect(isSupported('sony', {})).toBe(false);
    expect(() => driverFor({ platform: 'sony', host }, t)).not.toThrow();
    expect(driverFor({ platform: 'sony', host }, t)).toBeNull();
    expect(driverFor({ platform: 'sony', host, token: '0000' }, {})).toBeNull();
    const d = driverFor({ platform: 'sony', host, token: '0000', mac: 'a0:c4:a5:e1:b2:c3' }, { fetch });
    expect(d).toBeInstanceOf(SonyDriver);
    expect((d as SonyDriver).base).toBe(`http://${host}`);
  });

  it('sends the saved key as X-Auth-PSK; a refusal is forbidden', async () => {
    const seen: (string | undefined)[] = [];
    const f: FetchLike = async (_url, init) => {
      seen.push(init?.headers?.['X-Auth-PSK']);
      return { status: 403, ok: false, text: async () => '' };
    };
    const d = driverFor({ platform: 'sony', host, token: 'k3y' }, { fetch: f });
    if (!d) throw new Error('expected a driver');
    await expect(d.connect()).rejects.toMatchObject({ code: 'forbidden' });
    expect(seen[0]).toBe('k3y');
  });
});
