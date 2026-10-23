import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { DriverEvent } from '../../driver';
import { KEYS } from '../../keys';
import { DriverError } from '../../types';
import {
  ANDROIDTV_PAIRING_PORT,
  ANDROIDTV_REMOTE_PORT,
  AndroidTvDriver,
  TlsAuthError,
  type ClientIdentity,
  type TlsClientFactory,
  type TlsSocketLike,
} from './driver';
import { ANDROIDTV_KEYS } from './keys';
import type { RsaPublicKey } from './pairing';
import { FrameReader, decodePairingMessage, decodeRemoteMessage, fromHex, toHex } from './proto';

const FX = JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', 'androidtv', 'frames.json'), 'utf8')) as Record<
  string,
  Record<string, string>
>;
const fx = (group: string, k: string): Uint8Array => fromHex(FX[group]![k]!);
const hex = (s: string): string => s.replace(/\s+/g, '').toLowerCase();
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const HOST = '192.168.1.60';

// ---------- fakes ----------

const clientKey: RsaPublicKey = { modulus: new Uint8Array(256).map((_, i) => (i === 0 ? 0xd1 : (i * 3 + 9) & 0xff)), exponent: fromHex('010001') };
const serverKey: RsaPublicKey = { modulus: new Uint8Array(257).map((_, i) => (i === 0 ? 0 : i === 1 ? 0xa7 : (i * 11) & 0xff)), exponent: fromHex('010001') };
const IDENTITY: ClientIdentity = { certPem: 'CERT', keyPem: 'KEY', publicKey: clientKey };

/** A code the fake TV would display for these keys (first byte of the hash + tail). */
function tvCode(tail = 'c0de'): string {
  const h = createHash('sha256');
  h.update(clientKey.modulus).update(clientKey.exponent).update(serverKey.modulus.subarray(1)).update(serverKey.exponent).update(fromHex(tail));
  const d = h.digest();
  return d.subarray(0, 1).toString('hex') + tail;
}

class FakeTls implements TlsSocketLike {
  written: Uint8Array[] = [];
  closed = false;
  /** Replies to send (in order) after each client write; undefined = say nothing. */
  script: (Uint8Array[] | undefined)[] = [];
  private data: ((d: Uint8Array) => void)[] = [];
  private cls: ((e?: Error) => void)[] = [];
  write(d: Uint8Array): void {
    if (this.closed) throw new Error('closed');
    this.written.push(d.slice());
    const reply = this.script.shift();
    if (reply) setTimeout(() => reply.forEach((r) => this.receive(r)), 0);
  }
  close(): void {
    this.closed = true;
  }
  onData(cb: (d: Uint8Array) => void): void {
    this.data.push(cb);
  }
  onClose(cb: (e?: Error) => void): void {
    this.cls.push(cb);
  }
  peerPublicKey(): RsaPublicKey {
    return serverKey;
  }
  receive(d: Uint8Array): void {
    for (const c of this.data) c(d);
  }
  serverClose(): void {
    this.closed = true;
    for (const c of this.cls) c();
  }
  get writtenHex(): string[] {
    return this.written.map(toHex);
  }
}

function setup(opts: { reject?: Error } = {}) {
  const sockets: { port: number; sock: FakeTls; client: { certPem: string; keyPem: string } }[] = [];
  let next: FakeTls | undefined;
  const tls: TlsClientFactory = async (host, port, client) => {
    expect(host).toBe(HOST);
    if (opts.reject) throw opts.reject;
    const sock = next ?? new FakeTls();
    next = undefined;
    sockets.push({ port, sock, client });
    return sock;
  };
  let t = 1000;
  const d = new AndroidTvDriver({ host: HOST, tls, identity: IDENTITY, now: () => (t += 3), timeoutMs: 200, startGraceMs: 20 });
  const events: DriverEvent[] = [];
  d.on((e) => events.push(e));
  return {
    d,
    events,
    sockets,
    prepare(s: FakeTls) {
      next = s;
    },
  };
}

function pairingSock(): FakeTls {
  const s = new FakeTls();
  s.script = [[fx('pairing_server', 'requestAck')], [fx('pairing_server', 'options')], [fx('pairing_server', 'configurationAck')], [fx('pairing_server', 'secretAck')]];
  return s;
}

