import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, FetchLike } from '../driver';
import { KEYS } from '../keys';
import {
  PHILIPS_KEYS,
  PHILIPS_PAIR_SECRET_B64,
  PhilipsDriver,
  decodePhilipsToken,
  encodePhilipsToken,
  parsePhilipsApps,
  parsePhilipsPower,
  parsePhilipsSources,
  parsePhilipsSystem,
  parsePhilipsVolume,
  philipsSignature,
  responseHeader,
} from './philips';

const R = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'philips', 'replies.json'), 'utf8')) as Record<string, unknown>;
const r = (k: string) => JSON.stringify(R[k]);
const CHALLENGE = R.wwwAuthenticate as string;
const NONCE = '7a1c3e5b9d0f2a4c6e8b0d1f3a5c7e9b';
const AUTH_KEY = (R.pairRequest as { auth_key: string }).auth_key;
const DEVICE = 'dev0123456789abc';
const TOKEN = `${DEVICE}:${AUTH_KEY}`;
const md5 = (s: string) => createHash('md5').update(s).digest('hex');

interface Req {
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}
type Reply = { status: number; body?: string; headers?: Record<string, string> };
type Responder = (req: Req) => Reply | Error;

function fakeFetch(respond: Responder, exposeHeaders = true) {
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
    const h = x.headers ?? {};
    const res = { status: x.status, ok: x.status >= 200 && x.status < 300, text: async () => x.body ?? '' };
    return exposeHeaders ? { ...res, headers: { get: (n: string) => h[n.toLowerCase()] ?? null } } : res;
  };
  return { fetch, reqs };
}

/** Checks a Digest Authorization header against user/pass with node:crypto. */
function digestOk(auth: string | undefined, method: string, user: string, pass: string): boolean {
  if (!auth?.startsWith('Digest ')) return false;
  const p: Record<string, string> = {};
  for (const m of auth.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) p[m[1]!] = m[2] ?? m[3] ?? '';
  if (p.username !== user || p.nonce !== NONCE || p.realm !== 'XTV') return false;
  const ha1 = md5(`${user}:XTV:${pass}`);
  const ha2 = md5(`${method}:${p.uri}`);
  return p.response === md5(`${ha1}:${NONCE}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`);
}

function philipsTv(over: Partial<Record<string, Reply>> = {}, user = DEVICE, pass = AUTH_KEY): Responder {
  return (req) => {
    const key = `${req.method} ${req.path.replace(/^\/6/, '')}`;
    if (key === 'GET /system') return { status: 200, body: r('system') };
    if (key === 'POST /pair/request') return over[key] ?? { status: 200, body: r('pairRequest') };
    const u = key === 'POST /pair/grant' ? (req.body as { device: { id: string } }).device.id : user;
    if (!digestOk(req.headers.Authorization, req.method, u, pass)) return { status: 401, headers: { 'www-authenticate': CHALLENGE } };
    if (over[key]) return over[key]!;
    switch (key) {
      case 'POST /pair/grant': {
        const b = req.body as { auth: { pin: string; auth_timestamp: number; auth_signature: string } };
        const ok =
          b.auth.pin === '1234' &&
          b.auth.auth_signature === philipsSignature(Buffer.from(PHILIPS_PAIR_SECRET_B64, 'base64'), b.auth.auth_timestamp, b.auth.pin);
        return { status: 200, body: ok ? r('pairGrant') : r('pairGrantBadPin') };
      }
      case 'GET /powerstate':
        return { status: 200, body: r('powerOn') };
      case 'GET /sources':
        return { status: 200, body: r('sourcesMap') };
      case 'GET /sources/current':
        return { status: 200, body: r('sourcesCurrent') };
      case 'GET /applications':
        return { status: 200, body: r('applications') };
      case 'GET /audio/volume':
        return { status: 200, body: r('volume') };
      default:
        return { status: 200, body: '' };
    }
  };
}

let seq = 0;
const rnd = () => `c${(seq++).toString(16).padStart(8, '0')}`;

