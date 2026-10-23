import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, FetchLike, WsLike } from '../driver';
import { KEYS } from '../keys';
import { DriverError } from '../types';
import {
  SAMSUNG_KEYS,
  SamsungDriver,
  base64Utf8,
  buildAppIconMessage,
  buildInstalledAppsMessage,
  buildKeyMessage,
  buildLaunchMessage,
  buildSamsungWsUrl,
  buildTextMessages,
  parseAppIconReply,
  parseFrame,
  parseInstalledApps,
  parseSamsungDeviceInfo,
  tokenFromConnect,
} from './samsung';

const FIX = join(__dirname, '__fixtures__', 'samsung');
const fx = (n: string): string => readFileSync(join(FIX, n), 'utf8');
const INFO_ON = fx('device-info-on.json');
const INFO_STANDBY = fx('device-info-standby.json');
const INFO_2017 = fx('device-info-2017.json');
const FRAMES = JSON.parse(fx('frames.json')) as Record<string, unknown>;
const frame = (k: string): string => JSON.stringify(FRAMES[k]);

const HOST = '192.168.1.52';

// ---------- fakes ----------

class FakeSock implements WsLike {
  sent: string[] = [];
  closed = false;
  private msg: ((d: string) => void)[] = [];
  private cls: (() => void)[] = [];
  send(d: string): void {
    if (this.closed) throw new Error('closed');
    this.sent.push(d);
  }
  close(): void {
    this.closed = true;
  }
  onMessage(cb: (d: string) => void): void {
    this.msg.push(cb);
  }
  onClose(cb: () => void): void {
    this.cls.push(cb);
  }
  receive(d: string): void {
    for (const m of this.msg) m(d);
  }
  serverClose(): void {
    this.closed = true;
    for (const c of this.cls) c();
  }
  get sentJson(): unknown[] {
    return this.sent.map((s) => JSON.parse(s) as unknown);
  }
}

type Script = (s: FakeSock) => void;

function fakeWs(script: Script = (s) => s.receive(frame('connect'))) {
  const opened: { url: string; opts?: { allowSelfSignedLan?: boolean }; sock: FakeSock }[] = [];
  const ws = async (url: string, opts?: { allowSelfSignedLan?: boolean }): Promise<WsLike> => {
    const sock = new FakeSock();
    opened.push({ url, opts, sock });
    setTimeout(() => script(sock), 0);
    return sock;
  };
  return { ws, opened };
}

function fakeFetch(body: string | Error = INFO_ON, status = 200) {
  const urls: string[] = [];
  const fetch: FetchLike = async (url) => {
    urls.push(url);
    if (body instanceof Error) throw body;
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  };
  return { fetch, urls };
}

function setup(o: { script?: Script; info?: string | Error; token?: string; mac?: string; wol?: (m: string) => Promise<void>; connectTimeoutMs?: number; timeoutMs?: number } = {}) {
  const w = fakeWs(o.script);
  const f = fakeFetch(o.info ?? INFO_ON);
  const tokens: string[] = [];
  const tv = new SamsungDriver({
    host: HOST,
    ws: w.ws,
    fetch: f.fetch,
    token: o.token,
    onToken: (t) => tokens.push(t),
    mac: o.mac,
    wol: o.wol,
    connectTimeoutMs: o.connectTimeoutMs ?? 200,
    timeoutMs: o.timeoutMs ?? 100,
  });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  return { tv, w, f, tokens, events, sock: () => w.opened[w.opened.length - 1]!.sock };
}

async function connected(o: Parameters<typeof setup>[0] = {}) {
  const s = setup(o);
  await s.tv.connect();
  return s;
}

async function rejection(p: Promise<unknown>): Promise<DriverError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DriverError);
    return e as DriverError;
  }
  throw new Error('expected rejection');
}

// ---------- pure builders ----------

