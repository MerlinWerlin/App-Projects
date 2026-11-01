/**
 * Google TV in the add-TV flow: cast-only saving when the remote socket is missing (Expo Go, older
 * builds), and real pairing (6-character code) when transport.androidTv exists. Fakes only.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addTvReducer,
  androidTvPairingDriver,
  castOnlyOffered,
  comingSoonMessage,
  createAddTvState,
  driverFor,
  finishAddTv,
  initialAddTvState,
  isSupported,
  startAndroidTvPairing,
  submitAndroidTvCode,
  transportCaps,
  type AddCandidate,
  type AddTvEvent,
  type AddTvState,
} from './addTv';
import { findCastTargets } from './cast/targets';
import type { AndroidTvTransport, FetchLike, Transport } from './driver';
import { AndroidTvDriver, type ClientIdentity, type TlsSocketLike } from './drivers/androidtv/driver';
import type { RsaPublicKey } from './drivers/androidtv/pairing';
import { fromHex } from './drivers/androidtv/proto';
import { CastOnlyDriver, castOnlyMessage, isCastOnlyDriver } from './drivers/castOnly';
import { Reconnector } from './reconnect';
import { restoreSaved } from './restore';
import { RemoteSession } from './session';
import { MemoryKv, SavedTvStore } from './store';
import { t } from '../i18n/core';

const HOST = '192.168.1.60';
const GOOGLE_TV: AddCandidate = { platform: 'androidtv', host: HOST, name: 'TCL C7K', model: 'Smart TV Pro', source: 'probe' };
const run = (s: AddTvState, ...events: AddTvEvent[]): AddTvState => events.reduce(addTvReducer, s);
const fetchDown: FetchLike = async () => {
  throw new Error('offline');
};

function found(c: AddCandidate, transport?: Transport): AddTvState {
  const start = transport ? createAddTvState({ transport }) : initialAddTvState;
  return run(start, { type: 'found', candidate: c }, { type: 'scanDone' }, { type: 'pick', host: c.host });
}

// ---------------------------------------------------------------- fakes for the remote socket

const FX = JSON.parse(readFileSync(join(__dirname, 'drivers', '__fixtures__', 'androidtv', 'frames.json'), 'utf8')) as Record<string, Record<string, string>>;
const fx = (group: string, k: string): Uint8Array => fromHex(FX[group]![k]!);
const clientKey: RsaPublicKey = { modulus: new Uint8Array(256).map((_, i) => (i === 0 ? 0xd1 : (i * 3 + 9) & 0xff)), exponent: fromHex('010001') };
const serverKey: RsaPublicKey = { modulus: new Uint8Array(256).map((_, i) => (i === 0 ? 0xa7 : (i * 11) & 0xff)), exponent: fromHex('010001') };
const IDENTITY: ClientIdentity = { certPem: 'CERT', keyPem: 'keychain', publicKey: clientKey };

function tvCode(tail = 'c0de'): string {
  const d = createHash('sha256').update(clientKey.modulus).update(clientKey.exponent).update(serverKey.modulus).update(serverKey.exponent).update(fromHex(tail)).digest();
  return (d.subarray(0, 1).toString('hex') + tail).toUpperCase();
}

class FakeTls implements TlsSocketLike {
  script: (Uint8Array[] | undefined)[] = [];
  closed = false;
  private data: ((d: Uint8Array) => void)[] = [];
  write(): void {
    const reply = this.script.shift();
    if (reply) setTimeout(() => reply.forEach((r) => this.receive(r)), 0);
  }
  close(): void {
    this.closed = true;
  }
  onData(cb: (d: Uint8Array) => void): void {
    this.data.push(cb);
  }
  onClose(): void {}
  peerPublicKey(): RsaPublicKey {
    return serverKey;
  }
  receive(d: Uint8Array): void {
    for (const c of this.data) c(d);
  }
}

/** transport.androidTv whose sockets play the fixture pairing (:6467) and remote (:6466) servers. */
function fakeAndroidTv(opts: { refuse?: boolean } = {}) {
  const ports: number[] = [];
  let identityCalls = 0;
  const atv: AndroidTvTransport = {
    identity: async () => {
      identityCalls += 1;
      return IDENTITY;
    },
    tls: async (_host, port) => {
      ports.push(port);
      if (opts.refuse) throw new Error('ECONNREFUSED');
      const s = new FakeTls();
      if (port === 6467) {
        s.script = [[fx('pairing_server', 'requestAck')], [fx('pairing_server', 'options')], [fx('pairing_server', 'configurationAck')], [fx('pairing_server', 'secretAck')]];
      } else {
        setTimeout(() => {
          s.receive(fx('remote_server', 'configure'));
          s.receive(fx('remote_server', 'setActive'));
          s.receive(fx('remote_server', 'startOn'));
        }, 0);
      }
      return s;
    },
  };
  return { atv, ports, identityCalls: () => identityCalls };
}

