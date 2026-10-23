import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, WsLike } from '../driver';
import { KEYS } from '../keys';
import { DriverError } from '../types';
import {
  WEBOS_BUTTONS,
  WEBOS_MANIFEST,
  WEBOS_REGISTER_ID,
  WEBOS_SSAP_KEYS,
  WEBOS_URI,
  WebOsDriver,
  buildButtonFrame,
  buildClickFrame,
  buildMoveFrame,
  buildRegisterMessage,
  buildRequest,
  buildScrollFrame,
  buildWebOsUrl,
  clientKeyFrom,
  errorFromSsap,
  parseInputList,
  parseLaunchPoints,
  parseSsap,
  parseVolume,
} from './webos';

const FIX = join(__dirname, '__fixtures__', 'webos');
const FRAMES = JSON.parse(readFileSync(join(FIX, 'frames.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const frame = (k: string, id?: string): string => {
  const f = FRAMES[k];
  if (!f) throw new Error(`no fixture ${k}`);
  return JSON.stringify(id === undefined ? f : { ...f, id });
};
const payloadOf = (k: string): unknown => FRAMES[k]!.payload;

const HOST = '192.168.1.77';
const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const POINTER_URL = (FRAMES.pointerSocket!.payload as { socketPath: string }).socketPath;

// ---------- fakes ----------

interface Req {
  id: string;
  type: string;
  uri?: string;
  payload?: Record<string, unknown>;
}

class FakeSock implements WsLike {
  sent: string[] = [];
  closed = false;
  onSent: ((d: string) => void) | null = null;
  private msg: ((d: string) => void)[] = [];
  private cls: (() => void)[] = [];
  send(d: string): void {
    if (this.closed) throw new Error('closed');
    this.sent.push(d);
    const h = this.onSent;
    if (h) setTimeout(() => h(d), 0);
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
  get requests(): Req[] {
    return this.sent.map((s) => JSON.parse(s) as Req).filter((r) => r.type === 'request');
  }
  get uris(): string[] {
    return this.requests.map((r) => r.uri!);
  }
}

/** register script runs after the register message arrives; responses map uri -> fixture key (null: no reply). */
interface SetupOpts {
  register?: (s: FakeSock) => void;
  responses?: Record<string, string | null>;
  failUrls?: (url: string) => boolean;
  clientKey?: string;
  mac?: string;
  wol?: (m: string) => Promise<void>;
  connectTimeoutMs?: number;
  timeoutMs?: number;
  legacyFallback?: boolean;
}

function setup(o: SetupOpts = {}) {
  const opened: { url: string; opts?: { allowSelfSignedLan?: boolean }; sock: FakeSock }[] = [];
  const responses: Record<string, string | null> = { [WEBOS_URI.pointerSocket]: 'pointerSocket', ...o.responses };
  const ws = async (url: string, opts?: { allowSelfSignedLan?: boolean }): Promise<WsLike> => {
    if (o.failUrls?.(url)) throw new Error('ECONNREFUSED');
    const sock = new FakeSock();
    opened.push({ url, opts, sock });
    if (!url.includes('netinput.pointer.sock')) {
      sock.onSent = (d) => {
        const m = JSON.parse(d) as Req;
        if (m.type === 'register') {
          (o.register ?? ((s: FakeSock) => s.receive(frame('registered'))))(sock);
          return;
        }
        if (m.type !== 'request') return;
        const k = m.uri! in responses ? responses[m.uri!] : 'ok';
        if (k) sock.receive(frame(k, m.id));
      };
    }
    return sock;
  };
  const keys: string[] = [];
  const tv = new WebOsDriver({
    host: HOST,
    ws,
    clientKey: o.clientKey,
    onClientKey: (k) => keys.push(k),
    mac: o.mac,
    wol: o.wol,
    connectTimeoutMs: o.connectTimeoutMs ?? 200,
    timeoutMs: o.timeoutMs ?? 100,
    legacyFallback: o.legacyFallback,
  });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  const main = () => opened.find((x) => !x.url.includes('netinput'))!.sock;
  const pointer = () => opened.filter((x) => x.url.includes('netinput')).pop()?.sock;
  return { tv, opened, keys, events, responses, main, pointer };
}

async function connected(o: SetupOpts = {}) {
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

const sentWhat = (ev: DriverEvent[]) => ev.filter((e) => e.type === 'sent').map((e) => (e as { what: string }).what);

// ---------- pure builders ----------

describe('webOS builders', () => {
  it('builds the wss and legacy ws URLs', () => {
    expect(buildWebOsUrl(HOST, true)).toBe('wss://192.168.1.77:3001');
    expect(buildWebOsUrl(HOST, false)).toBe('ws://192.168.1.77:3000');
  });

  it('builds register with the PROMPT manifest, adding the client-key only when known', () => {
    const a = JSON.parse(buildRegisterMessage()) as { type: string; id: string; payload: Record<string, unknown> };
    expect(a.type).toBe('register');
    expect(a.id).toBe(WEBOS_REGISTER_ID);
    expect(a.payload.pairingType).toBe('PROMPT');
    expect(a.payload.forcePairing).toBe(false);
    expect(a.payload['client-key']).toBeUndefined();
    expect(a.payload.manifest).toEqual(JSON.parse(JSON.stringify(WEBOS_MANIFEST)));
    const b = JSON.parse(buildRegisterMessage(KEY)) as { payload: Record<string, unknown> };
    expect(b.payload['client-key']).toBe(KEY);
  });

  it('manifest asks for the permissions the driver uses', () => {
    const perms = [...WEBOS_MANIFEST.permissions, ...WEBOS_MANIFEST.signed.permissions] as string[];
    for (const p of ['LAUNCH', 'CONTROL_AUDIO', 'CONTROL_POWER', 'CONTROL_INPUT_TV', 'READ_INPUT_DEVICE_LIST', 'READ_RUNNING_APPS', 'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD', 'READ_INSTALLED_APPS']) {
      expect(perms).toContain(p);
    }
    expect(WEBOS_MANIFEST.signatures[0].signatureVersion).toBe(1);
  });

  it('builds requests', () => {
    expect(JSON.parse(buildRequest('couch_1', WEBOS_URI.launch, { id: 'netflix' }))).toEqual({
      id: 'couch_1',
      type: 'request',
      uri: 'ssap://system.launcher/launch',
      payload: { id: 'netflix' },
    });
    expect(JSON.parse(buildRequest('couch_2', WEBOS_URI.turnOff))).toEqual({ id: 'couch_2', type: 'request', uri: 'ssap://system/turnOff' });
  });

  it('builds pointer frames', () => {
    expect(buildButtonFrame('UP')).toBe('type:button\nname:UP\n\n');
    expect(buildMoveFrame(3.4, -2.6)).toBe('type:move\ndx:3\ndy:-3\ndown:0\n\n');
    expect(buildMoveFrame(1, 1, true)).toBe('type:move\ndx:1\ndy:1\ndown:1\n\n');
    expect(buildClickFrame()).toBe('type:click\n\n');
    expect(buildScrollFrame(0, 2)).toBe('type:scroll\ndx:0\ndy:2\n\n');
  });

  it('maps every canonical key except INPUT, SOURCE, SEARCH and VOICE', () => {
    const unmapped = ['INPUT', 'SOURCE', 'SEARCH', 'VOICE'];
    for (const k of KEYS) {
      const mapped = WEBOS_SSAP_KEYS[k] !== undefined || WEBOS_BUTTONS[k] !== undefined;
      expect([k, mapped]).toEqual([k, !unmapped.includes(k)]);
    }
    expect(WEBOS_BUTTONS.OK).toBe('ENTER');
    expect(WEBOS_BUTTONS.SETTINGS).toBe('MENU');
    expect(WEBOS_BUTTONS.CH_UP).toBe('CHANNELUP');
    expect(WEBOS_BUTTONS.NUM_7).toBe('7');
    expect(WEBOS_BUTTONS.NUM_DASH).toBe('DASH');
    expect(WEBOS_SSAP_KEYS.POWER!.uri).toBe('ssap://system/turnOff');
    expect(WEBOS_SSAP_KEYS.VOL_UP!.uri).toBe('ssap://audio/volumeUp');
  });
});

describe('webOS parsers', () => {
  it('parses SSAP frames', () => {
    expect(parseSsap('nope')).toBeNull();
    expect(parseSsap('{"id":"x"}')).toBeNull();
    expect(parseSsap('[1]')).toBeNull();
    expect(parseSsap(frame('ok', 'couch_3'))).toEqual({ type: 'response', id: 'couch_3', payload: { returnValue: true } });
    expect(parseSsap('{"type":"response","id":7}')!.id).toBe('7');
    expect(clientKeyFrom(parseSsap(frame('registered'))!)).toBe(KEY);
    expect(clientKeyFrom(parseSsap(frame('registerPrompt'))!)).toBeUndefined();
  });

  it('maps SSAP errors', () => {
    expect(errorFromSsap('403 User denied access', true).code).toBe('pair_required');
    expect(errorFromSsap('403 cancelled', true).code).toBe('pair_required');
    expect(errorFromSsap('401 insufficient permissions').code).toBe('forbidden');
    expect(errorFromSsap('404 no such service or method').code).toBe('unsupported');
    expect(errorFromSsap('500 Application error').code).toBe('network');
    expect(errorFromSsap(undefined).code).toBe('network');
  });

  it('parses launch points with TV icon URLs, skipping malformed and duplicate entries', () => {
    expect(parseLaunchPoints(payloadOf('launchPoints'))).toEqual([
      {
        id: 'netflix',
        name: 'Netflix',
        icon: 'http://192.168.1.77:3000/resources/0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a/bmV0ZmxpeF8xMzB4MTMwLnBuZw==.png',
      },
      {
        id: 'youtube.leanback.v4',
        name: 'YouTube',
        icon: 'http://192.168.1.77:3000/resources/1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d/eW91dHViZV84MHg4MC5wbmc=.png',
      },
      { id: 'com.webos.app.livetv', name: 'Live TV' },
    ]);
    expect(parseLaunchPoints(payloadOf('apps')).map((a) => a.id)).toEqual(['com.webos.app.browser']);
    expect(parseLaunchPoints(null)).toEqual([]);
    expect(parseLaunchPoints({ launchPoints: [{ id: 'x', icon: 'file:///etc/passwd' }] })).toEqual([{ id: 'x', name: 'x' }]);
  });

  it('parses the external input list', () => {
    expect(parseInputList(payloadOf('inputList'))).toEqual([
      { id: 'HDMI_1', name: 'HDMI 1', appId: 'com.webos.app.hdmi1' },
      { id: 'HDMI_2', name: 'Game console', appId: 'com.webos.app.hdmi2' },
      { id: 'AV_1', name: 'AV', appId: 'com.webos.app.externalinput.av1' },
    ]);
    expect(parseInputList({ devices: [{ id: 'HDMI_3' }] })).toEqual([{ id: 'HDMI_3', name: 'HDMI 3' }]);
    expect(parseInputList({})).toEqual([]);
  });

  it('parses both volume shapes', () => {
    expect(parseVolume(payloadOf('volumeLegacy'))).toBe(14);
    expect(parseVolume(payloadOf('volumeStatus'))).toBe(23);
    expect(parseVolume({ returnValue: true })).toBeNull();
    expect(parseVolume(null)).toBeNull();
  });
});

// ---------- driver: connect / pairing ----------

describe('WebOsDriver connect', () => {
  it('opens wss :3001 with allowSelfSignedLan, registers, persists the client-key and opens the pointer socket', async () => {
    const s = await connected();
    expect(s.opened[0]!.url).toBe('wss://192.168.1.77:3001');
    expect(s.opened[0]!.opts).toEqual({ allowSelfSignedLan: true });
    expect(s.main().sent[0]).toBe(buildRegisterMessage());
    expect(s.keys).toEqual([KEY]);
    expect(s.tv.clientKey).toBe(KEY);
    expect(s.tv.secure).toBe(true);
    expect(s.main().uris).toEqual([WEBOS_URI.pointerSocket]);
    expect(s.opened[1]!.url).toBe(POINTER_URL);
    expect(s.opened[1]!.opts).toEqual({ allowSelfSignedLan: true });
    expect(s.events.filter((e) => e.type === 'state').map((e) => (e as { state: string }).state)).toEqual(['connecting', 'connected']);
  });

  it('sends a stored client-key and does not re-emit it', async () => {
    const s = await connected({ clientKey: KEY });
    expect(s.main().sent[0]).toBe(buildRegisterMessage(KEY));
    expect(s.keys).toEqual([]);
  });

  it('waits through the Allow prompt and ignores unrelated frames', async () => {
    let seenPrompting = false;
    const s = setup({
      register: (k) => {
        k.receive('garbage');
        k.receive(frame('hello'));
        k.receive(frame('registerPrompt'));
        setTimeout(() => {
          seenPrompting = s.tv.prompting;
          k.receive(frame('ok', 'other_1'));
          k.receive(frame('registered'));
        }, 10);
      },
    });
    await s.tv.connect();
    expect(seenPrompting).toBe(true);
    expect(s.tv.prompting).toBe(false);
    expect(s.keys).toEqual([KEY]);
  });

  it('maps a denied prompt to pair_required and closes the socket', async () => {
    const s = setup({ register: (k) => k.receive(frame('registerDenied')) });
    expect((await rejection(s.tv.connect())).code).toBe('pair_required');
    expect(s.main().closed).toBe(true);
    expect(s.events.some((e) => e.type === 'state' && e.state === 'error')).toBe(true);
  });

  it('times out when nobody answers the prompt', async () => {
    const s = setup({ register: () => undefined, connectTimeoutMs: 30 });
    expect((await rejection(s.tv.connect())).code).toBe('timeout');
    expect(s.main().closed).toBe(true);
  });

  it('maps an early close to network', async () => {
    const s = setup({ register: (k) => k.serverClose() });
    expect((await rejection(s.tv.connect())).code).toBe('network');
  });

  it('falls back to ws :3000 on older firmware', async () => {
    const s = await connected({ failUrls: (u) => u.startsWith('wss://192.168.1.77:3001') && !u.includes('netinput'), responses: { [WEBOS_URI.pointerSocket]: 'pointerSocketLegacy' } });
    expect(s.opened[0]!.url).toBe('ws://192.168.1.77:3000');
    expect(s.opened[0]!.opts).toBeUndefined();
    expect(s.tv.secure).toBe(false);
    expect(s.opened[1]!.url).toMatch(/^ws:\/\/192\.168\.1\.77:3000\/resources\/.+netinput\.pointer\.sock$/);
    expect(s.opened[1]!.opts).toBeUndefined();
  });

  it('does not fall back when legacyFallback is false, and maps an unreachable TV to network', async () => {
    const a = setup({ failUrls: (u) => u.startsWith('wss:'), legacyFallback: false });
    expect((await rejection(a.tv.connect())).code).toBe('network');
    expect(a.opened).toHaveLength(0);
    const b = setup({ failUrls: () => true });
    expect((await rejection(b.tv.connect())).code).toBe('network');
  });

  it('still connects when the pointer socket fails, and retries it on the next key', async () => {
    let fail = true;
    const s = await connected({ failUrls: (u) => fail && u.includes('netinput') });
    expect(s.pointer()).toBeUndefined();
    expect(s.events.some((e) => e.type === 'state' && e.state === 'connected')).toBe(true);
    expect((await rejection(s.tv.sendKey('UP'))).code).toBe('network');
    fail = false;
    await s.tv.sendKey('UP');
    expect(s.pointer()!.sent).toEqual([buildButtonFrame('UP')]);
  });

  it('emits disconnected when the TV closes, rejecting pending requests and closing the pointer', async () => {
    const s = await connected({ responses: { [WEBOS_URI.getVolume]: null } });
    const p = s.tv.volume();
    s.main().serverClose();
    expect((await rejection(p)).code).toBe('not_connected');
    expect(s.pointer()!.closed).toBe(true);
    expect(s.events.filter((e) => e.type === 'state').pop()).toEqual({ type: 'state', state: 'disconnected' });
    expect((await rejection(s.tv.sendKey('UP'))).code).toBe('not_connected');
  });

  it('disconnect closes both sockets', async () => {
    const s = await connected();
    await s.tv.disconnect();
    expect(s.main().closed).toBe(true);
    expect(s.pointer()!.closed).toBe(true);
  });
});

// ---------- driver: commands ----------

describe('WebOsDriver commands', () => {
  it('requires a connection', async () => {
    const s = setup();
    expect((await rejection(s.tv.sendKey('UP'))).code).toBe('not_connected');
    expect((await rejection(s.tv.sendText('x'))).code).toBe('not_connected');
  });

  it('sends buttons over the pointer socket', async () => {
    const s = await connected();
    for (const k of ['OK', 'BACK', 'HOME', 'SETTINGS', 'NUM_4', 'NUM_DASH', 'RED', 'BLUE', 'CH_DOWN', 'MUTE'] as const) await s.tv.sendKey(k);
    expect(s.pointer()!.sent).toEqual(['ENTER', 'BACK', 'HOME', 'MENU', '4', 'DASH', 'RED', 'BLUE', 'CHANNELDOWN', 'MUTE'].map(buildButtonFrame));
    expect(sentWhat(s.events)).toEqual(['OK', 'BACK', 'HOME', 'SETTINGS', 'NUM_4', 'NUM_DASH', 'RED', 'BLUE', 'CH_DOWN', 'MUTE']);
  });

  it('toggles PLAY / PAUSE', async () => {
    const s = await connected();
    await s.tv.sendKey('PLAY_PAUSE');
    await s.tv.sendKey('PLAY_PAUSE');
    await s.tv.sendKey('PLAY_PAUSE');
    expect(s.pointer()!.sent).toEqual(['PLAY', 'PAUSE', 'PLAY'].map(buildButtonFrame));
  });

  it('sends volume, power-off, backspace and enter as SSAP requests', async () => {
    const s = await connected();
    for (const k of ['VOL_UP', 'VOL_DOWN', 'BACKSPACE', 'ENTER', 'POWER'] as const) await s.tv.sendKey(k);
    const reqs = s.main().requests.slice(1);
    expect(reqs.map((r) => [r.uri, r.payload])).toEqual([
      [WEBOS_URI.volumeUp, undefined],
      [WEBOS_URI.volumeDown, undefined],
      [WEBOS_URI.deleteCharacters, { count: 1 }],
      [WEBOS_URI.sendEnterKey, undefined],
      [WEBOS_URI.turnOff, undefined],
    ]);
    expect(new Set(reqs.map((r) => r.id)).size).toBe(reqs.length);
    expect(s.pointer()!.sent).toEqual([]);
  });

  it('rejects unmapped keys as unsupported', async () => {
    const s = await connected();
    expect((await rejection(s.tv.sendKey('SEARCH'))).code).toBe('unsupported');
    expect((await rejection(s.tv.sendKey('SOURCE'))).code).toBe('unsupported');
    expect(s.pointer()!.sent).toEqual([]);
  });

  it('maps 401 to forbidden and times out unanswered requests', async () => {
    const s = await connected({ responses: { [WEBOS_URI.volumeUp]: 'insufficientPermissions', [WEBOS_URI.volumeDown]: null }, timeoutMs: 20 });
    expect((await rejection(s.tv.sendKey('VOL_UP'))).code).toBe('forbidden');
    expect((await rejection(s.tv.sendKey('VOL_DOWN'))).code).toBe('timeout');
    expect(s.events.some((e) => e.type === 'error')).toBe(true);
  });

  it('types text with insertText', async () => {
    const s = await connected();
    await s.tv.sendText('stranger things');
    expect(s.main().requests[1]).toMatchObject({ uri: WEBOS_URI.insertText, payload: { text: 'stranger things', replace: 0 } });
    expect(sentWhat(s.events)).toEqual(['TEXT "stranger things"']);
  });

  it('sends touchpad pointer frames', async () => {
    const s = await connected();
    await s.tv.pointerMove(5, -4);
    await s.tv.pointerClick();
    await s.tv.pointerScroll(0, -1);
    expect(s.pointer()!.sent).toEqual([buildMoveFrame(5, -4), buildClickFrame(), buildScrollFrame(0, -1)]);
    expect(s.tv.capabilities.has('touchpad')).toBe(true);
  });
});

describe('WebOsDriver apps', () => {
  it('lists launch points, returns the TV icon URL and launches', async () => {
    const s = await connected({ responses: { [WEBOS_URI.listLaunchPoints]: 'launchPoints' } });
    const apps = await s.tv.listApps();
    expect(apps.map((a) => [a.id, a.name])).toEqual([
      ['netflix', 'Netflix'],
      ['youtube.leanback.v4', 'YouTube'],
      ['com.webos.app.livetv', 'Live TV'],
    ]);
    expect(await s.tv.appIcon({ id: 'youtube.leanback.v4', name: 'App' })).toMatch(/^http:\/\/192\.168\.1\.77:3000\/resources\//);
    expect(await s.tv.appIcon({ id: 'com.webos.app.livetv', name: 'Live TV' })).toBeNull();
    expect(await s.tv.appIcon({ id: 'unknown', name: 'Unknown' })).toBeNull();
    await s.tv.launchApp('netflix');
    expect(s.main().requests.pop()).toMatchObject({ uri: WEBOS_URI.launch, payload: { id: 'netflix' } });
    expect(sentWhat(s.events)).toEqual(['LAUNCH netflix']);
  });

  it('falls back to listApps when listLaunchPoints is not available', async () => {
    const s = await connected({ responses: { [WEBOS_URI.listLaunchPoints]: 'noSuchService', [WEBOS_URI.listApps]: 'apps' } });
    expect((await s.tv.listApps()).map((a) => a.id)).toEqual(['com.webos.app.browser']);
    expect(await s.tv.appIcon({ id: 'com.webos.app.browser', name: 'Browser' })).toContain('/resources/');
  });

  it('only returns icons the TV serves itself: cloud URLs and bare paths count as none', async () => {
    const s = await connected({ responses: { [WEBOS_URI.listLaunchPoints]: 'launchPointsOffLan' } });
    const apps = await s.tv.listApps();
    const icons = await Promise.all(apps.map((a) => s.tv.appIcon(a)));
    expect(icons).toEqual([null, 'http://192.168.1.77:3000/resources/aa/local.png', null]);
  });

  it('does not fall back on timeout', async () => {
    const s = await connected({ responses: { [WEBOS_URI.listLaunchPoints]: null }, timeoutMs: 20 });
    expect((await rejection(s.tv.listApps())).code).toBe('timeout');
    expect(s.main().uris).not.toContain(WEBOS_URI.listApps);
  });

  it('advertises appIcons and apps', () => {
    const caps = setup().tv.capabilities;
    for (const c of ['keys', 'text', 'apps', 'launch', 'volume', 'inputs', 'numbers', 'colorKeys', 'appIcons'] as const) expect(caps.has(c)).toBe(true);
    expect(caps.has('voice')).toBe(false);
  });
});

describe('WebOsDriver inputs and volume', () => {
  it('lists inputs with the current one from the foreground app', async () => {
    const s = await connected({ responses: { [WEBOS_URI.inputList]: 'inputList', [WEBOS_URI.foregroundApp]: 'foregroundHdmi2' } });
    expect(await s.tv.listInputs()).toEqual([
      { id: 'HDMI_1', name: 'HDMI 1', current: false },
      { id: 'HDMI_2', name: 'Game console', current: true },
      { id: 'AV_1', name: 'AV', current: false },
    ]);
  });

  it('lists inputs without current when the foreground app is unavailable', async () => {
    const s = await connected({ responses: { [WEBOS_URI.inputList]: 'inputList', [WEBOS_URI.foregroundApp]: 'insufficientPermissions' } });
    expect(await s.tv.listInputs()).toEqual([
      { id: 'HDMI_1', name: 'HDMI 1' },
      { id: 'HDMI_2', name: 'Game console' },
      { id: 'AV_1', name: 'AV' },
    ]);
  });

  it('switches input and surfaces returnValue false', async () => {
    const s = await connected({ responses: { [WEBOS_URI.switchInput]: 'ok' } });
    await s.tv.setInput('HDMI_2');
    expect(s.main().requests.pop()).toMatchObject({ uri: WEBOS_URI.switchInput, payload: { inputId: 'HDMI_2' } });
    s.responses[WEBOS_URI.switchInput] = 'returnValueFalse';
    const e = await rejection(s.tv.setInput('HDMI_9'));
    expect(e.code).toBe('network');
    expect(e.message).toContain('Invalid input source');
  });

  it('reads the volume in both shapes', async () => {
    const s = await connected({ responses: { [WEBOS_URI.getVolume]: 'volumeLegacy' } });
    expect(await s.tv.volume()).toBe(14);
    s.responses[WEBOS_URI.getVolume] = 'volumeStatus';
    expect(await s.tv.volume()).toBe(23);
    s.responses[WEBOS_URI.getVolume] = 'ok';
    expect((await rejection(s.tv.volume())).code).toBe('unsupported');
  });
});

describe('WebOsDriver powerOn', () => {
  it('advertises powerOn only with a MAC and a WOL sender', () => {
    expect(setup().tv.capabilities.has('powerOn')).toBe(false);
    expect(setup({ mac: 'aa:bb:cc:dd:ee:ff' }).tv.capabilities.has('powerOn')).toBe(false);
    expect(setup({ mac: 'aa:bb:cc:dd:ee:ff', wol: async () => undefined }).tv.capabilities.has('powerOn')).toBe(true);
  });

  it('POWER while not connected sends Wake-on-LAN', async () => {
    const macs: string[] = [];
    const s = setup({ mac: 'aa:bb:cc:dd:ee:ff', wol: async (m) => void macs.push(m) });
    await s.tv.sendKey('POWER');
    expect(macs).toEqual(['aa:bb:cc:dd:ee:ff']);
    expect(sentWhat(s.events)).toEqual(['POWER_ON']);
    expect(s.opened).toHaveLength(0);
  });

  it('is unsupported without a MAC and maps a WOL failure to network', async () => {
    expect((await rejection(setup().tv.powerOn())).code).toBe('unsupported');
    const s = setup({ mac: 'aa:bb:cc:dd:ee:ff', wol: async () => Promise.reject(new Error('EPERM')) });
    expect((await rejection(s.tv.powerOn())).code).toBe('network');
  });
});
