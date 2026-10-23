import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, FetchLike } from '../driver';
import { t } from '../../i18n/core';
import { KEYS } from '../keys';
import { DriverError } from '../types';
import {
  ROKU_MOBILE_CONTROL_HELP,
  RokuDriver,
  isRokuForbidden,
  parseApps,
  parseDeviceInfo,
  rokuLiteral,
} from './roku';

const FIX = join(__dirname, '__fixtures__', 'roku');
const DEVICE_INFO = readFileSync(join(FIX, 'device-info.xml'), 'utf8');
const DEVICE_INFO_PLAYER = readFileSync(join(FIX, 'device-info-player.xml'), 'utf8');
const APPS = readFileSync(join(FIX, 'apps.xml'), 'utf8');

interface Req {
  method: string;
  url: string;
}

type Responder = (req: Req) => { status: number; body?: string } | Error;

function fakeFetch(respond: Responder = () => ({ status: 200 })) {
  const reqs: Req[] = [];
  const fetch: FetchLike = async (url, init) => {
    const req = { method: init?.method ?? 'GET', url };
    reqs.push(req);
    const r = respond(req);
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body ?? '' };
  };
  return { fetch, reqs };
}

/** Default Roku: serves fixtures, 200 for everything else. */
function rokuResponder(deviceInfo = DEVICE_INFO): Responder {
  return (req) => {
    if (req.url.endsWith('/query/device-info')) return { status: 200, body: deviceInfo };
    if (req.url.endsWith('/query/apps')) return { status: 200, body: APPS };
    return { status: 200 };
  };
}

function clock(step = 12) {
  let t = 1000;
  return () => {
    const v = t;
    t += step;
    return v;
  };
}

async function connected(respond: Responder = rokuResponder()) {
  const f = fakeFetch(respond);
  const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch, now: clock() });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  await tv.connect();
  f.reqs.length = 0;
  events.length = 0;
  return { tv, reqs: f.reqs, events };
}

const B = 'http://192.168.1.33:8060';

describe('parseDeviceInfo', () => {
  it('parses the docs-based fixture, decoding entities', () => {
    const info = parseDeviceInfo(DEVICE_INFO);
    expect(info.name).toBe('Living Room & Kitchen TV');
    expect(info.model).toBe('TCL•Roku TV');
    expect(info.modelNumber).toBe('7105X');
    expect(info.serial).toBe('X01900AAAAAA');
    expect(info.wifiMac).toBe('d8:31:34:33:2d:7e');
    expect(info.ethernetMac).toBe('d8:31:34:33:2d:7f');
    expect(info.mac).toBe('d8:31:34:33:2d:7e');
    expect(info.powerMode).toBe('PowerOn');
    expect(info.isTv).toBe(true);
    expect(info.supportsWakeOnWlan).toBe(true);
    expect(info.supportsSuspend).toBe(true);
    expect(info.softwareVersion).toBe('14.1.4');
  });

  it('falls back to friendly name / model-name and ethernet MAC', () => {
    const info = parseDeviceInfo(
      '<device-info><model-name>Roku Express 4K</model-name><friendly-device-name>Bedroom</friendly-device-name>' +
        '<ethernet-mac>aa:bb</ethernet-mac><network-type>ethernet</network-type><is-tv>false</is-tv></device-info>',
    );
    expect(info.name).toBe('Bedroom');
    expect(info.model).toBe('Roku Express 4K');
    expect(info.mac).toBe('aa:bb');
    expect(info.isTv).toBe(false);
    expect(info.powerMode).toBeUndefined();
  });
});

describe('parseApps', () => {
  it('parses ids and names from the fixture', () => {
    const apps = parseApps(APPS);
    expect(apps).toHaveLength(10);
    expect(apps[2]).toEqual({ id: '12', name: 'Netflix' });
    expect(apps.find((a) => a.id === '837')?.name).toBe('YouTube');
    expect(apps.find((a) => a.id === '13535')?.name).toBe('Plex - Free Movies & TV');
    expect(apps[0]).toEqual({ id: 'tvinput.dtv', name: 'Live TV' });
  });
  it('returns [] for empty list', () => {
    expect(parseApps('<apps/>')).toEqual([]);
  });
});

