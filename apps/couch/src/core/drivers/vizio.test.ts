import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, FetchLike } from '../driver';
import { KEYS } from '../keys';
import {
  VIZIO_KEYS,
  VIZIO_PATHS,
  VizioDriver,
  keyCommandPayload,
  parseVizioCurrentInput,
  parseVizioInputs,
  parseVizioNumber,
  parseVizioReply,
  vizioAppConfig,
} from './vizio';

const R = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'vizio', 'replies.json'), 'utf8')) as Record<string, unknown>;
const r = (k: string) => JSON.stringify(R[k]);

interface Req {
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}
type Responder = (req: Req) => { status: number; body?: string } | Error;

function fakeFetch(respond: Responder) {
  const reqs: Req[] = [];
  const fetch: FetchLike = async (url, init) => {
    const req: Req = {
      url,
      path: url.replace(/^https:\/\/[^/]+/, ''),
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body ? (JSON.parse(init.body) as unknown) : undefined,
    };
    reqs.push(req);
    const x = respond(req);
    if (x instanceof Error) throw x;
    return { status: x.status, ok: x.status >= 200 && x.status < 300, text: async () => x.body ?? '' };
  };
  return { fetch, reqs };
}

const TOKEN = 'Zm9vYmFyMTIz';

function vizioTv(over: Partial<Record<string, string>> = {}): Responder {
  return (req) => {
    const key = `${req.method} ${req.path}`;
    if (over[key] !== undefined) return { status: 200, body: over[key] };
    if (req.path.startsWith('/pairing/')) {
      if (req.path === VIZIO_PATHS.pairStart) return { status: 200, body: r('pairStart') };
      if (req.path === VIZIO_PATHS.pairFinish)
        return { status: 200, body: (req.body as { RESPONSE_VALUE?: string }).RESPONSE_VALUE === '1234' ? r('pairFinish') : r('pairWrongPin') };
      return { status: 200, body: r('pairCancel') };
    }
    if (req.headers.AUTH !== TOKEN) return { status: 200, body: r('unauthorized') };
    switch (req.path) {
      case VIZIO_PATHS.powerMode:
        return { status: 200, body: r('powerOn') };
      case VIZIO_PATHS.volume:
        return { status: 200, body: r('volume') };
      case VIZIO_PATHS.currentInput:
        return { status: 200, body: req.method === 'GET' ? r('currentInput') : r('success') };
      case VIZIO_PATHS.inputs:
        return { status: 200, body: r('inputs') };
      default:
        return { status: 200, body: r('success') };
    }
  };
}

async function connected(respond: Responder = vizioTv(), extra: { wol?: (m: string) => Promise<void>; mac?: string } = {}) {
  const f = fakeFetch(respond);
  const tv = new VizioDriver({ host: '192.168.1.90', fetch: f.fetch, token: TOKEN, now: () => 0, ...extra });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  await tv.connect();
  f.reqs.length = 0;
  events.length = 0;
  return { tv, reqs: f.reqs, events };
}

describe('Vizio parsers', () => {
  it('reply envelope', () => {
    const p = parseVizioReply(r('pairStart'));
    expect(p.result).toBe('SUCCESS');
    expect(p.item?.PAIRING_REQ_TOKEN).toBe(73241);
    expect(parseVizioReply('not json').result).toBe('');
  });
  it('inputs with user labels and current', () => {
    const inputs = parseVizioInputs(r('inputs'), 'HDMI-1');
    expect(inputs.map((i) => i.id)).toEqual(['CAST', 'HDMI-1', 'HDMI-2', 'HDMI-3', 'COMP', 'TV']);
    expect(inputs[1]).toEqual({ id: 'HDMI-1', name: 'HDMI-1 (Xbox)', current: true });
    expect(inputs[2]).toEqual({ id: 'HDMI-2', name: 'HDMI-2', current: false });
    expect(inputs[0]?.name).toBe('CAST');
  });
  it('current input, numbers', () => {
    expect(parseVizioCurrentInput(r('currentInput'))).toEqual({ value: 'HDMI-1', hashval: 1890234511 });
    expect(parseVizioNumber(r('volume'))).toBe(22);
    expect(parseVizioNumber(r('powerStandby'))).toBe(0);
    expect(parseVizioNumber(r('success'))).toBeUndefined();
  });
  it('key payload and app configs', () => {
    expect(keyCommandPayload([5, 1])).toEqual({ KEYLIST: [{ CODESET: 5, CODE: 1, ACTION: 'KEYPRESS' }] });
    expect(vizioAppConfig('netflix')).toEqual({ NAME_SPACE: 3, APP_ID: '1', MESSAGE: null });
    expect(vizioAppConfig('4:75:https://x/y')).toEqual({ NAME_SPACE: 4, APP_ID: '75', MESSAGE: 'https://x/y' });
    expect(vizioAppConfig('nope')).toBeUndefined();
  });
  it('key map covers SOURCE, SETTINGS and digits but no colour keys', () => {
    expect(VIZIO_KEYS.SOURCE).toEqual([7, 1]);
    expect(VIZIO_KEYS.SETTINGS).toBeDefined();
    for (let n = 0; n <= 9; n++) expect(VIZIO_KEYS[`NUM_${n}` as 'NUM_0']).toEqual([0, 48 + n]);
    expect(VIZIO_KEYS.RED).toBeUndefined();
    // every mapped key is a real Key
    for (const k of Object.keys(VIZIO_KEYS)) expect(KEYS).toContain(k);
  });
});