describe('base64Utf8', () => {
  it('matches standard base64 with padding', () => {
    expect(base64Utf8('')).toBe('');
    expect(base64Utf8('f')).toBe('Zg==');
    expect(base64Utf8('fo')).toBe('Zm8=');
    expect(base64Utf8('foo')).toBe('Zm9v');
    expect(base64Utf8('Couch Remote')).toBe('Q291Y2ggUmVtb3Rl');
  });
  it('encodes UTF-8 bytes', () => {
    expect(base64Utf8('é')).toBe('w6k=');
    expect(base64Utf8('Café ☕')).toBe(Buffer.from('Café ☕', 'utf8').toString('base64'));
  });
});

describe('buildSamsungWsUrl', () => {
  it('builds the remote channel URL with a base64 name', () => {
    expect(buildSamsungWsUrl(HOST, 'Couch Remote')).toBe(
      'wss://192.168.1.52:8002/api/v2/channels/samsung.remote.control?name=Q291Y2ggUmVtb3Rl',
    );
  });
  it('percent-encodes base64 padding and appends the token', () => {
    expect(buildSamsungWsUrl(HOST, 'Couch', '12345678')).toBe(
      'wss://192.168.1.52:8002/api/v2/channels/samsung.remote.control?name=Q291Y2g%3D&token=12345678',
    );
  });
  it('omits an empty token', () => {
    expect(buildSamsungWsUrl(HOST, 'a', '')).not.toContain('token');
  });
});