describe('RokuDriver', () => {
  it('connect GETs device-info and reports connected', async () => {
    const f = fakeFetch(rokuResponder());
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(f.reqs).toEqual([{ method: 'GET', url: `${B}/query/device-info` }]);
    expect(states).toEqual(['connecting', 'connected']);
    expect(tv.info?.name).toBe('Living Room & Kitchen TV');
    expect([...tv.capabilities].sort()).toEqual(['appIcons', 'apps', 'inputs', 'keys', 'launch', 'powerOn', 'text']);
    expect(tv.volume).toBeUndefined();
  });

  it('reports off when a Roku TV is in standby', async () => {
    const f = fakeFetch(rokuResponder(DEVICE_INFO.replace('>PowerOn<', '>DisplayOff<')));
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(states).toEqual(['connecting', 'off']);
  });

  it('refuses keys before connect', async () => {
    const f = fakeFetch();
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch });
    await expect(tv.sendKey('UP')).rejects.toMatchObject({ code: 'not_connected' });
    expect(f.reqs).toHaveLength(0);
  });

  it('POSTs /keypress/<ECP name> for each key', async () => {
    const { tv, reqs } = await connected();
    const expected: Record<string, string> = {
      UP: 'Up',
      DOWN: 'Down',
      LEFT: 'Left',
      RIGHT: 'Right',
      OK: 'Select',
      BACK: 'Back',
      HOME: 'Home',
      MENU: 'Info',
      VOL_UP: 'VolumeUp',
      VOL_DOWN: 'VolumeDown',
      MUTE: 'VolumeMute',
      CH_UP: 'ChannelUp',
      CH_DOWN: 'ChannelDown',
      REW: 'Rev',
      PLAY_PAUSE: 'Play',
      FF: 'Fwd',
      BACKSPACE: 'Backspace',
      ENTER: 'Enter',
      SEARCH: 'Search',
    };
    for (const [k, name] of Object.entries(expected)) {
      reqs.length = 0;
      await tv.sendKey(k as (typeof KEYS)[number]);
      expect(reqs).toEqual([{ method: 'POST', url: `${B}/keypress/${name}` }]);
    }
    // every canonical key is either mapped, POWER, INPUT, or one Roku has no ECP key for
    // (source/settings/digits/colour/voice: the UI hides or reroutes those by capability)
    expect(KEYS.filter((k) => !(k in expected))).toEqual([
      'POWER', 'INPUT', 'SOURCE', 'SETTINGS',
      'NUM_0', 'NUM_1', 'NUM_2', 'NUM_3', 'NUM_4', 'NUM_5', 'NUM_6', 'NUM_7', 'NUM_8', 'NUM_9', 'NUM_DASH',
      'RED', 'GREEN', 'YELLOW', 'BLUE', 'VOICE',
    ]);
  });

  it('INPUT is unsupported and sends nothing', async () => {
    const { tv, reqs } = await connected();
    await expect(tv.sendKey('INPUT')).rejects.toMatchObject({ code: 'unsupported' });
    expect(reqs).toHaveLength(0);
  });

  it('emits sent events with measured ms', async () => {
    const { tv, events } = await connected();
    await tv.sendKey('OK');
    expect(events).toEqual([{ type: 'sent', what: 'OK', ms: 12 }]);
  });

  it('keydown / keyup', async () => {
    const { tv, reqs } = await connected();
    await tv.keyDown('RIGHT');
    await tv.keyUp('RIGHT');
    expect(reqs.map((r) => `${r.method} ${r.url}`)).toEqual([
      `POST ${B}/keydown/Right`,
      `POST ${B}/keyup/Right`,
    ]);
  });

  it('POWER on a Roku TV sends PowerOff then PowerOn and tracks state', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('POWER');
    await tv.sendKey('POWER');
    expect(reqs.map((r) => r.url)).toEqual([`${B}/keypress/PowerOff`, `${B}/keypress/PowerOn`]);
    expect(events.filter((e) => e.type === 'state').map((e) => (e as { state: string }).state)).toEqual([
      'off',
      'connected',
    ]);
  });

  it('POWER on a streaming player sends Power', async () => {
    const { tv, reqs } = await connected(rokuResponder(DEVICE_INFO.replace('<is-tv>true', '<is-tv>false')));
    await tv.sendKey('POWER');
    expect(reqs.map((r) => r.url)).toEqual([`${B}/keypress/Power`]);
  });

  it('powerOn POSTs keypress/PowerOn', async () => {
    const f = fakeFetch();
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch });
    await tv.powerOn();
    expect(f.reqs).toEqual([{ method: 'POST', url: `${B}/keypress/PowerOn` }]);
  });

  it('sendText sends Lit_ per character in order, URL-encoded', async () => {
    const { tv, reqs } = await connected();
    await tv.sendText('a b&é?');
    expect(reqs.map((r) => r.url.replace(`${B}/keypress/`, ''))).toEqual([
      'Lit_a',
      'Lit_%20',
      'Lit_b',
      'Lit_%26',
      'Lit_%C3%A9',
      'Lit_%3F',
    ]);
    expect(reqs.every((r) => r.method === 'POST')).toBe(true);
  });

  it('rokuLiteral handles astral characters as one code point', () => {
    expect(rokuLiteral('😀')).toBe('Lit_%F0%9F%98%80');
    expect(rokuLiteral('/')).toBe('Lit_%2F');
  });

  it('listApps GETs /query/apps', async () => {
    const { tv, reqs } = await connected();
    const apps = await tv.listApps();
    expect(reqs).toEqual([{ method: 'GET', url: `${B}/query/apps` }]);
    expect(apps.map((a) => a.id)).toContain('12');
  });

  it('launchApp POSTs /launch/<id>', async () => {
    const { tv, reqs, events } = await connected();
    await tv.launchApp('12');
    await tv.launchApp('tvinput.hdmi1');
    expect(reqs).toEqual([
      { method: 'POST', url: `${B}/launch/12` },
      { method: 'POST', url: `${B}/launch/tvinput.hdmi1` },
    ]);
    expect(events[0]).toEqual({ type: 'sent', what: 'LAUNCH 12', ms: 12 });
  });

  it('launch 404 maps to unsupported', async () => {
    const { tv } = await connected((r) =>
      r.url.includes('/launch/') ? { status: 404 } : { status: 200, body: DEVICE_INFO },
    );
    await expect(tv.launchApp('999')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('403 on connect maps to forbidden with the settings help', async () => {
    const f = fakeFetch(() => ({ status: 403 }));
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch });
    const events: DriverEvent[] = [];
    tv.on((e) => events.push(e));
    let err: unknown;
    try {
      await tv.connect();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DriverError);
    expect(isRokuForbidden(err)).toBe(true);
    expect((err as DriverError).message).toBe(t(ROKU_MOBILE_CONTROL_HELP));
    expect(t(ROKU_MOBILE_CONTROL_HELP)).toContain('Control by mobile apps');
    expect(t(ROKU_MOBILE_CONTROL_HELP)).toContain('Settings › System › Advanced system settings');
    expect(events).toContainEqual({ type: 'state', state: 'error' });
    expect(events).toContainEqual({ type: 'error', message: t(ROKU_MOBILE_CONTROL_HELP) });
  });

  it('403 on a keypress maps to forbidden', async () => {
    const { tv } = await connected((r) =>
      r.url.includes('/keypress/') ? { status: 403 } : { status: 200, body: DEVICE_INFO },
    );
    await expect(tv.sendKey('HOME')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('isRokuForbidden is false for other errors', () => {
    expect(isRokuForbidden(new DriverError('network', 'x'))).toBe(false);
    expect(isRokuForbidden(new Error('forbidden'))).toBe(false);
  });

  it('network failure maps to network, timeouts to timeout, other HTTP errors to network', async () => {
    const mk = (r: Responder) => new RokuDriver({ host: '192.168.1.33', fetch: fakeFetch(r).fetch });
    await expect(mk(() => new TypeError('Network request failed')).connect()).rejects.toMatchObject({
      code: 'network',
    });
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    await expect(mk(() => abort).connect()).rejects.toMatchObject({ code: 'timeout' });
    await expect(mk(() => ({ status: 500 })).connect()).rejects.toMatchObject({ code: 'network' });
  });
});

describe('RokuDriver inputs', () => {
  it('advertises no inputs before connect', () => {
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: fakeFetch().fetch });
    expect(tv.capabilities.has('inputs')).toBe(false);
  });

  it('Roku TV lists TV, HDMI 1-4 and AV with no current flag, without a request', async () => {
    const { tv, reqs } = await connected();
    expect(tv.capabilities.has('inputs')).toBe(true);
    const inputs = await tv.listInputs();
    expect(inputs).toEqual([
      { id: 'InputTuner', name: 'TV' },
      { id: 'InputHDMI1', name: 'HDMI 1' },
      { id: 'InputHDMI2', name: 'HDMI 2' },
      { id: 'InputHDMI3', name: 'HDMI 3' },
      { id: 'InputHDMI4', name: 'HDMI 4' },
      { id: 'InputAV1', name: 'AV' },
    ]);
    expect(reqs).toHaveLength(0);
  });

  it('setInput POSTs the ECP input keypress', async () => {
    const { tv, reqs, events } = await connected();
    await tv.setInput('InputHDMI2');
    await tv.setInput('InputTuner');
    await tv.setInput('InputAV1');
    expect(reqs).toEqual([
      { method: 'POST', url: `${B}/keypress/InputHDMI2` },
      { method: 'POST', url: `${B}/keypress/InputTuner` },
      { method: 'POST', url: `${B}/keypress/InputAV1` },
    ]);
    const sent = events.flatMap((e) => (e.type === 'sent' ? [e.what] : []));
    expect(sent).toEqual(['INPUT HDMI 2', 'INPUT TV', 'INPUT AV']);
  });

  it('setInput rejects unknown ids and sends nothing', async () => {
    const { tv, reqs } = await connected();
    await expect(tv.setInput('InputHDMI9')).rejects.toMatchObject({ code: 'unsupported' });
    expect(reqs).toHaveLength(0);
  });

  it('setInput needs a connection', async () => {
    const f = fakeFetch(rokuResponder());
    const tv = new RokuDriver({ host: '192.168.1.33', fetch: f.fetch });
    await expect(tv.setInput('InputHDMI1')).rejects.toMatchObject({ code: 'not_connected' });
    expect(f.reqs).toHaveLength(0);
  });

  it('streaming player: no inputs capability, empty list, setInput unsupported', async () => {
    const { tv, reqs } = await connected(rokuResponder(DEVICE_INFO_PLAYER));
    expect(tv.info?.isTv).toBe(false);
    expect(tv.info?.name).toBe('Bedroom Roku');
    expect([...tv.capabilities].sort()).toEqual(['appIcons', 'apps', 'keys', 'launch', 'powerOn', 'text']);
    expect(await tv.listInputs()).toEqual([]);
    await expect(tv.setInput('InputHDMI1')).rejects.toMatchObject({ code: 'unsupported' });
    expect(reqs).toHaveLength(0);
  });

  it('403 on setInput maps to forbidden', async () => {
    const { tv } = await connected((req) =>
      req.url.endsWith('/query/device-info') ? { status: 200, body: DEVICE_INFO } : { status: 403 },
    );
    await expect(tv.setInput('InputHDMI1')).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('RokuDriver appIcon', () => {
  it('returns the ECP /query/icon URL for the app without making a request', async () => {
    const { tv, reqs } = await connected();
    expect(await tv.appIcon({ id: '12', name: 'Some App' })).toBe(`${B}/query/icon/12`);
    expect(reqs).toEqual([]);
  });

  it('URL-encodes the app id', async () => {
    const { tv } = await connected();
    expect(await tv.appIcon({ id: 'tvinput.hdmi1/x y', name: 'HDMI 1' })).toBe(
      `${B}/query/icon/tvinput.hdmi1%2Fx%20y`,
    );
  });

  it('returns null for an empty id', async () => {
    const { tv } = await connected();
    expect(await tv.appIcon({ id: '', name: '' })).toBeNull();
  });
});
