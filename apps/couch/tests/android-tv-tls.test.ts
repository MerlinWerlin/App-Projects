/**
 * Google TV remote transport over the lan-wss LanAtv native code (src/native/androidTvTls.ts). In
 * tests the native module is absent (like Expo Go), so it loads as null and Google TVs stay
 * cast-only; behaviour is checked against a fake module whose "Keychain" is a node RSA key.
 */
import { X509Certificate, generateKeyPairSync, sign } from 'node:crypto';
import { isSupported, transportCaps } from '../src/core/addTv';
import { fromBase64, toBase64 } from '../src/core/crypto/bytes';
import { TlsAuthError } from '../src/core/drivers/androidtv/driver';
import { certificatePublicKey, parseRsaPublicKey, sameRsaKey } from '../src/core/drivers/androidtv/x509';
import {
  ERR_ATV_TLS_AUTH,
  KEYCHAIN_KEY_REF,
  androidTvFromModule,
  atvTlsFromModule,
  ensureIdentity,
  hasAndroidTvTls,
  loadAndroidTvTransport,
  type LanAtvModule,
} from '../src/native/androidTvTls';
import { appTransport } from '../src/native/transport';

type Listener = (e: { id: string; base64?: string; message?: string }) => void;

function pkcs1(k: ReturnType<typeof generateKeyPairSync>['publicKey']): Uint8Array {
  return new Uint8Array(k.export({ type: 'pkcs1', format: 'der' }));
}

function fakeModule(opts: { connectError?: unknown; storedCert?: Uint8Array; setCertOk?: boolean } = {}) {
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const tvKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let cert: Uint8Array | null = opts.storedCert ?? null;
  const calls: string[] = [];
  const listeners: { event: string; cb: Listener; removed: boolean }[] = [];
  const writes: { id: string; base64: string }[] = [];
  const closes: string[] = [];
  const connects: { id: string; host: string; port: number }[] = [];
  const emit = (event: string, e: { id: string; base64?: string; message?: string }) => {
    for (const l of listeners) if (!l.removed && l.event === event) l.cb(e);
  };
  const mod: LanAtvModule = {
    atvKey: async () => {
      calls.push('key');
      return { publicKeyBase64: toBase64(pkcs1(key.publicKey)), certBase64: cert ? toBase64(cert) : '' };
    },
    atvSign: async (b64) => {
      calls.push('sign');
      return toBase64(new Uint8Array(sign('sha256', fromBase64(b64), key.privateKey)));
    },
    atvSetCertificate: async (b64) => {
      calls.push('setCert');
      // Like LanAtv.swift: atvKey only reports a certificate the Keychain turned into an identity.
      const ok = opts.setCertOk ?? true;
      if (ok) cert = fromBase64(b64);
      return ok;
    },
    atvConnect: async (id, host, port) => {
      connects.push({ id, host, port });
      if (opts.connectError) throw opts.connectError;
      return { peerKeyBase64: toBase64(pkcs1(tvKey.publicKey)) };
    },
    atvWrite: (id, base64) => {
      writes.push({ id, base64 });
      return true;
    },
    atvClose: (id) => {
      closes.push(id);
      emit('onTlsClose', { id, message: '' });
    },
    addListener: ((event: string, cb: Listener) => {
      const l = { event, cb, removed: false };
      listeners.push(l);
      return { remove: () => void (l.removed = true) };
    }) as LanAtvModule['addListener'],
  };
  return { mod, key, tvKey, calls, writes, closes, connects, emit, cert: () => cert, live: () => listeners.filter((l) => !l.removed).length };
}

describe('without the native module (Expo Go, tests)', () => {
  it('loads as null and the app transport has no androidTv', () => {
    expect(loadAndroidTvTransport()).toBeNull();
    expect(hasAndroidTvTls()).toBe(false);
    const t = appTransport();
    expect('androidTv' in t).toBe(false);
    expect(isSupported('androidtv', t)).toBe(false);
  });
});