describe('message builders', () => {
  it('builds Click/Press/Release key frames', () => {
    expect(JSON.parse(buildKeyMessage('KEY_HOME'))).toEqual({
      method: 'ms.remote.control',
      params: { Cmd: 'Click', DataOfCmd: 'KEY_HOME', Option: 'false', TypeOfRemote: 'SendRemoteKey' },
    });
    expect((JSON.parse(buildKeyMessage('KEY_UP', 'Press')) as { params: { Cmd: string } }).params.Cmd).toBe('Press');
    expect((JSON.parse(buildKeyMessage('KEY_UP', 'Release')) as { params: { Cmd: string } }).params.Cmd).toBe('Release');
  });

  it('builds SendInputString + SendInputEnd', () => {
    const [a, b] = buildTextMessages('hi ☕');
    expect(JSON.parse(a)).toEqual({
      method: 'ms.remote.control',
      params: { Cmd: base64Utf8('hi ☕'), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' },
    });
    expect(JSON.parse(b)).toEqual({ method: 'ms.remote.control', params: { TypeOfRemote: 'SendInputEnd' } });
  });

  it('builds app launch and app list frames', () => {
    expect(JSON.parse(buildLaunchMessage('3201907018807'))).toEqual({
      method: 'ms.channel.emit',
      params: { event: 'ed.apps.launch', to: 'host', data: { appId: '3201907018807', action_type: 'DEEP_LINK', metaTag: '' } },
    });
    expect((JSON.parse(buildLaunchMessage('x', 'NATIVE_LAUNCH')) as { params: { data: { action_type: string } } }).params.data.action_type).toBe(
      'NATIVE_LAUNCH',
    );
    expect(JSON.parse(buildInstalledAppsMessage())).toEqual({
      method: 'ms.channel.emit',
      params: { event: 'ed.installedApp.get', to: 'host' },
    });
  });

  it('maps every canonical key except BACKSPACE, SEARCH and VOICE to a KEY_* code', () => {
    for (const k of KEYS) {
      if (k === 'BACKSPACE' || k === 'SEARCH' || k === 'VOICE') expect(SAMSUNG_KEYS[k]).toBeUndefined();
      else expect(SAMSUNG_KEYS[k]).toMatch(/^KEY_[A-Z0-9]+$/);
    }
    expect(SAMSUNG_KEYS.OK).toBe('KEY_ENTER');
    expect(SAMSUNG_KEYS.BACK).toBe('KEY_RETURN');
    expect(SAMSUNG_KEYS.INPUT).toBe('KEY_SOURCE');
    expect(SAMSUNG_KEYS.VOL_UP).toBe('KEY_VOLUP');
    expect(SAMSUNG_KEYS.CH_DOWN).toBe('KEY_CHDOWN');
  });
});

describe('parsers', () => {
  it('parses device info (on)', () => {
    expect(parseSamsungDeviceInfo(INFO_ON)).toEqual({
      name: 'Samsung Q60 Series (55)',
      model: 'QN55Q60TAFXZA',
      modelName: 'QN55Q60TAFXZA',
      wifiMac: 'f8:77:b8:a1:c2:d3',
      powerState: 'on',
      tokenAuthSupport: true,
      os: 'Tizen',
      ip: '192.168.1.52',
      id: 'uuid:0ee6a5d4-00ab-1000-8f2c-f877b8a1c2d3',
    });
  });
  it('parses standby', () => {
    expect(parseSamsungDeviceInfo(INFO_STANDBY).powerState).toBe('standby');
  });
  it('parses an older model (TokenAuthSupport only in isSupport, no PowerState)', () => {
    const i = parseSamsungDeviceInfo(INFO_2017);
    expect(i.name).toBe('Bedroom TV');
    expect(i.tokenAuthSupport).toBe(true);
    expect(i.powerState).toBeUndefined();
    expect(i.wifiMac).toBe('5c:49:7d:00:11:22');
  });
  it('throws on invalid JSON', () => {
    expect(() => parseSamsungDeviceInfo('<html>')).toThrow();
  });
  it('parses frames and tokens', () => {
    expect(parseFrame('nope')).toBeNull();
    expect(parseFrame('{"x":1}')).toBeNull();
    expect(tokenFromConnect(parseFrame(frame('connect'))!)).toBe('12345678');
    expect(tokenFromConnect(parseFrame(frame('connectNoToken'))!)).toBeUndefined();
  });
  it('parses installed apps, skipping malformed entries', () => {
    const apps = parseInstalledApps((FRAMES.installedApps as { data: unknown }).data);
    expect(apps.map((a) => [a.id, a.name, a.appType])).toEqual([
      ['3201907018807', 'Netflix', 2],
      ['111299001912', 'YouTube', 2],
      ['org.tizen.browser', 'Internet', 4],
    ]);
    expect(parseInstalledApps(null)).toEqual([]);
  });
});

// ---------- driver ----------

describe('SamsungDriver connect', () => {
  it('fetches device info, opens WSS with allowSelfSignedLan and persists the token', async () => {
    const s = await connected();
    expect(s.f.urls).toEqual(['http://192.168.1.52:8001/api/v2/']);
    expect(s.w.opened[0]!.url).toBe(buildSamsungWsUrl(HOST, 'Couch Remote'));
    expect(s.w.opened[0]!.opts).toEqual({ allowSelfSignedLan: true });
    expect(s.tokens).toEqual(['12345678']);
    expect(s.tv.token).toBe('12345678');
    expect(s.events.filter((e) => e.type === 'state').map((e) => (e as { state: string }).state)).toEqual([
      'connecting',
      'connected',
    ]);
  });

  it('reuses a stored token in the URL and does not re-emit an unchanged token', async () => {
    const s = await connected({ token: '12345678' });
    expect(s.w.opened[0]!.url).toContain('&token=12345678');
    expect(s.tokens).toEqual([]);
  });

  it('connects without a token on models without token auth', async () => {
    const s = await connected({ script: (k) => k.receive(frame('connectNoToken')) });
    expect(s.tokens).toEqual([]);
    expect(s.tv.token).toBeUndefined();
  });

  it('ignores unrelated frames before the handshake', async () => {
    const s = await connected({
      script: (k) => {
        k.receive('garbage');
        k.receive(frame('clientConnect'));
        k.receive(frame('connect'));
      },
    });
    expect(s.tokens).toEqual(['12345678']);
  });

  it('maps ms.channel.unauthorized to pair_required and closes the socket', async () => {
    const s = setup({ script: (k) => k.receive(frame('unauthorized')) });
    const e = await rejection(s.tv.connect());
    expect(e.code).toBe('pair_required');
    expect(s.sock().closed).toBe(true);
    expect(s.events.some((x) => x.type === 'state' && x.state === 'error')).toBe(true);
  });

  it('maps ms.channel.timeOut to timeout', async () => {
    const s = setup({ script: (k) => k.receive(frame('promptTimeout')) });
    expect((await rejection(s.tv.connect())).code).toBe('timeout');
  });

  it('times out when the TV never answers', async () => {
    const s = setup({ script: () => undefined, connectTimeoutMs: 30 });
    expect((await rejection(s.tv.connect())).code).toBe('timeout');
    expect(s.sock().closed).toBe(true);
  });

  it('maps an early close to network', async () => {
    const s = setup({ script: (k) => k.serverClose() });
    expect((await rejection(s.tv.connect())).code).toBe('network');
  });

  it('maps an unreachable TV to network without opening a socket', async () => {
    const s = setup({ info: new Error('ECONNREFUSED') });
    expect((await rejection(s.tv.connect())).code).toBe('network');
    expect(s.w.opened).toHaveLength(0);
  });

  it('reports off in network standby without opening the channel', async () => {
    const s = await connected({ info: INFO_STANDBY });
    expect(s.w.opened).toHaveLength(0);
    expect(s.events.some((x) => x.type === 'state' && x.state === 'off')).toBe(true);
    expect((await rejection(s.tv.sendKey('HOME'))).code).toBe('tv_off');
  });

  it('emits disconnected when the TV closes the channel', async () => {
    const s = await connected();
    s.sock().serverClose();
    expect(s.events[s.events.length - 1]).toEqual({ type: 'state', state: 'disconnected' });
    expect((await rejection(s.tv.sendKey('UP'))).code).toBe('not_connected');
  });
});

describe('SamsungDriver commands', () => {
  it('requires a connection', async () => {
    const s = setup();
    expect((await rejection(s.tv.sendKey('UP'))).code).toBe('not_connected');
  });

  it('sends Click frames for keys', async () => {
    const s = await connected();
    await s.tv.sendKey('OK');
    await s.tv.sendKey('BACK');
    await s.tv.sendKey('INPUT');
    expect(s.sock().sentJson.map((m) => (m as { params: { DataOfCmd: string } }).params.DataOfCmd)).toEqual([
      'KEY_ENTER',
      'KEY_RETURN',
      'KEY_SOURCE',
    ]);
    expect(s.events.filter((e) => e.type === 'sent').map((e) => (e as { what: string }).what)).toEqual(['OK', 'BACK', 'INPUT']);
  });

  it('toggles KEY_PLAY / KEY_PAUSE', async () => {
    const s = await connected();
    await s.tv.sendKey('PLAY_PAUSE');
    await s.tv.sendKey('PLAY_PAUSE');
    await s.tv.sendKey('PLAY_PAUSE');
    expect(s.sock().sent).toEqual([buildKeyMessage('KEY_PLAY'), buildKeyMessage('KEY_PAUSE'), buildKeyMessage('KEY_PLAY')]);
  });

  it('rejects unmapped keys as unsupported', async () => {
    const s = await connected();
    expect((await rejection(s.tv.sendKey('SEARCH'))).code).toBe('unsupported');
    expect(s.sock().sent).toEqual([]);
  });

  it('sends Press/Release for hold', async () => {
    const s = await connected();
    await s.tv.keyDown('VOL_UP');
    await s.tv.keyUp('VOL_UP');
    expect(s.sock().sent).toEqual([buildKeyMessage('KEY_VOLUP', 'Press'), buildKeyMessage('KEY_VOLUP', 'Release')]);
  });

  it('sends text as SendInputString + SendInputEnd and tracks the IME', async () => {
    const s = await connected();
    s.sock().receive(frame('imeStart'));
    expect(s.tv.imeActive).toBe(true);
    await s.tv.sendText('stranger things');
    expect(s.sock().sent).toEqual(buildTextMessages('stranger things'));
    s.sock().receive(frame('imeEnd'));
    expect(s.tv.imeActive).toBe(false);
  });

  it('lists apps via ed.installedApp.get and launches with the matching action type', async () => {
    const s = await connected();
    const p = s.tv.listApps();
    expect(s.sock().sent).toEqual([buildInstalledAppsMessage()]);
    s.sock().receive(frame('clientConnect'));
    s.sock().receive(frame('installedApps'));
    const apps = await p;
    expect(apps.map((a) => a.id)).toEqual(['3201907018807', '111299001912', 'org.tizen.browser']);
    await s.tv.launchApp('3201907018807');
    await s.tv.launchApp('org.tizen.browser');
    await s.tv.launchApp('unknown.app');
    expect(s.sock().sent.slice(1)).toEqual([
      buildLaunchMessage('3201907018807', 'DEEP_LINK'),
      buildLaunchMessage('org.tizen.browser', 'NATIVE_LAUNCH'),
      buildLaunchMessage('unknown.app', 'DEEP_LINK'),
    ]);
  });

  it('times out an unanswered app list', async () => {
    const s = await connected({ timeoutMs: 20 });
    expect((await rejection(s.tv.listApps())).code).toBe('timeout');
  });

  it('rejects a pending app list on disconnect', async () => {
    const s = await connected();
    const p = s.tv.listApps();
    await s.tv.disconnect();
    expect((await rejection(p)).code).toBe('not_connected');
    expect(s.sock().closed).toBe(true);
  });
});

describe('SamsungDriver powerOn', () => {
  it('uses Wake-on-LAN with the device-info MAC', async () => {
    const macs: string[] = [];
    const s = await connected({ info: INFO_STANDBY, wol: async (m) => void macs.push(m) });
    await s.tv.sendKey('POWER');
    expect(macs).toEqual(['f8:77:b8:a1:c2:d3']);
    expect(s.events.some((e) => e.type === 'sent' && e.what === 'POWER_ON')).toBe(true);
  });

  it('prefers an explicitly stored MAC', async () => {
    const macs: string[] = [];
    const s = setup({ mac: 'aa:bb:cc:dd:ee:ff', wol: async (m) => void macs.push(m) });
    await s.tv.powerOn();
    expect(macs).toEqual(['aa:bb:cc:dd:ee:ff']);
  });

  it('falls back to KEY_POWER over an open channel', async () => {
    const s = await connected();
    await s.tv.powerOn();
    expect(s.sock().sent).toEqual([buildKeyMessage('KEY_POWER')]);
  });

  it('is unsupported with no MAC and no channel', async () => {
    const s = setup();
    expect((await rejection(s.tv.powerOn())).code).toBe('unsupported');
  });

  it('maps a WOL failure to network', async () => {
    const s = setup({ mac: 'aa:bb:cc:dd:ee:ff', wol: async () => Promise.reject(new Error('EPERM')) });
    expect((await rejection(s.tv.powerOn())).code).toBe('network');
  });
});

// ---------- app icons (ed.apps.icon, UNVERIFIED reconstructed frames) ----------

const ICON_FRAMES = JSON.parse(fx('icon-frames.json')) as Record<string, unknown>;
const iconFrame = (k: string): string => JSON.stringify(ICON_FRAMES[k]);
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPI6/nwHwAGQALqgCqx2gAAAABJRU5ErkJggg==';
const APP_PATH = '/opt/share/webappservice/apps_icon/FirstScreen/111299001912/250x250.png';

describe('Samsung app icon builders', () => {
  it('builds ed.apps.icon with the iconPath', () => {
    expect(JSON.parse(buildAppIconMessage(APP_PATH))).toEqual({
      method: 'ms.channel.emit',
      params: { event: 'ed.apps.icon', to: 'host', data: { iconPath: APP_PATH } },
    });
  });

  it('parses the reply into a data: URI, flat or nested, ignoring line breaks', () => {
    expect(parseAppIconReply(parseFrame(iconFrame('icon'))!.data, APP_PATH)).toBe(`data:image/png;base64,${PNG_B64}`);
    expect(parseAppIconReply(parseFrame(iconFrame('iconWrapped'))!.data, APP_PATH)).toBe(
      `data:image/png;base64,${PNG_B64}`,
    );
    expect(parseAppIconReply({ imageBase64: '/9j/4AAQSkZJRg==' })).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  });

  it('returns null for empty, malformed or mismatched replies', () => {
    expect(parseAppIconReply(parseFrame(iconFrame('iconEmpty'))!.data, APP_PATH)).toBeNull();
    expect(parseAppIconReply(parseFrame(iconFrame('iconOtherPath'))!.data, APP_PATH)).toBeNull();
    expect(parseAppIconReply({ imageBase64: 'not base64!' })).toBeNull();
    expect(parseAppIconReply(null)).toBeNull();
    expect(parseAppIconReply('')).toBeNull();
    expect(parseAppIconReply([])).toBeNull();
    expect(parseAppIconReply({ imageBase64: 42 })).toBeNull();
  });
});

describe('SamsungDriver appIcon', () => {
  async function withApps(o: Parameters<typeof setup>[0] = {}) {
    const s = await connected(o);
    const p = s.tv.listApps();
    s.sock().receive(frame('installedApps'));
    await p;
    s.sock().sent.length = 0;
    return s;
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('advertises appIcons', () => {
    expect(setup().tv.capabilities.has('appIcons')).toBe(true);
  });

  it('asks for the icon path from the app list and returns a data: URI', async () => {
    const s = await withApps();
    const p = s.tv.appIcon({ id: '111299001912', name: 'App B' });
    await flush();
    expect(s.sock().sent).toEqual([buildAppIconMessage(APP_PATH)]);
    s.sock().receive(iconFrame('icon'));
    expect(await p).toBe(`data:image/png;base64,${PNG_B64}`);
  });

  it('returns null without sending when the app has no icon path', async () => {
    const s = await withApps();
    expect(await s.tv.appIcon({ id: 'org.tizen.browser', name: 'Internet' })).toBeNull();
    expect(await s.tv.appIcon({ id: 'unknown', name: 'Unknown' })).toBeNull();
    expect(s.sock().sent).toEqual([]);
  });

  it('returns null on timeout and emits no error', async () => {
    const s = await withApps({ timeoutMs: 20 });
    s.events.length = 0;
    expect(await s.tv.appIcon({ id: '111299001912', name: 'App B' })).toBeNull();
    expect(s.events.some((e) => e.type === 'error')).toBe(false);
  });

  it('returns null when not connected', async () => {
    expect(await setup().tv.appIcon({ id: '111299001912', name: 'App B' })).toBeNull();
  });

  it('serialises requests so each reply matches its request', async () => {
    const s = await withApps();
    const a = s.tv.appIcon({ id: '111299001912', name: 'App B' });
    const b = s.tv.appIcon({ id: '3201907018807', name: 'App A' });
    await flush();
    expect(s.sock().sent).toHaveLength(1);
    s.sock().receive(iconFrame('icon'));
    expect(await a).toBe(`data:image/png;base64,${PNG_B64}`);
    await flush();
    expect(s.sock().sent).toHaveLength(2);
    expect(JSON.parse(s.sock().sent[1]!)).toMatchObject({
      params: { data: { iconPath: expect.stringContaining('3201907018807') } },
    });
    s.sock().receive(iconFrame('iconOtherPath'));
    expect(await b).toBe(`data:image/png;base64,${PNG_B64}`);
  });
});