/** Connects with the TV saying configure, set_active and remote_start(on/off). */
async function connected(on = true) {
  const env = setup();
  const s = new FakeTls();
  env.prepare(s);
  const p = env.d.connect();
  await tick();
  s.receive(fx('remote_server', 'configure'));
  s.receive(fx('remote_server', 'setActive'));
  s.receive(fx('remote_server', on ? 'startOn' : 'startOff'));
  await p;
  s.written = [];
  return { ...env, s };
}

// ---------- pairing ----------

describe('pairing', () => {
  test('request -> options -> configuration, then code -> secret -> paired', async () => {
    const { d, sockets, prepare } = setup();
    const s = pairingSock();
    prepare(s);
    await expect(d.startPairing()).resolves.toEqual({ serverName: 'Living Room TV' });
    expect(sockets[0]!.port).toBe(ANDROIDTV_PAIRING_PORT);
    expect(sockets[0]!.client).toEqual({ certPem: 'CERT', keyPem: 'KEY' });
    expect(d.pairingState).toBe('awaiting_code');
    expect(s.writtenHex).toEqual([hex(FX.pairing_client!.request!), hex(FX.pairing_client!.options!), hex(FX.pairing_client!.configuration!)]);

    const code = tvCode();
    await d.submitCode(code.toLowerCase());
    expect(d.pairingState).toBe('paired');
    expect(s.closed).toBe(true);
    const secretFrame = s.written[3]!;
    expect(toHex(secretFrame).startsWith(hex(FX.pairing_client!.secretPrefix!))).toBe(true);
    const sent = decodePairingMessage(new FrameReader().push(secretFrame)[0]!);
    const h = createHash('sha256');
    h.update(clientKey.modulus).update(clientKey.exponent).update(serverKey.modulus.subarray(1)).update(serverKey.exponent).update(fromHex(code.slice(2)));
    expect(toHex(sent.secret!.secret)).toBe(h.digest('hex'));
  });

  test('a mistyped code is rejected locally and pairing stays open for a retry', async () => {
    const { d, prepare, events } = setup();
    const s = pairingSock();
    prepare(s);
    await d.startPairing();
    const good = tvCode();
    const bad = ((parseInt(good.slice(0, 2), 16) + 1) & 0xff).toString(16).padStart(2, '0') + good.slice(2);
    await expect(d.submitCode(bad)).rejects.toMatchObject({ code: 'pair_required' });
    await expect(d.submitCode('12')).rejects.toMatchObject({ code: 'pair_required' });
    expect(s.written).toHaveLength(3); // nothing sent
    expect(d.pairingState).toBe('awaiting_code');
    expect(events.some((e) => e.type === 'error')).toBe(true);
    await d.submitCode(good);
    expect(d.pairingState).toBe('paired');
  });

  test('TV answers BAD_SECRET -> failed', async () => {
    const { d, prepare } = setup();
    const s = pairingSock();
    s.script[3] = [fx('pairing_server', 'badSecret')];
    prepare(s);
    await d.startPairing();
    await expect(d.submitCode(tvCode())).rejects.toMatchObject({ code: 'pair_required' });
    expect(d.pairingState).toBe('failed');
    expect(s.closed).toBe(true);
  });

  test('TV rejects configuration -> unsupported', async () => {
    const { d, prepare } = setup();
    const s = pairingSock();
    s.script[2] = [fx('pairing_server', 'badConfiguration')];
    prepare(s);
    await expect(d.startPairing()).rejects.toMatchObject({ code: 'unsupported' });
    expect(d.pairingState).toBe('failed');
  });

  test('replies split byte-by-byte still parse', async () => {
    const { d, prepare } = setup();
    const s = pairingSock();
    const split = (b: Uint8Array): Uint8Array[] => Array.from(b, (x) => Uint8Array.of(x));
    s.script = s.script.map((r) => r && r.flatMap(split));
    prepare(s);
    await expect(d.startPairing()).resolves.toEqual({ serverName: 'Living Room TV' });
  });

  test('TV closes during pairing / never answers', async () => {
    const a = setup();
    const s1 = pairingSock();
    s1.script = [undefined];
    a.prepare(s1);
    const p = a.d.startPairing();
    await tick();
    s1.serverClose();
    await expect(p).rejects.toMatchObject({ code: 'network' });

    const b = setup();
    const s2 = pairingSock();
    s2.script = [undefined];
    b.prepare(s2);
    await expect(b.d.startPairing()).rejects.toMatchObject({ code: 'timeout' });
  });

  test('submitCode without startPairing', async () => {
    const { d } = setup();
    await expect(d.submitCode('ABCDEF')).rejects.toMatchObject({ code: 'pair_required' });
  });

  test('unreachable TV', async () => {
    const { d } = setup({ reject: new Error('ECONNREFUSED') });
    await expect(d.startPairing()).rejects.toMatchObject({ code: 'network' });
  });
});