// ---------------------------------------------------------------- capability

describe('Google TV support follows the native remote socket', () => {
  it('is not supported without transport.androidTv (Expo Go, older builds)', () => {
    expect(isSupported('androidtv')).toBe(false);
    expect(isSupported('androidtv', { fetch: fetchDown })).toBe(false);
    expect(transportCaps({ fetch: fetchDown })).toEqual({ fetch: true, ws: false });
  });

  it('is supported with it, and caps say so', () => {
    const { atv } = fakeAndroidTv();
    expect(transportCaps({ fetch: fetchDown, androidTv: atv })).toEqual({ fetch: true, ws: false, androidTv: true });
    expect(isSupported('androidtv', { fetch: fetchDown, androidTv: atv })).toBe(true);
    expect(isSupported('androidtv', { fetch: true, ws: false, androidTv: true })).toBe(true);
  });

  it('driverFor: AndroidTvDriver with the socket; otherwise (or when saved castOnly) a cast-only driver', () => {
    const { atv } = fakeAndroidTv();
    expect(driverFor({ platform: 'androidtv', host: HOST }, { androidTv: atv })).toBeInstanceOf(AndroidTvDriver);
    const none = driverFor({ platform: 'androidtv', host: HOST }, {});
    expect(none).toBeInstanceOf(CastOnlyDriver);
    expect((none as CastOnlyDriver).remoteAvailable).toBe(false);
    const saved = driverFor({ platform: 'androidtv', host: HOST, castOnly: true }, { androidTv: atv });
    expect(isCastOnlyDriver(saved)).toBe(true);
    expect((saved as CastOnlyDriver).remoteAvailable).toBe(true);
    expect((saved as CastOnlyDriver).message()).toBe(castOnlyMessage(true));
  });
});

// ---------------------------------------------------------------- cast-only (task A)

