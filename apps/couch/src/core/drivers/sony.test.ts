import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent, FetchLike } from '../driver';
import { DriverError } from '../types';
import {
  SONY_IRCC_SOAPACTION,
  SonyDriver,
  irccEnvelope,
  parseApplicationList,
  parseExternalInputs,
  parsePowerStatus,
  parseRemoteControllerInfo,
  parseSystemInformation,
  parseVolume,
  sonyRpc,
} from './sony';

const FIX = join(__dirname, '__fixtures__', 'sony');
const read = (f: string) => readFileSync(join(FIX, f), 'utf8');
const RCI = read('remote-controller-info.json');
const APPS = read('application-list.json');
const INPUTS = read('external-inputs-status.json');
const SYSINFO = read('system-information.json');
const MISC = JSON.parse(read('misc.json')) as Record<string, unknown>;
const misc = (k: string) => JSON.stringify(MISC[k]);

interface Req {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  rpc?: { method: string; params: unknown[]; version: string };
}
type Responder = (req: Req) => { status: number; body?: string } | Error;

function fakeFetch(respond: Responder) {
  const reqs: Req[] = [];
  const fetch: FetchLike = async (url, init) => {
    const body = init?.body ?? '';
    const req: Req = { url, method: init?.method ?? 'GET', headers: init?.headers ?? {}, body };
    if (body.startsWith('{')) req.rpc = JSON.parse(body) as Req['rpc'];
    reqs.push(req);
    const r = respond(req);
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body ?? '' };
  };
  return { fetch, reqs };
}

function sonyTv(over: Partial<Record<string, string>> = {}, psk = '0000'): Responder {
  return (req) => {
    if (psk && req.headers['X-Auth-PSK'] !== psk) return { status: 403 };
    if (req.url.endsWith('/sony/IRCC')) return { status: 200, body: '<s:Envelope/>' };
    const m = req.rpc?.method ?? '';
    if (over[m] !== undefined) return { status: 200, body: over[m] };
    switch (m) {
      case 'getPowerStatus':
        return { status: 200, body: misc('powerActive') };
      case 'getRemoteControllerInfo':
        return { status: 200, body: RCI };
      case 'getSystemInformation':
        return { status: 200, body: SYSINFO };
      case 'getApplicationList':
        return { status: 200, body: APPS };
      case 'getCurrentExternalInputsStatus':
        return { status: 200, body: INPUTS };
      case 'getPlayingContentInfo':
        return { status: 200, body: misc('playingHdmi1') };
      case 'getVolumeInformation':
        return { status: 200, body: misc('volumeInformation') };
      default:
        return { status: 200, body: misc('ok') };
    }
  };
}

async function connected(respond: Responder = sonyTv(), opts: { psk?: string; wol?: (m: string) => Promise<void> } = { psk: '0000' }) {
  const f = fakeFetch(respond);
  const tv = new SonyDriver({ host: '192.168.1.88', fetch: f.fetch, psk: opts.psk, wol: opts.wol, now: () => 0 });
  const events: DriverEvent[] = [];
  tv.on((e) => events.push(e));
  await tv.connect();
  f.reqs.length = 0;
  events.length = 0;
  return { tv, reqs: f.reqs, events };
}