describe('VizioDriver pairing', () => {
  it('start -> pin -> token, persisted via onToken', async () => {
    const f = fakeFetch(vizioTv());
    const tokens: string[] = [];
    const tv = new VizioDriver({ host: '192.168.1.90', fetch: f.fetch, deviceId: 'phone-1', onToken: (t) => tokens.push(t) });
    await tv.startPairing();
    expect(f.reqs[0]).toMatchObject({
      url: 'https://192.168.1.90:7345/pairing/start',
      method: 'PUT',
      body: { DEVICE_ID: 'phone-1', DEVICE_NAME: 'Couch Remote' },
    });
    expect(f.reqs[0]?.headers.AUTH).toBeUndefined();
    const token = await tv.finishPairing('1234');
    expect(f.reqs[1]).toMatchObject({
      path: '/pairing/pair',
      body: { DEVICE_ID: 'phone-1', CHALLENGE_TYPE: 1, RESPONSE_VALUE: '1234', PAIRING_REQ_TOKEN: 73241 },
    });
    expect(token).toBe(TOKEN);
    expect(tokens).toEqual([TOKEN]);
    await tv.connect();
    expect(f.reqs[2]?.headers.AUTH).toBe(TOKEN);
  });

  it('wrong PIN -> forbidden; finish before start -> pair_required; blocked start -> forbidden', async () => {
    const tv = new VizioDriver({ host: 'h', fetch: fakeFetch(vizioTv()).fetch });
    await expect(tv.finishPairing('1234')).rejects.toMatchObject({ code: 'pair_required' });
    await tv.startPairing();
    await expect(tv.finishPairing('0000')).rejects.toMatchObject({ code: 'forbidden' });
    const blocked = new VizioDriver({ host: 'h', fetch: fakeFetch(vizioTv({ 'PUT /pairing/start': r('pairStartBlocked') })).fetch });
    await expect(blocked.startPairing()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('cancelPairing is best effort', async () => {
    const f = fakeFetch(() => new Error('down'));
    const tv = new VizioDriver({ host: 'h', fetch: f.fetch });
    await tv.cancelPairing();
    expect(f.reqs[0]?.path).toBe('/pairing/cancel');
  });

  it('legacy port option', () => {
    const tv = new VizioDriver({ host: 'h', fetch: fakeFetch(vizioTv()).fetch, port: 9000 });
    expect(tv.base).toBe('https://h:9000');
  });
});

describe('VizioDriver', () => {
  it('connect without a token -> pair_required, with a bad token -> pair_required', async () => {
    const f = fakeFetch(vizioTv());
    await expect(new VizioDriver({ host: 'h', fetch: f.fetch }).connect()).rejects.toMatchObject({ code: 'pair_required' });
    expect(f.reqs).toHaveLength(0);
    await expect(new VizioDriver({ host: 'h', fetch: f.fetch, token: 'bad' }).connect()).rejects.toMatchObject({ code: 'pair_required' });
  });

  it('connect reads power mode', async () => {
    const f = fakeFetch(vizioTv({ 'GET /state/device/power_mode': r('powerStandby') }));
    const tv = new VizioDriver({ host: 'h', fetch: f.fetch, token: TOKEN });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(states).toEqual(['connecting', 'off']);
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(tv.capabilities.has('colorKeys')).toBe(false);
  });

  it('TLS / network failure explains', async () => {
    const tv = new VizioDriver({ host: 'h', fetch: fakeFetch(() => new Error('self signed certificate')).fetch, token: TOKEN });
    await expect(tv.connect()).rejects.toMatchObject({ code: 'network' });
  });

  it('keys go to /key_command/ as CODESET/CODE with AUTH', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('VOL_UP');
    await tv.sendKey('SOURCE');
    await tv.sendKey('NUM_5');
    expect(reqs[0]).toMatchObject({
      url: 'https://192.168.1.90:7345/key_command/',
      method: 'PUT',
      headers: { AUTH: TOKEN, 'Content-Type': 'application/json' },
      body: { KEYLIST: [{ CODESET: 5, CODE: 1, ACTION: 'KEYPRESS' }] },
    });
    expect(reqs[1]?.body).toEqual({ KEYLIST: [{ CODESET: 7, CODE: 1, ACTION: 'KEYPRESS' }] });
    expect(reqs[2]?.body).toEqual({ KEYLIST: [{ CODESET: 0, CODE: 53, ACTION: 'KEYPRESS' }] });
    expect(events).toContainEqual({ type: 'sent', what: 'VOL_UP', ms: 0 });
  });

  it('PLAY_PAUSE alternates; POWER toggles state; colour key unsupported', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('PLAY_PAUSE');
    await tv.sendKey('PLAY_PAUSE');
    expect(reqs.map((q) => (q.body as { KEYLIST: { CODE: number }[] }).KEYLIST[0]?.CODE)).toEqual([2, 3]);
    await tv.sendKey('POWER');
    expect(events).toContainEqual({ type: 'state', state: 'off' });
    await expect(tv.sendKey('RED')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(tv.sendText('x')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('INVALID_PARAMETER -> unsupported', async () => {
    const { tv } = await connected(vizioTv({ 'PUT /key_command/': r('invalidParameter') }));
    await expect(tv.sendKey('OK')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('inputs: list with current, set with fresh HASHVAL', async () => {
    const { tv, reqs } = await connected();
    const inputs = await tv.listInputs();
    expect(inputs.find((i) => i.current)?.id).toBe('HDMI-1');
    reqs.length = 0;
    await tv.setInput('HDMI-3');
    expect(reqs[0]).toMatchObject({ method: 'GET', path: VIZIO_PATHS.currentInput });
    expect(reqs[1]).toMatchObject({
      method: 'PUT',
      path: VIZIO_PATHS.currentInput,
      body: { REQUEST: 'MODIFY', VALUE: 'HDMI-3', HASHVAL: 1890234511 },
    });
  });

  it('apps: static list, launch payload', async () => {
    const { tv, reqs } = await connected();
    const apps = await tv.listApps();
    expect(apps.map((a) => a.id)).toContain('netflix');
    await tv.launchApp('netflix');
    expect(reqs[0]).toMatchObject({ method: 'PUT', path: '/app/launch', body: { VALUE: { NAME_SPACE: 3, APP_ID: '1', MESSAGE: null } } });
    await expect(tv.launchApp('unknown-app')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('volume', async () => {
    const { tv } = await connected();
    expect(await tv.volume()).toBe(22);
  });

  it('powerOn sends POW_ON, falls back to WOL', async () => {
    const { tv, reqs } = await connected();
    await tv.powerOn();
    expect(reqs[0]?.body).toEqual({ KEYLIST: [{ CODESET: 11, CODE: 1, ACTION: 'KEYPRESS' }] });
    const macs: string[] = [];
    let down = false;
    const base = vizioTv();
    const c = await connected((q) => (down ? new Error('ECONNREFUSED') : base(q)), {
      mac: 'aa:bb:cc:dd:ee:ff',
      wol: async (m) => {
        macs.push(m);
      },
    });
    down = true;
    await c.tv.powerOn();
    expect(macs).toEqual(['aa:bb:cc:dd:ee:ff']);
  });

  it('requires connect', async () => {
    const tv = new VizioDriver({ host: 'h', fetch: fakeFetch(vizioTv()).fetch, token: TOKEN });
    await expect(tv.sendKey('OK')).rejects.toMatchObject({ code: 'not_connected' });
  });
});