describe('cast-only Google TV (no remote socket)', () => {
  it('the coming-soon step offers casting, with its own explanation', () => {
    const s = found(GOOGLE_TV);
    expect(s.step).toBe('unsupported');
    if (s.step !== 'unsupported') return;
    expect(s.castOnly).toBe(true);
    expect(s.message).toBe(t('core.addTv.castOnlyIntro'));
    expect(s.message).not.toBe(comingSoonMessage('androidtv'));
  });

  it('is offered only for real Google TVs on a local IPv4 address', () => {
    expect(castOnlyOffered(GOOGLE_TV)).toBe(true);
    expect(castOnlyOffered({ ...GOOGLE_TV, host: '8.8.8.8' })).toBe(false);
    expect(castOnlyOffered({ ...GOOGLE_TV, host: 'tv.local' })).toBe(false);
    expect(castOnlyOffered({ ...GOOGLE_TV, platform: 'firetv' })).toBe(false);
    expect(castOnlyOffered({ ...GOOGLE_TV, platform: 'mock', pairAs: 'androidtv' })).toBe(false);
    const fire = found({ ...GOOGLE_TV, platform: 'firetv' });
    expect(fire.step === 'unsupported' && fire.castOnly).toBe(false);
    // castOnly is ignored where it is not offered
    expect(addTvReducer(fire, { type: 'castOnly' })).toBe(fire);
  });

  it('castOnly -> name step with the default name; back returns to the coming-soon step', () => {
    const s = run(found(GOOGLE_TV), { type: 'castOnly' });
    expect(s).toMatchObject({ step: 'name', name: 'TV 1', room: '', castOnly: true, pair: { kind: 'none' } });
    const back = addTvReducer(s, { type: 'back' });
    expect(back).toMatchObject({ step: 'unsupported', castOnly: true });
  });

  it('saves without a remote connection: TVs list, store, session, Cast target, no reconnect', async () => {
    let s = run(found(GOOGLE_TV), { type: 'castOnly' }, { type: 'nameChanged', name: 'Lounge' }, { type: 'roomChanged', room: 'Upstairs' }, { type: 'save' });
    if (s.step !== 'name') throw new Error('expected name step');
    const session = new RemoteSession(() => 1);
    const store = new SavedTvStore(new MemoryKv(), () => 7);
    const ev = await finishAddTv(s, { transport: { fetch: fetchDown }, session, store, now: () => 7 });
    expect(ev.type).toBe('saved');
    s = addTvReducer(s, ev);
    expect(s.step === 'saved' && s.tv).toMatchObject({ platform: 'androidtv', name: 'Lounge', room: 'Upstairs', castOnly: true, host: HOST });

    const saved = await store.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ castOnly: true, platform: 'androidtv' });

    // Session: listed and active; controls fail with the one clear message, never throw.
    expect(session.getSnapshot().tvs.map((x) => x.name)).toEqual(['Lounge']);
    const d = session.activeDriver();
    expect(isCastOnlyDriver(d)).toBe(true);
    expect(d!.capabilities.size).toBe(0);
    expect(await session.sendKey('UP')).toBe(false);
    expect(session.getSnapshot().lastError).toBe(castOnlyMessage(false));
    expect(session.getSnapshot().state).toBeNull();

    // Reconnector: nothing to retry, ever.
    const rec = new Reconnector();
    rec.bind(session);
    rec.onForeground();
    rec.reconnectNow();
    expect(rec.getStatus().phase).toBe('idle');
    rec.dispose();

    // Cast tab: offered as a Google Cast target when the TLS socket exists.
    const env = { fetch: fetchDown, udp: null, tcp: async () => { throw new Error('unused'); } };
    const targets = await findCastTargets(env, session.getSnapshot().tvs);
    expect(targets.map((x) => x.kind)).toContain('googlecast');
  });

  it('restores on the next start (not skipped), still cast-only', async () => {
    const store = new SavedTvStore(new MemoryKv());
    await store.add({ id: 'androidtv-x', name: 'Lounge', model: 'Smart TV Pro', platform: 'androidtv', host: HOST, castOnly: true });
    const r = await restoreSaved(store, { fetch: fetchDown });
    expect(r.skipped).toEqual([]);
    expect(r.tvs.map((x) => x.id)).toEqual(['androidtv-x']);
    expect(isCastOnlyDriver(r.drivers.get('androidtv-x'))).toBe(true);
  });

  it('the store drops a malformed castOnly flag', async () => {
    const kv = new MemoryKv();
    const store = new SavedTvStore(kv);
    await store.add({ id: 'a', name: 'A', model: 'm', platform: 'androidtv', host: HOST, castOnly: 'yes' as unknown as boolean });
    const again = new SavedTvStore(kv);
    expect((await again.list())[0]!.castOnly).toBeUndefined();
  });
});

// ---------------------------------------------------------------- pairing with the socket (task B)