async function connected(respond: Responder = philipsTv(), extra: { mac?: string; wol?: (m: string) => Promise<void> } = {}) {
  const f = fakeFetch(respond);
  const tv = new PhilipsDriver({ host: '192.168.1.95', fetch: f.fetch, token: TOKEN, random: rnd, now: () => 0, ...extra });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  await tv.connect();
  f.reqs.length = 0;
  events.length = 0;
  return { tv, reqs: f.reqs, events };
}

describe('Philips helpers', () => {
  it('signature = base64(hex(HMAC-SHA1(secret, timestamp+pin))) matches node:crypto', () => {
    const secret = Buffer.from(PHILIPS_PAIR_SECRET_B64, 'base64');
    expect(secret.length).toBe(64);
    const hex = createHmac('sha1', secret).update('17287344001234').digest('hex');
    expect(philipsSignature(new Uint8Array(secret), 1728734400, '1234')).toBe(Buffer.from(hex).toString('base64'));
  });
  it('token round-trip', () => {
    expect(decodePhilipsToken(encodePhilipsToken('a', 'b:c'))).toEqual({ deviceId: 'a', authKey: 'b:c' });
    expect(decodePhilipsToken('nocolon')).toBeUndefined();
    expect(decodePhilipsToken(':x')).toBeUndefined();
  });
  it('parsers', () => {
    const apps = parsePhilipsApps(r('applications'));
    expect(apps).toHaveLength(3);
    expect(apps[0]).toMatchObject({ id: 'com.netflix.ninja.MainActivity-com.netflix.ninja', name: 'Netflix' });
    expect(parsePhilipsSources(r('sourcesMap'), 'hdmi1')[1]).toEqual({ id: 'hdmi1', name: 'HDMI 1', current: true });
    expect(parsePhilipsSources(r('sourcesArray'))).toEqual([
      { id: 'hdmi1', name: 'HDMI 1' },
      { id: 'hdmi2', name: 'hdmi2' },
    ]);
    expect(parsePhilipsSources('not json')).toEqual([]);
    expect(parsePhilipsVolume(r('volume'))).toEqual({ current: 14, min: 0, max: 60, muted: false });
    expect(parsePhilipsPower(r('powerStandby'))).toBe('Standby');
    expect(parsePhilipsSystem(r('system'))).toEqual({ name: 'Living Room Philips', model: undefined, apiMajor: 6 });
  });
  it('responseHeader reads get() or a plain record', () => {
    const base = { status: 401, ok: false, text: async () => '' };
    expect(responseHeader({ ...base, headers: { get: () => 'x' } } as never, 'A')).toBe('x');
    expect(responseHeader({ ...base, headers: { 'www-authenticate': 'y' } } as never, 'WWW-Authenticate')).toBe('y');
    expect(responseHeader(base, 'A')).toBeNull();
  });
  it('key map: real keys, SOURCE/SETTINGS/digits/colours present', () => {
    for (const k of Object.keys(PHILIPS_KEYS)) expect(KEYS).toContain(k);
    expect(PHILIPS_KEYS.SOURCE).toBe('Source');
    expect(PHILIPS_KEYS.SETTINGS).toBe('Adjust');
    expect(PHILIPS_KEYS.NUM_3).toBe('Digit3');
    expect(PHILIPS_KEYS.YELLOW).toBe('YellowColour');
  });
});

