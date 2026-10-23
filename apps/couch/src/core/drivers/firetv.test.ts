import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, FetchLike } from '../driver';
import { setLocale, t } from '../../i18n/core';
import { describeError } from '../session';
import { KEYS } from '../keys';
import {
  FIRETV_ACTIONS,
  FIRETV_BETA,
  FIRETV_DEFAULT_API_KEY,
  FIRETV_PAIR_STEP,
  FIRETV_PATHS,
  FireTvDriver,
  NO_REMOTE_SERVICE_MESSAGE,
  VEGA_OS_MESSAGE,
  isTvSuppliedIcon,
  isVegaOs,
  parseFireTvApps,
  parseFireTvToken,
} from './firetv';

const R = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'firetv', 'replies.json'), 'utf8')) as Record<string, unknown>;
const r = (k: string) => {
  const v = R[k];
  return typeof v === 'string' ? v : JSON.stringify(v);
};

interface Req {
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}
type Reply = { status: number; body?: string } | Error;
type Responder = (req: Req) => Reply;

function fakeFetch(respond: Responder) {
  const reqs: Req[] = [];
  const fetch: FetchLike = async (url, init) => {
    const req: Req = {
      url,
      path: url.replace(/^https?:\/\/[^/]+/, ''),
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

const HOST = '192.168.1.80';
const TOKEN = 'c2VjcmV0LWNsaWVudC10b2tlbg';

/** Fire OS TV. `over` maps "METHOD path" to a reply. */
function fireTv(over: Record<string, Reply> = {}): Responder {
  return (req) => {
    const key = `${req.method} ${req.path}`;
    const o = over[key];
    if (o !== undefined) return o;
    if (req.url.startsWith(`http://${HOST}:8009`)) return { status: 201, body: r('wakeFireOs') };
    if (req.headers['x-api-key'] !== FIRETV_DEFAULT_API_KEY) return { status: 403 };
    if (req.path === FIRETV_PATHS.pinDisplay) return { status: 200, body: r('pinDisplay') };
    if (req.path === FIRETV_PATHS.pinVerify)
      return (req.body as { pin?: string }).pin === '4821' ? { status: 200, body: r('pinVerify') } : { status: 400, body: r('pinVerifyWrong') };
    if (req.headers['x-client-token'] !== TOKEN) return { status: 401 };
    if (req.path === FIRETV_PATHS.properties) return { status: 200, body: r('propertiesFireOs') };
    if (req.path === FIRETV_PATHS.apps) return { status: 200, body: r('apps') };
    return { status: 200, body: r('ok') };
  };
}

async function connected(respond: Responder = fireTv()) {
  const f = fakeFetch(respond);
  const tv = new FireTvDriver({ host: HOST, fetch: f.fetch, token: TOKEN, now: () => 0 });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  await tv.connect();
  f.reqs.length = 0;
  events.length = 0;
  return { tv, reqs: f.reqs, events };
}

describe('Fire TV constants and parsers', () => {
  it('beta flag and pair step', () => {
    expect(FIRETV_BETA).toBe(true);
    expect(FIRETV_PAIR_STEP).toEqual({ kind: 'code', length: 4 });
  });

  it('token from pin/verify', () => {
    expect(parseFireTvToken(r('pinVerify'))).toBe(TOKEN);
    expect(parseFireTvToken(r('pinDisplay'))).toBeUndefined();
    expect(parseFireTvToken('{"clientToken":"abc"}')).toBe('abc');
    expect(parseFireTvToken('nope')).toBeUndefined();
  });

  it('apps: array or {apps}, skips entries without a package', () => {
    const apps = parseFireTvApps(r('apps'));
    expect(apps.map((a) => a.id)).toEqual(['com.netflix.ninja', 'com.amazon.firetv.youtube', 'com.amazon.avod', 'com.plexapp.android']);
    expect(apps[0]).toMatchObject({ name: 'Netflix', icon: 'https://m.media-amazon.example/images/netflix-small.png' });
    expect(apps[3]).toEqual({ id: 'com.plexapp.android', name: 'Plex' });
    expect(parseFireTvApps(r('appsLanIcons')).map((a) => a.id)).toEqual(['org.xbmc.kodi', 'com.netflix.ninja']);
    expect(parseFireTvApps('garbage')).toEqual([]);
  });

  it('icons: only LAN or data: count as TV-supplied', () => {
    expect(isTvSuppliedIcon('http://192.168.1.80:8080/icons/x.png')).toBe(true);
    expect(isTvSuppliedIcon('data:image/png;base64,AAAA')).toBe(true);
    expect(isTvSuppliedIcon('https://m.media-amazon.example/x.png')).toBe(false);
  });

  it('Vega OS detection', () => {
    expect(isVegaOs(r('wakeFireOs'))).toBe(false);
    expect(isVegaOs(r('propertiesFireOs'))).toBe(false);
    expect(isVegaOs(r('wakeVegaXml'))).toBe(true);
    expect(isVegaOs(r('propertiesVega'))).toBe(true);
    expect(isVegaOs(r('propertiesKepler'))).toBe(true);
    expect(isVegaOs('{"deviceName":"Kepler room","os":"Fire OS 8"}')).toBe(false);
    expect(isVegaOs('{"platform":"Android"}')).toBe(false);
  });

  it('key map: known actions only, all real keys', () => {
    expect(FIRETV_ACTIONS.UP).toBe('dpad_up');
    expect(FIRETV_ACTIONS.OK).toBe('select');
    expect(FIRETV_ACTIONS.POWER).toBeUndefined();
    for (const k of Object.keys(FIRETV_ACTIONS)) expect(KEYS).toContain(k);
  });
});

describe('FireTvDriver pairing', () => {
  it('wake -> pin/display -> pin/verify -> token, persisted via onToken', async () => {
    const f = fakeFetch(fireTv());
    const tokens: string[] = [];
    const tv = new FireTvDriver({ host: HOST, fetch: f.fetch, friendlyName: 'Jo’s phone', onToken: (t) => tokens.push(t) });
    await tv.startPairing();
    expect(f.reqs[0]).toMatchObject({ url: 'http://192.168.1.80:8009/apps/FireTVRemote', method: 'POST' });
    expect(f.reqs[1]).toMatchObject({
      url: 'https://192.168.1.80:8080/v1/FireTV/pin/display',
      method: 'POST',
      headers: { 'x-api-key': FIRETV_DEFAULT_API_KEY },
      body: { friendlyName: 'Jo’s phone' },
    });
    expect(f.reqs[1]?.headers['x-client-token']).toBeUndefined();
    expect(await tv.finishPairing('4821')).toBe(TOKEN);
    expect(f.reqs[2]).toMatchObject({ path: '/v1/FireTV/pin/verify', body: { pin: '4821' } });
    expect(tokens).toEqual([TOKEN]);
    await tv.connect();
    expect(f.reqs.at(-1)?.headers['x-client-token']).toBe(TOKEN);
  });

  it('wrong or malformed PIN -> forbidden', async () => {
    const tv = new FireTvDriver({ host: HOST, fetch: fakeFetch(fireTv()).fetch });
    await tv.startPairing();
    await expect(tv.finishPairing('0000')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(tv.finishPairing('12')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('custom api key and default friendly name', async () => {
    const f = fakeFetch(() => ({ status: 200, body: '{}' }));
    const tv = new FireTvDriver({ host: HOST, fetch: f.fetch, apiKey: 'k-123' });
    await tv.startPairing();
    expect(f.reqs[1]?.headers['x-api-key']).toBe('k-123');
    expect(f.reqs[1]?.body).toEqual({ friendlyName: 'Couch Remote' });
  });

  it('pairing on Vega OS -> unsupported', async () => {
    const tv = new FireTvDriver({ host: HOST, fetch: fakeFetch(fireTv({ 'POST /apps/FireTVRemote': { status: 201, body: r('wakeVegaXml') } })).fetch });
    await expect(tv.startPairing()).rejects.toMatchObject({ code: 'unsupported', message: t(VEGA_OS_MESSAGE) });
  });
});

describe('FireTvDriver error messages go through the catalogue (T53)', () => {
  afterEach(() => setLocale('en'));

  it('Vega OS comes out pseudo-localised with the pseudo-locale active, code unchanged', async () => {
    setLocale('pseudo');
    const tv = new FireTvDriver({
      host: HOST,
      fetch: fakeFetch(fireTv({ 'GET /v1/FireTV/properties': { status: 200, body: r('propertiesVega') } })).fetch,
      token: TOKEN,
    });
    const messages: string[] = [];
    tv.on((e) => e.type === 'error' && messages.push(e.message));
    let err: unknown;
    try {
      await tv.connect();
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 'unsupported', message: t(VEGA_OS_MESSAGE, undefined, 'pseudo') });
    const shown = describeError(err);
    expect(shown).toBe(t(VEGA_OS_MESSAGE, undefined, 'pseudo'));
    expect(shown.startsWith('[')).toBe(true);
    expect(shown).not.toContain("Couch can't control yet");
    expect(shown).toContain('Ṽéĝá ÖŠ');
    expect(messages).toEqual([shown]);
  });

  it('brand names stay as data inside translated messages', async () => {
    setLocale('pseudo');
    const tv = new FireTvDriver({ host: HOST, fetch: fakeFetch(() => new Error('ECONNREFUSED')).fetch, token: TOKEN });
    let err: unknown;
    try {
      await tv.connect();
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 'network' });
    const msg = (err as Error).message;
    expect(msg.startsWith('[')).toBe(true);
    expect(msg).toContain('Fire TV');
  });
});

describe('FireTvDriver', () => {
  it('connect without a token wakes then -> pair_required; bad token -> pair_required', async () => {
    const f = fakeFetch(fireTv());
    await expect(new FireTvDriver({ host: HOST, fetch: f.fetch }).connect()).rejects.toMatchObject({ code: 'pair_required' });
    expect(f.reqs).toHaveLength(1);
    await expect(new FireTvDriver({ host: HOST, fetch: f.fetch, token: 'bad' }).connect()).rejects.toMatchObject({ code: 'pair_required' });
  });

  it('connect: wake, properties, connected; capabilities', async () => {
    const f = fakeFetch(fireTv());
    const tv = new FireTvDriver({ host: HOST, fetch: f.fetch, token: TOKEN });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(f.reqs.map((q) => `${q.method} ${q.path}`)).toEqual(['POST /apps/FireTVRemote', 'GET /v1/FireTV/properties']);
    expect(states).toEqual(['connecting', 'connected']);
    expect([...tv.capabilities].sort()).toEqual(['apps', 'keys', 'launch', 'text']);
  });

  it('connect tolerates a missing properties endpoint', async () => {
    const { tv } = await connected(fireTv({ 'GET /v1/FireTV/properties': { status: 404 } }));
    await tv.sendKey('OK');
  });

  it('Vega OS from properties or wake -> unsupported with the user message', async () => {
    const states: string[] = [];
    const tv = new FireTvDriver({
      host: HOST,
      fetch: fakeFetch(fireTv({ 'GET /v1/FireTV/properties': { status: 200, body: r('propertiesVega') } })).fetch,
      token: TOKEN,
    });
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await expect(tv.connect()).rejects.toMatchObject({ code: 'unsupported', message: "This Fire TV runs Vega OS, which Couch can't control yet." });
    expect(states).toEqual(['connecting', 'error']);
    await expect(tv.sendKey('OK')).rejects.toMatchObject({ code: 'not_connected' });

    const wakeVega = new FireTvDriver({
      host: HOST,
      fetch: fakeFetch(fireTv({ 'POST /apps/FireTVRemote': { status: 201, body: r('wakeVegaXml') } })).fetch,
      token: TOKEN,
    });
    await expect(wakeVega.connect()).rejects.toMatchObject({ code: 'unsupported', message: t(VEGA_OS_MESSAGE) });

    const noService = new FireTvDriver({ host: HOST, fetch: fakeFetch(fireTv({ 'POST /apps/FireTVRemote': { status: 404 } })).fetch, token: TOKEN });
    await expect(noService.connect()).rejects.toMatchObject({ code: 'unsupported', message: t(NO_REMOTE_SERVICE_MESSAGE) });
  });

  it('unreachable / TLS failure -> network; timeout -> timeout', async () => {
    const tv = new FireTvDriver({ host: HOST, fetch: fakeFetch(() => new Error('ECONNREFUSED')).fetch, token: TOKEN });
    await expect(tv.connect()).rejects.toMatchObject({ code: 'network' });
    const tls = new FireTvDriver({
      host: HOST,
      fetch: fakeFetch((q) => (q.url.startsWith('https:') ? new Error('self signed certificate') : { status: 201 })).fetch,
      token: TOKEN,
    });
    await expect(tls.connect()).rejects.toMatchObject({ code: 'network' });
    const slow = new FireTvDriver({ host: HOST, fetch: fakeFetch(() => new Error('Request timed out')).fetch, token: TOKEN });
    await expect(slow.connect()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('keys go to /v1/FireTV?action= with both headers', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('UP');
    await tv.sendKey('OK');
    await tv.sendKey('VOL_DOWN');
    expect(reqs[0]).toMatchObject({
      url: 'https://192.168.1.80:8080/v1/FireTV?action=dpad_up',
      method: 'POST',
      headers: { 'x-api-key': FIRETV_DEFAULT_API_KEY, 'x-client-token': TOKEN },
    });
    expect(reqs[0]?.body).toBeUndefined();
    expect(reqs[1]?.path).toBe('/v1/FireTV?action=select');
    expect(reqs[2]?.path).toBe('/v1/FireTV?action=volume_down');
    expect(events).toContainEqual({ type: 'sent', what: 'UP', ms: 0 });
  });

  it('media keys: PLAY_PAUSE alternates pause/play, FF/REW scan with direction', async () => {
    const { tv, reqs } = await connected();
    await tv.sendKey('PLAY_PAUSE');
    await tv.sendKey('PLAY_PAUSE');
    await tv.sendKey('FF');
    await tv.sendKey('REW');
    expect(reqs.map((q) => q.path)).toEqual(['/v1/media?action=pause', '/v1/media?action=play', '/v1/media?action=scan', '/v1/media?action=scan']);
    expect(reqs[2]?.body).toEqual({ direction: 'forward' });
    expect(reqs[3]?.body).toEqual({ direction: 'back' });
  });

  it('unmapped keys -> unsupported without a request; TV 404 -> unsupported; 401 -> pair_required', async () => {
    const { tv, reqs } = await connected();
    for (const k of ['POWER', 'RED', 'NUM_1', 'INPUT', 'VOICE'] as const) await expect(tv.sendKey(k)).rejects.toMatchObject({ code: 'unsupported' });
    expect(reqs).toHaveLength(0);
    const c = await connected(fireTv({ 'POST /v1/FireTV?action=menu': { status: 404 }, 'POST /v1/FireTV?action=home': { status: 401 } }));
    await expect(c.tv.sendKey('MENU')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(c.tv.sendKey('HOME')).rejects.toMatchObject({ code: 'pair_required' });
  });

  it('text', async () => {
    const { tv, reqs } = await connected();
    await tv.sendText('stranger things');
    expect(reqs[0]).toMatchObject({ method: 'POST', path: '/v1/FireTV/text', body: { text: 'stranger things' } });
  });

  it('apps: list, launch by package, cloud icons not exposed', async () => {
    const { tv, reqs } = await connected();
    const apps = await tv.listApps();
    expect(apps[0]).toEqual({ id: 'com.netflix.ninja', name: 'Netflix' });
    expect(reqs[0]).toMatchObject({ method: 'GET', path: '/v1/FireTV/apps' });
    expect(tv.capabilities.has('appIcons')).toBe(false);
    expect(await tv.appIcon({ id: 'com.netflix.ninja', name: 'Netflix' })).toBeNull();
    await tv.launchApp('com.netflix.ninja');
    expect(reqs[1]).toMatchObject({ method: 'POST', path: '/v1/FireTV/app/com.netflix.ninja' });
  });

  it('apps with LAN icons enable appIcons', async () => {
    const { tv } = await connected(fireTv({ 'GET /v1/FireTV/apps': { status: 200, body: r('appsLanIcons') } }));
    await tv.listApps();
    expect(tv.capabilities.has('appIcons')).toBe(true);
    expect(await tv.appIcon({ id: 'org.xbmc.kodi', name: 'Kodi' })).toBe('http://192.168.1.80:8080/icons/org.xbmc.kodi.png');
    expect(await tv.appIcon({ id: 'com.netflix.ninja', name: 'Netflix' })).toBeNull();
  });

  it('requires connect; disconnect', async () => {
    const tv = new FireTvDriver({ host: HOST, fetch: fakeFetch(fireTv()).fetch, token: TOKEN });
    await expect(tv.sendKey('OK')).rejects.toMatchObject({ code: 'not_connected' });
    await expect(tv.sendText('x')).rejects.toMatchObject({ code: 'not_connected' });
    await tv.connect();
    await tv.disconnect();
    await expect(tv.launchApp('x')).rejects.toMatchObject({ code: 'not_connected' });
  });
});