describe('Sony parsers', () => {
  it('builds JSON-RPC bodies', () => {
    expect(JSON.parse(sonyRpc('setAudioMute', [{ status: true }], '1.0', 9))).toEqual({
      method: 'setAudioMute',
      id: 9,
      params: [{ status: true }],
      version: '1.0',
    });
  });
  it('IRCC envelope carries the code', () => {
    const x = irccEnvelope('AAAAAQAAAAEAAAAvAw==');
    expect(x).toContain('<u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">');
    expect(x).toContain('<IRCCCode>AAAAAQAAAAEAAAAvAw==</IRCCCode>');
  });
  it('remote controller info -> name map', () => {
    const m = parseRemoteControllerInfo(RCI);
    expect(m.get('Confirm')).toBe('AAAAAQAAAAEAAABlAw==');
    expect(m.get('Num0')).toBe('AAAAAQAAAAEAAAAJAw==');
    expect(m.size).toBeGreaterThan(40);
    expect(parseRemoteControllerInfo('nope').size).toBe(0);
  });
  it('application list keeps TV icon URLs, drops entries without uri', () => {
    const apps = parseApplicationList(APPS);
    expect(apps).toHaveLength(5);
    expect(apps[0]).toEqual({
      id: 'com.sony.dtv.com.netflix.ninja.com.netflix.ninja.MainActivity',
      uri: 'com.sony.dtv.com.netflix.ninja.com.netflix.ninja.MainActivity',
      name: 'Netflix',
      icon: 'http://192.168.1.88/DIAL/icon/com.netflix.ninja.png',
    });
    expect(apps[3]?.icon).toBeUndefined();
    expect(apps[4]?.icon).toBeUndefined();
  });
  it('external inputs with labels and current flag', () => {
    const inputs = parseExternalInputs(INPUTS, 'extInput:hdmi?port=1');
    expect(inputs).toHaveLength(5);
    expect(inputs[0]).toEqual({ id: 'extInput:hdmi?port=1', name: 'HDMI 1 (Xbox)', current: true });
    expect(inputs[1]).toEqual({ id: 'extInput:hdmi?port=2', name: 'HDMI 2/ARC', current: false });
    expect(parseExternalInputs(INPUTS)[0]?.current).toBeUndefined();
  });
  it('power, system info, volume', () => {
    expect(parsePowerStatus(misc('powerActive'))).toBe('active');
    expect(parsePowerStatus(misc('powerStandby'))).toBe('standby');
    expect(parsePowerStatus('{}')).toBeUndefined();
    expect(parseSystemInformation(SYSINFO)).toEqual({
      name: 'BRAVIA',
      model: 'KD-55X85J',
      mac: 'a0:c4:a5:e1:b2:c3',
      serial: '1234567',
      generation: '5.2.0',
    });
    expect(parseVolume(misc('volumeInformation'))).toEqual({ volume: 18, mute: false });
  });
});