describe('ensureIdentity', () => {
  it('first run: builds a certificate for the Keychain key, signed natively, and stores it', async () => {
    const f = fakeModule();
    const id = await ensureIdentity(f.mod, () => new Date(Date.UTC(2026, 10, 1)));
    expect(f.calls).toEqual(['key', 'sign', 'setCert']);
    expect(id.keyPem).toBe(KEYCHAIN_KEY_REF);
    const x = new X509Certificate(id.certPem);
    expect(x.subject).toBe('CN=Couch');
    expect(x.verify(f.key.publicKey)).toBe(true);
    expect(sameRsaKey(id.publicKey, parseRsaPublicKey(pkcs1(f.key.publicKey)))).toBe(true);
    expect(sameRsaKey(certificatePublicKey(f.cert()!), id.publicKey)).toBe(true);
  });

  it('later runs reuse the stored certificate (no signing)', async () => {
    const f = fakeModule();
    const first = await ensureIdentity(f.mod);
    f.calls.length = 0;
    const again = await ensureIdentity(f.mod);
    expect(f.calls).toEqual(['key']);
    expect(again.certPem).toBe(first.certPem);
  });

  it('replaces a stored certificate that is for another key', async () => {
    const other = fakeModule();
    await ensureIdentity(other.mod);
    const f = fakeModule({ storedCert: other.cert()! });
    const id = await ensureIdentity(f.mod);
    expect(f.calls).toEqual(['key', 'sign', 'setCert']);
    expect(new X509Certificate(id.certPem).verify(f.key.publicKey)).toBe(true);
  });

  it('fails when the Keychain does not form the identity, and the loader retries next time', async () => {
    const f = fakeModule({ setCertOk: false });
    const atv = androidTvFromModule(f.mod);
    await expect(atv.identity()).rejects.toThrow();
    await expect(atv.identity()).rejects.toThrow();
    expect(f.calls.filter((c) => c === 'key')).toHaveLength(2);
  });

  it('the loader is cached after success', async () => {
    const f = fakeModule();
    const atv = androidTvFromModule(f.mod);
    const [a, b] = await Promise.all([atv.identity(), atv.identity()]);
    expect(a).toBe(b);
    expect(f.calls.filter((c) => c === 'key')).toHaveLength(1);
    expect(transportCaps({ androidTv: atv }).androidTv).toBe(true);
  });
});

describe('atvTlsFromModule', () => {
  const client = { certPem: 'x', keyPem: KEYCHAIN_KEY_REF };

  it('connects to an RFC 1918 host, exposes the TV key and moves bytes as base64', async () => {
    const f = fakeModule();
    const sock = await atvTlsFromModule(f.mod)('192.168.1.60', 6467, client);
    const id = f.connects[0]!.id;
    expect(id.startsWith('atv')).toBe(true);
    expect(f.connects[0]).toMatchObject({ host: '192.168.1.60', port: 6467 });
    expect(sameRsaKey(sock.peerPublicKey(), parseRsaPublicKey(pkcs1(f.tvKey.publicKey)))).toBe(true);
    const got: number[][] = [];
    f.emit('onTlsData', { id, base64: 'AQID' }); // buffered until onData
    sock.onData((d) => got.push([...d]));
    f.emit('onTlsData', { id: 'tls-other', base64: 'BAUG' });
    f.emit('onTlsData', { id, base64: 'BA==' });
    expect(got).toEqual([[1, 2, 3], [4]]);
    sock.write(Uint8Array.of(9, 8));
    expect(f.writes).toEqual([{ id, base64: 'CQg=' }]);
    let closed = 0;
    sock.onClose?.(() => (closed += 1));
    sock.close();
    expect(f.closes).toEqual([id]);
    expect(closed).toBe(1);
    expect(f.live()).toBe(0);
    expect(() => sock.write(Uint8Array.of(1))).toThrow();
  });

  it('refuses public hosts and hostnames without calling native code', async () => {
    const f = fakeModule();
    const tls = atvTlsFromModule(f.mod);
    for (const host of ['8.8.8.8', 'tv.local', '192.168.1.300', '::1']) {
      await expect(tls(host, 6466, client)).rejects.toThrow();
    }
    await expect(tls('192.168.1.60', 70000, client)).rejects.toThrow();
    expect(f.connects).toEqual([]);
  });

  it('maps ERR_ATV_TLS_AUTH to TlsAuthError (needs pairing) and other failures to Error', async () => {
    const auth = fakeModule({ connectError: Object.assign(new Error('bad certificate'), { code: ERR_ATV_TLS_AUTH }) });
    await expect(atvTlsFromModule(auth.mod)('10.0.0.5', 6466, client)).rejects.toBeInstanceOf(TlsAuthError);
    expect(auth.live()).toBe(0);
    const net = fakeModule({ connectError: Object.assign(new Error('refused'), { code: 'ERR_ATV_TLS_CONNECT' }) });
    const e = await atvTlsFromModule(net.mod)('10.0.0.5', 6466, client).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(TlsAuthError);
  });

  it('peerPublicKey throws when native could not read the TV certificate', async () => {
    const f = fakeModule();
    f.mod.atvConnect = async () => ({ peerKeyBase64: '' });
    const sock = await atvTlsFromModule(f.mod)('172.16.0.9', 6467, client);
    expect(() => sock.peerPublicKey()).toThrow();
  });
});