// ---------- remote session ----------

describe('remote session', () => {
  test('handshake: answers configure and set_active, connects on remote_start', async () => {
    const { d, sockets, prepare, events } = setup();
    const s = new FakeTls();
    prepare(s);
    const p = d.connect();
    await tick();
    expect(sockets[0]!.port).toBe(ANDROIDTV_REMOTE_PORT);
    s.receive(fx('remote_server', 'configure'));
    s.receive(fx('remote_server', 'setActive'));
    s.receive(fx('remote_server', 'startOn'));
    await p;
    expect(s.writtenHex).toEqual([hex(FX.remote_client!.configure!), hex(FX.remote_client!.setActive!)]);
    expect(d.tvInfo).toEqual({ model: 'TestTV', vendor: 'Example' });
    expect(d.isOn).toBe(true);
    expect(events.filter((e) => e.type === 'state').map((e) => (e as { state: string }).state)).toEqual(['connecting', 'connected']);
  });

  test('all handshake frames in one chunk', async () => {
    const { d, prepare } = setup();
    const s = new FakeTls();
    prepare(s);
    const p = d.connect();
    await tick();
    s.receive(new Uint8Array([...fx('remote_server', 'configure'), ...fx('remote_server', 'setActive'), ...fx('remote_server', 'startOn')]));
    await p;
    expect(s.written).toHaveLength(2);
  });

  test('no remote_start: connected after the grace period', async () => {
    const { d, prepare } = setup();
    const s = new FakeTls();
    prepare(s);
    const p = d.connect();
    await tick();
    s.receive(fx('remote_server', 'configure'));
    s.receive(fx('remote_server', 'setActive'));
    await p;
    expect(d.isOn).toBeUndefined();
  });

  test('answers pings with val1', async () => {
    const { s } = await connected();
    s.receive(fx('remote_server', 'ping'));
    expect(s.writtenHex).toEqual([hex(FX.remote_client!.pong!)]);
  });

  test('certificate refused -> pair_required', async () => {
    const { d, events } = setup({ reject: new TlsAuthError() });
    await expect(d.connect()).rejects.toMatchObject({ code: 'pair_required' });
    expect(events.some((e) => e.type === 'state' && e.state === 'error')).toBe(true);
  });

  test('TV drops the socket before configure -> pair_required; after -> network', async () => {
    const a = setup();
    const s1 = new FakeTls();
    a.prepare(s1);
    const p1 = a.d.connect();
    await tick();
    s1.serverClose();
    await expect(p1).rejects.toMatchObject({ code: 'pair_required' });

    const b = setup();
    const s2 = new FakeTls();
    b.prepare(s2);
    const p2 = b.d.connect();
    await tick();
    s2.receive(fx('remote_server', 'configure'));
    s2.serverClose();
    await expect(p2).rejects.toMatchObject({ code: 'network' });
  });

  test('handshake timeout', async () => {
    const { d } = setup();
    await expect(d.connect()).rejects.toMatchObject({ code: 'timeout' });
  });

  test('disconnect and server close', async () => {
    const { d, s, events } = await connected();
    s.serverClose();
    expect(events.at(-1)).toEqual({ type: 'state', state: 'disconnected' });
    await expect(d.sendKey('UP')).rejects.toMatchObject({ code: 'not_connected' });
    const c = await connected();
    await c.d.disconnect();
    expect(c.s.closed).toBe(true);
    await expect(c.d.sendKey('UP')).rejects.toMatchObject({ code: 'not_connected' });
  });

  test('remote_error and unknown messages', async () => {
    const { s, events } = await connected();
    s.receive(fx('remote_server', 'imeKeyInject'));
    s.receive(fx('remote_server', 'error'));
    expect(events.filter((e) => e.type === 'error')).toHaveLength(1);
  });
});

// ---------- commands ----------