describe('SonyDriver', () => {
  it('connect: power status, remote info, system info, all with the PSK header', async () => {
    const f = fakeFetch(sonyTv());
    const tv = new SonyDriver({ host: '192.168.1.88', fetch: f.fetch, psk: '0000' });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(f.reqs.map((r) => [r.url, r.rpc?.method])).toEqual([
      ['http://192.168.1.88/sony/system', 'getPowerStatus'],
      ['http://192.168.1.88/sony/system', 'getRemoteControllerInfo'],
      ['http://192.168.1.88/sony/system', 'getSystemInformation'],
    ]);
    expect(f.reqs.every((r) => r.method === 'POST' && r.headers['X-Auth-PSK'] === '0000')).toBe(true);
    expect(states).toEqual(['connecting', 'connected']);
    expect(tv.info?.model).toBe('KD-55X85J');
    expect([...tv.capabilities].sort()).toEqual(
      ['appIcons', 'apps', 'colorKeys', 'inputs', 'keys', 'launch', 'numbers', 'powerOn', 'text', 'volume'].sort(),
    );
  });

  it('wrong PSK -> forbidden with help; no PSK -> pair_required', async () => {
    const f = fakeFetch(sonyTv({}, 'right'));
    const tv = new SonyDriver({ host: '192.168.1.88', fetch: f.fetch, psk: 'wrong' });
    await expect(tv.connect()).rejects.toMatchObject({ code: 'forbidden' });
    const tv2 = new SonyDriver({ host: '192.168.1.88', fetch: f.fetch });
    await expect(tv2.connect()).rejects.toMatchObject({ code: 'pair_required' });
  });

  it('reports off when the TV is in standby', async () => {
    const f = fakeFetch(sonyTv({ getPowerStatus: misc('powerStandby') }));
    const tv = new SonyDriver({ host: '192.168.1.88', fetch: f.fetch, psk: '0000' });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(states).toEqual(['connecting', 'off']);
  });

  it('network failure -> network error', async () => {
    const tv = new SonyDriver({ host: 'x', fetch: fakeFetch(() => new Error('ECONNREFUSED')).fetch, psk: '0000' });
    await expect(tv.connect()).rejects.toMatchObject({ code: 'network' });
    const tv2 = new SonyDriver({ host: 'x', fetch: fakeFetch(() => new Error('Request timed out')).fetch, psk: '0000' });
    await expect(tv2.connect()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('sends keys over IRCC with the SOAP action and the code looked up by name', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('OK');
    expect(reqs[0]?.url).toBe('http://192.168.1.88/sony/IRCC');
    expect(reqs[0]?.headers.SOAPACTION).toBe(SONY_IRCC_SOAPACTION);
    expect(reqs[0]?.headers['X-Auth-PSK']).toBe('0000');
    expect(reqs[0]?.body).toContain('<IRCCCode>AAAAAQAAAAEAAABlAw==</IRCCCode>');
    expect(events).toContainEqual({ type: 'sent', what: 'OK', ms: 0 });
  });

  it('maps SOURCE/INPUT, SETTINGS, numbers, colours and dash by name', async () => {
    const { tv } = await connected();
    const rci = parseRemoteControllerInfo(RCI);
    expect(tv.irccCode('SOURCE')).toBe(rci.get('Input'));
    expect(tv.irccCode('INPUT')).toBe(rci.get('Input'));
    expect(tv.irccCode('SETTINGS')).toBe(rci.get('ActionMenu'));
    expect(tv.irccCode('MENU')).toBe(rci.get('Options'));
    expect(tv.irccCode('NUM_7')).toBe(rci.get('Num7'));
    expect(tv.irccCode('NUM_DASH')).toBe(rci.get('DOT'));
    expect(tv.irccCode('BLUE')).toBe(rci.get('Blue'));
    expect(tv.irccCode('BACK')).toBe(rci.get('Return'));
    expect(() => tv.irccCode('BACKSPACE')).toThrow(DriverError);
  });

  it('SETTINGS falls back to Options when ActionMenu is missing; no numbers/colours caps without them', async () => {
    const trimmed = JSON.stringify({
      result: [{ bundled: true }, [{ name: 'Options', value: 'OPT' }, { name: 'Confirm', value: 'C' }]],
      id: 1,
    });
    const { tv } = await connected(sonyTv({ getRemoteControllerInfo: trimmed }));
    expect(tv.irccCode('SETTINGS')).toBe('OPT');
    expect(tv.capabilities.has('numbers')).toBe(false);
    expect(tv.capabilities.has('colorKeys')).toBe(false);
  });

  it('unsupported key rejects and emits error', async () => {
    const { tv, reqs, events } = await connected();
    await expect(tv.sendKey('BACKSPACE')).rejects.toMatchObject({ code: 'unsupported' });
    expect(reqs).toHaveLength(0);
    expect(events[0]?.type).toBe('error');
  });

  it('PLAY_PAUSE alternates Pause / Play', async () => {
    const { tv, reqs } = await connected();
    await tv.sendKey('PLAY_PAUSE');
    await tv.sendKey('PLAY_PAUSE');
    const rci = parseRemoteControllerInfo(RCI);
    expect(reqs[0]?.body).toContain(rci.get('Pause'));
    expect(reqs[1]?.body).toContain(rci.get('Play'));
  });

  it('POWER uses setPowerStatus and toggles state', async () => {
    const { tv, reqs, events } = await connected();
    await tv.sendKey('POWER');
    expect(reqs[0]?.rpc).toMatchObject({ method: 'setPowerStatus', params: [{ status: false }] });
    expect(events).toContainEqual({ type: 'state', state: 'off' });
    await tv.sendKey('POWER');
    expect(reqs[1]?.rpc).toMatchObject({ method: 'setPowerStatus', params: [{ status: true }] });
  });

  it('powerOn falls back to WOL when setPowerStatus fails', async () => {
    const macs: string[] = [];
    let fail = false;
    const base = sonyTv();
    const { tv } = await connected((r) => (fail ? new Error('ECONNREFUSED') : base(r)), {
      psk: '0000',
      wol: async (m) => {
        macs.push(m);
      },
    });
    fail = true;
    await tv.powerOn();
    expect(macs).toEqual(['a0:c4:a5:e1:b2:c3']);
  });

  it('apps: list, TV-supplied icons, launch by uri', async () => {
    const { tv, reqs } = await connected();
    const apps = await tv.listApps();
    expect(apps[1]).toEqual({
      id: 'com.sony.dtv.com.google.android.youtube.tv.com.google.android.apps.youtube.tv.activity.ShellActivity',
      name: 'YouTube',
    });
    expect(await tv.appIcon(apps[0]!)).toBe('http://192.168.1.88/DIAL/icon/com.netflix.ninja.png');
    expect(await tv.appIcon(apps[3]!)).toBeNull();
    expect(await tv.appIcon({ id: 'unknown', name: 'x' })).toBeNull();
    await tv.launchApp(apps[0]!.id);
    expect(reqs.at(-1)?.url).toBe('http://192.168.1.88/sony/appControl');
    expect(reqs.at(-1)?.rpc).toMatchObject({ method: 'setActiveApp', params: [{ uri: apps[0]!.id }] });
  });

  it('inputs: list with current, then setPlayContent', async () => {
    const { tv, reqs } = await connected();
    const inputs = await tv.listInputs();
    expect(inputs.find((i) => i.current)?.id).toBe('extInput:hdmi?port=1');
    expect(reqs.find((r) => r.rpc?.method === 'getCurrentExternalInputsStatus')?.rpc?.version).toBe('1.1');
    await tv.setInput('extInput:hdmi?port=2');
    expect(reqs.at(-1)?.url).toBe('http://192.168.1.88/sony/avContent');
    expect(reqs.at(-1)?.rpc).toMatchObject({ method: 'setPlayContent', params: [{ uri: 'extInput:hdmi?port=2' }] });
  });

  it('inputs: no current flag when an app is in front (Illegal State)', async () => {
    const { tv } = await connected(sonyTv({ getPlayingContentInfo: misc('playingAppIllegalState') }));
    const inputs = await tv.listInputs();
    expect(inputs).toHaveLength(5);
    expect(inputs.every((i) => i.current === undefined)).toBe(true);
  });

  it('volume, setVolume, setMute go to /sony/audio', async () => {
    const { tv, reqs } = await connected();
    expect(await tv.volume()).toBe(18);
    await tv.setVolume('+1');
    expect(reqs.at(-1)?.rpc).toMatchObject({ method: 'setAudioVolume', params: [{ target: 'speaker', volume: '+1' }] });
    await tv.setMute(true);
    expect(reqs.at(-1)?.url).toBe('http://192.168.1.88/sony/audio');
    expect(reqs.at(-1)?.rpc).toMatchObject({ method: 'setAudioMute', params: [{ status: true }] });
  });

  it('sendText uses setTextForm', async () => {
    const { tv, reqs } = await connected();
    await tv.sendText('hello');
    expect(reqs[0]?.rpc).toMatchObject({ method: 'setTextForm', params: [{ text: 'hello' }] });
  });

  it('maps Bravia error arrays', async () => {
    const { tv } = await connected(sonyTv({ getVolumeInformation: misc('displayOff'), setActiveApp: misc('noSuchMethod') }));
    await expect(tv.volume()).rejects.toMatchObject({ code: 'tv_off' });
    await expect(tv.launchApp('x')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('requires connect', async () => {
    const tv = new SonyDriver({ host: 'x', fetch: fakeFetch(sonyTv()).fetch, psk: '0000' });
    await expect(tv.sendKey('OK')).rejects.toMatchObject({ code: 'not_connected' });
  });
});