describe('Google TV pairing with the remote socket', () => {
  it('pick -> code step; the TV shows the code; the typed code pairs; save connects the paired driver', async () => {
    const { atv, ports, identityCalls } = fakeAndroidTv();
    const transport: Transport = { fetch: fetchDown, androidTv: atv };
    let s = found(GOOGLE_TV, transport);
    expect(s).toMatchObject({ step: 'pair', pair: { kind: 'code', length: 6, charset: 'hex' } });
    if (s.step !== 'pair') return;

    const d = androidTvPairingDriver(s.candidate, transport)!;
    expect(d).toBeInstanceOf(AndroidTvDriver);
    expect(await startAndroidTvPairing(d)).toBeNull();
    expect(d.pairingState).toBe('awaiting_code');

    const code = tvCode();
    s = run(s, { type: 'codeChanged', code });
    const ev = await submitAndroidTvCode(d, code);
    expect(ev).toEqual({ type: 'paired' });
    s = run(s, ev, { type: 'save' });
    if (s.step !== 'name') throw new Error('expected name step');
    expect(s.castOnly).toBeUndefined();

    const session = new RemoteSession();
    const store = new SavedTvStore(new MemoryKv());
    const done = await finishAddTv(s, { transport, session, store, driver: d });
    expect(done.type).toBe('saved');
    expect(ports).toEqual([6467, 6466]);
    expect(identityCalls()).toBe(1);
    expect(session.activeDriver()).toBe(d);
    expect((await store.list())[0]!.castOnly).toBeUndefined();
    expect(await session.sendKey('HOME')).toBe(true);
  });

  it('a mistyped code is a pairFailed event that keeps pairing open', async () => {
    const { atv } = fakeAndroidTv();
    const s = found(GOOGLE_TV, { androidTv: atv });
    if (s.step !== 'pair') throw new Error('expected pair step');
    const d = androidTvPairingDriver(s.candidate, { androidTv: atv })!;
    await startAndroidTvPairing(d);
    const good = tvCode();
    const bad = ((parseInt(good.slice(0, 2), 16) + 1) & 0xff).toString(16).padStart(2, '0').toUpperCase() + good.slice(2);
    const ev = await submitAndroidTvCode(d, bad);
    expect(ev.type).toBe('pairFailed');
    const after = addTvReducer(s, ev);
    expect(after.step === 'pair' && after.error).toBe(t('core.driver.androidtv.codeMismatch'));
    expect(d.pairingState).toBe('awaiting_code');
    // typing clears the error
    expect(addTvReducer(after, { type: 'codeChanged', code: 'A' })).toMatchObject({ step: 'pair', error: null });
  });

  it('an unreachable TV is a pairFailed event (never throws)', async () => {
    const { atv } = fakeAndroidTv({ refuse: true });
    const d = androidTvPairingDriver(GOOGLE_TV, { androidTv: atv })!;
    const ev = await startAndroidTvPairing(d);
    expect(ev).toEqual({ type: 'pairFailed', message: t('core.driver.androidtv.pairUnreachable', { port: '6467' }) });
  });

  it('no pairing driver for demo candidates or without the socket', () => {
    const { atv } = fakeAndroidTv();
    expect(androidTvPairingDriver(GOOGLE_TV, {})).toBeNull();
    expect(androidTvPairingDriver({ ...GOOGLE_TV, platform: 'mock', pairAs: 'androidtv' }, { androidTv: atv })).toBeNull();
    expect(androidTvPairingDriver({ ...GOOGLE_TV, platform: 'roku' }, { androidTv: atv })).toBeNull();
  });

  it('a failing identity loader becomes a translated pairing error', async () => {
    const atv: AndroidTvTransport = {
      identity: async () => {
        throw new Error('keychain');
      },
      tls: async () => {
        throw new Error('unused');
      },
    };
    const d = androidTvPairingDriver(GOOGLE_TV, { androidTv: atv })!;
    expect(await startAndroidTvPairing(d)).toEqual({ type: 'pairFailed', message: t('core.driver.androidtv.identity') });
  });
});