describe('commands', () => {
  test('sendKey sends SHORT key inject and a sent event', async () => {
    const { d, s, events } = await connected();
    await d.sendKey('UP');
    expect(s.writtenHex).toEqual([hex(FX.remote_client!.keyUpShort!)]);
    expect(events.at(-1)).toEqual({ type: 'sent', what: 'UP', ms: 3 });
  });

  test('keyDown / keyUp send START_LONG / END_LONG', async () => {
    const { d, s } = await connected();
    await d.keyDown('OK');
    await d.keyUp('OK');
    expect(s.writtenHex).toEqual([hex(FX.remote_client!.okStartLong!), hex(FX.remote_client!.okEndLong!)]);
  });

  test('every mapped key reaches the TV with its keycode; VOICE is unsupported', async () => {
    const { d, s } = await connected();
    for (const k of KEYS) {
      const code = ANDROIDTV_KEYS[k];
      if (code === undefined) {
        await expect(d.sendKey(k)).rejects.toMatchObject({ code: 'unsupported' });
        continue;
      }
      s.written = [];
      await d.sendKey(k);
      const m = decodeRemoteMessage(new FrameReader().push(s.written[0]!)[0]!);
      expect(m.remoteKeyInject).toEqual({ keyCode: code, direction: 3 });
    }
    expect(KEYS.filter((k) => ANDROIDTV_KEYS[k] === undefined)).toEqual(['VOICE']);
  });

  test('keycodes', () => {
    expect(ANDROIDTV_KEYS).toMatchObject({
      UP: 19, DOWN: 20, LEFT: 21, RIGHT: 22, OK: 23, BACK: 4, HOME: 3, MENU: 82, VOL_UP: 24, VOL_DOWN: 25, MUTE: 164,
      CH_UP: 166, CH_DOWN: 167, REW: 89, PLAY_PAUSE: 85, FF: 90, POWER: 26, INPUT: 178, SOURCE: 178, SETTINGS: 176,
      NUM_0: 7, NUM_9: 16, RED: 183, GREEN: 184, YELLOW: 185, BLUE: 186, SEARCH: 84, BACKSPACE: 67, ENTER: 66, NUM_DASH: 69,
    });
  });

  test('launchApp sends an app link', async () => {
    const { d, s } = await connected();
    await d.launchApp(' https://www.example.com/title ');
    const m = decodeRemoteMessage(new FrameReader().push(s.written[0]!)[0]!);
    expect(m).toEqual({ remoteAppLinkLaunchRequest: { appLink: 'https://www.example.com/title' } });
    await expect(d.launchApp('  ')).rejects.toMatchObject({ code: 'unsupported' });
  });

  test('sendText is unsupported; capabilities', async () => {
    const { d } = await connected();
    await expect(d.sendText('hi')).rejects.toBeInstanceOf(DriverError);
    expect([...d.capabilities].sort()).toEqual(['colorKeys', 'keys', 'launch', 'numbers', 'powerOn']);
    expect(d.capabilities.has('voice')).toBe(false);
    expect(d.beginVoice).toBeUndefined();
  });
});

// ---------- power ----------

describe('power', () => {
  test('TV in standby: state off, keys refused, POWER powers on', async () => {
    const { d, s, events } = await connected(false);
    expect(events.filter((e) => e.type === 'state').at(-1)).toEqual({ type: 'state', state: 'off' });
    await expect(d.sendKey('UP')).rejects.toMatchObject({ code: 'tv_off' });
    await d.sendKey('POWER');
    expect(s.writtenHex).toEqual([hex(FX.remote_client!.powerShort!)]);
    expect(events.at(-1)).toMatchObject({ type: 'sent', what: 'POWER_ON' });
    s.receive(fx('remote_server', 'startOn'));
    expect(d.isOn).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'state', state: 'connected' });
  });

  test('powerOn is a no-op when the TV is on (POWER would toggle it off)', async () => {
    const { d, s } = await connected(true);
    await d.powerOn();
    expect(s.written).toHaveLength(0);
    await d.sendKey('POWER'); // explicit POWER while on: plain toggle
    expect(s.writtenHex).toEqual([hex(FX.remote_client!.powerShort!)]);
  });

  test('powerOn connects first when needed', async () => {
    const { d, prepare } = setup();
    const s = new FakeTls();
    prepare(s);
    const p = d.powerOn();
    await tick();
    s.receive(fx('remote_server', 'configure'));
    s.receive(fx('remote_server', 'setActive'));
    s.receive(fx('remote_server', 'startOff'));
    await p;
    expect(toHex(s.written.at(-1)!)).toBe(hex(FX.remote_client!.powerShort!));
  });
});