describe('PhilipsDriver pairing', () => {
  it('request -> PIN -> grant with digest + HMAC signature; token persisted', async () => {
    const f = fakeFetch(philipsTv());
    const tokens: string[] = [];
    const tv = new PhilipsDriver({ host: '192.168.1.95', fetch: f.fetch, deviceId: DEVICE, random: rnd, onToken: (t) => tokens.push(t) });
    await tv.startPairing();
    expect(f.reqs[0]).toMatchObject({
      url: 'https://192.168.1.95:1926/6/pair/request',
      method: 'POST',
      body: {
        scope: ['read', 'write', 'control'],
        device: { id: DEVICE, type: 'native', device_name: 'Couch Remote', app_name: 'Couch', app_id: 'com.jared797.couch' },
      },
    });
    expect(f.reqs[0]?.headers.Authorization).toBeUndefined();
    const token = await tv.finishPairing('1234');
    // first grant attempt is challenged, second carries Digest
    expect(f.reqs.slice(1).map((q) => q.path)).toEqual(['/6/pair/grant', '/6/pair/grant']);
    expect(f.reqs[2]?.headers.Authorization).toMatch(/^Digest username="dev0123456789abc"/);
    expect(f.reqs[2]?.body).toMatchObject({
      auth: { auth_AppId: '1', pin: '1234', auth_timestamp: 1728734400 },
      device: { app_id: 'com.jared797.couch' },
    });
    expect(token).toBe(TOKEN);
    expect(tokens).toEqual([TOKEN]);
    expect(tv.token).toBe(TOKEN);
    await tv.connect();
  });

  it('bad PIN -> forbidden; concurrent pairing -> forbidden; grant before request -> pair_required', async () => {
    const tv = new PhilipsDriver({ host: 'h', fetch: fakeFetch(philipsTv()).fetch, deviceId: DEVICE, random: rnd });
    await expect(tv.finishPairing('1234')).rejects.toMatchObject({ code: 'pair_required' });
    await tv.startPairing();
    await expect(tv.finishPairing('9999')).rejects.toMatchObject({ code: 'forbidden' });
    const busy = new PhilipsDriver({
      host: 'h',
      fetch: fakeFetch(philipsTv({ 'POST /pair/request': { status: 200, body: r('pairRequestConcurrent') } })).fetch,
    });
    await expect(busy.startPairing()).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('PhilipsDriver', () => {
  it('connect: system (no auth), powerstate with digest after a challenge, sources probe', async () => {
    const f = fakeFetch(philipsTv());
    const tv = new PhilipsDriver({ host: '192.168.1.95', fetch: f.fetch, token: TOKEN, random: rnd });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(f.reqs.map((q) => `${q.method} ${q.path} ${q.headers.Authorization ? 'auth' : '-'}`)).toEqual([
      'GET /6/system -',
      'GET /6/powerstate -',
      'GET /6/powerstate auth',
      'GET /6/sources auth',
    ]);
    expect(states).toEqual(['connecting', 'connected']);
    expect(tv.info?.name).toBe('Living Room Philips');
    expect(tv.capabilities.has('inputs')).toBe(true);
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(tv.capabilities.has('text')).toBe(false);
  });

  it('nonce count increases on reused challenge', async () => {
    const { tv, reqs } = await connected();
    await tv.sendKey('OK');
    await tv.sendKey('OK');
    const nc = reqs.map((q) => /nc=(\w+)/.exec(q.headers.Authorization ?? '')?.[1]);
    expect(nc).toEqual(['00000003', '00000004']);
  });

  it('no token -> pair_required; wrong key -> pair_required', async () => {
    const f = fakeFetch(philipsTv());
    await expect(new PhilipsDriver({ host: 'h', fetch: f.fetch }).connect()).rejects.toMatchObject({ code: 'pair_required' });
    await expect(new PhilipsDriver({ host: 'h', fetch: f.fetch, token: `${DEVICE}:wrong`, random: rnd }).connect()).rejects.toMatchObject({
      code: 'pair_required',
    });
  });

  it('transport without response headers -> unsupported with explanation', async () => {
    const f = fakeFetch(philipsTv(), false);
    await expect(new PhilipsDriver({ host: 'h', fetch: f.fetch, token: TOKEN }).connect()).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('standby -> off; sources 404 -> no inputs capability', async () => {
    const { tv } = await connected();
    expect(tv.capabilities.has('inputs')).toBe(true);
    const f = fakeFetch(philipsTv({ 'GET /powerstate': { status: 200, body: r('powerStandby') }, 'GET /sources': { status: 404 } }));
    const tv2 = new PhilipsDriver({ host: 'h', fetch: f.fetch, token: TOKEN, random: rnd });
    const states: string[] = [];
    tv2.on((e) => e.type === 'state' && states.push(e.state));
    await tv2.connect();
    expect(states).toEqual(['connecting', 'off']);
    expect(tv2.capabilities.has('inputs')).toBe(false);
  });

  it('keys POST /6/input/key {key}', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('VOL_UP');
    await tv.sendKey('SOURCE');
    await tv.sendKey('RED');
    await tv.sendKey('NUM_0');
    expect(reqs.map((q) => [q.method, q.path, q.body])).toEqual([
      ['POST', '/6/input/key', { key: 'VolumeUp' }],
      ['POST', '/6/input/key', { key: 'Source' }],
      ['POST', '/6/input/key', { key: 'RedColour' }],
      ['POST', '/6/input/key', { key: 'Digit0' }],
    ]);
    expect(events).toContainEqual({ type: 'sent', what: 'VOL_UP', ms: 0 });
    await expect(tv.sendKey('BACKSPACE')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(tv.sendText('x')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('POWER sends Standby and flips state', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('POWER');
    expect(reqs[0]?.body).toEqual({ key: 'Standby' });
    expect(events).toContainEqual({ type: 'state', state: 'off' });
  });

  it('apps: list and launch with intent', async () => {
    const { tv, reqs } = await connected();
    const apps = await tv.listApps();
    expect(apps[1]).toEqual({ id: 'com.google.android.apps.youtube.tv.activity.ShellActivity-com.google.android.youtube.tv', name: 'YouTube' });
    await tv.launchApp(apps[0]!.id);
    expect(reqs.at(-1)).toMatchObject({
      method: 'POST',
      path: '/6/activities/launch',
      body: { intent: { component: { packageName: 'com.netflix.ninja', className: 'com.netflix.ninja.MainActivity' } } },
    });
    await expect(tv.launchApp('nope')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('launchApp fetches the app list when needed', async () => {
    const { tv, reqs } = await connected();
    await tv.launchApp('com.netflix.ninja.MainActivity-com.netflix.ninja');
    expect(reqs.map((q) => q.path)).toEqual(['/6/applications', '/6/activities/launch']);
  });

  it('inputs: list with current, set', async () => {
    const { tv, reqs } = await connected();
    const inputs = await tv.listInputs();
    expect(inputs.find((i) => i.current)?.id).toBe('hdmi1');
    await tv.setInput('hdmi2');
    expect(reqs.at(-1)).toMatchObject({ method: 'POST', path: '/6/sources/current', body: { id: 'hdmi2' } });
  });

  it('volume / setVolume', async () => {
    const { tv, reqs } = await connected();
    expect(await tv.volume()).toBe(14);
    await tv.setVolume(20);
    expect(reqs.at(-1)).toMatchObject({ method: 'POST', path: '/6/audio/volume', body: { muted: false, current: 20 } });
  });

  it('powerOn posts powerstate On; WOL fallback', async () => {
    const { tv, reqs } = await connected();
    await tv.powerOn();
    expect(reqs.at(-1)).toMatchObject({ method: 'POST', path: '/6/powerstate', body: { powerstate: 'On' } });
    const macs: string[] = [];
    let down = false;
    const base = philipsTv();
    const c = await connected((q) => (down ? new Error('ECONNREFUSED') : base(q)), {
      mac: '00:11:22:33:44:55',
      wol: async (m) => {
        macs.push(m);
      },
    });
    down = true;
    await c.tv.powerOn();
    expect(macs).toEqual(['00:11:22:33:44:55']);
  });

  it('requires connect', async () => {
    const tv = new PhilipsDriver({ host: 'h', fetch: fakeFetch(philipsTv()).fetch, token: TOKEN });
    await expect(tv.sendKey('OK')).rejects.toMatchObject({ code: 'not_connected' });
  });
});
