/**
 * Google TV remote transport (Android TV Remote v2): mutual-TLS sockets and the phone's client
 * identity, over the lan-wss module's LanAtv native code (modules/lan-wss/ios/LanAtv.swift, iOS).
 *
 * Identity: native keeps an RSA-2048 key pair in the Keychain (generated once; the private key
 * never leaves it). The self-signed certificate for it is built here in TS
 * (src/core/drivers/androidtv/x509.ts), signed by native (atvSign), and stored back next to the key
 * (atvSetCertificate) so the Keychain can form the SecIdentity the TLS socket presents. The driver
 * gets certPem (the real certificate) and keyPem = KEYCHAIN_KEY_REF (a marker: the key is in the
 * Keychain), plus the RSA numbers for the pairing hash.
 *
 * Sockets: atvConnect connects ONLY to literal RFC 1918 IPv4 hosts and accepts the TV's self-signed
 * certificate only for them (checked here before native is called, and again in Swift). It
 * resolves with the TV certificate's public key (PKCS#1 DER, base64) for the pairing hash. Bytes
 * cross the bridge as base64 on the shared onTlsData / onTlsClose events (ids prefixed "atv").
 *
 * The module only exists in a native build that includes LanAtv, so it is loaded lazily inside
 * try/catch and loadAndroidTvTransport() returns null in Expo Go, web, tests, builds whose lan-wss
 * predates it, and when ANDROIDTV_NATIVE_ON is false. Not compiled or tested on a device yet.
 */
import { fromBase64, toBase64 } from '../core/crypto/bytes';
import type { AndroidTvTransport } from '../core/driver';
import { TlsAuthError, type ClientIdentity, type TlsClientFactory, type TlsSocketLike } from '../core/drivers/androidtv/driver';
import type { RsaPublicKey } from '../core/drivers/androidtv/pairing';
import { ANDROIDTV_NATIVE_ON } from '../core/drivers/androidtv/switch';
import {
  assembleCertificate,
  buildTbsCertificate,
  certificatePublicKey,
  clientCertValidity,
  parseRsaPublicKey,
  sameRsaKey,
  toPem,
} from '../core/drivers/androidtv/x509';
import { isRfc1918Host } from '../core/lanHost';

interface Subscription {
  remove(): void;
}

/** Minimal slice of modules/lan-wss/index.ts that we use (kept local so a missing module cannot break types). */
export interface LanAtvModule {
  /** Creates the Keychain key pair on first call. certBase64 is '' until a certificate is stored and usable as an identity. */
  atvKey(): Promise<{ publicKeyBase64: string; certBase64: string }>;
  /** RSA PKCS#1 v1.5 SHA-256 signature of the bytes with the Keychain private key. */
  atvSign(dataBase64: string): Promise<string>;
  /** Stores the client certificate (DER) next to the key; true once the Keychain has the identity. */
  atvSetCertificate(certBase64: string): Promise<boolean>;
  /** Mutual TLS to an RFC 1918 host presenting the Keychain identity; resolves after the handshake. */
  atvConnect(id: string, host: string, port: number, timeoutMs: number): Promise<{ peerKeyBase64: string }>;
  atvWrite(id: string, base64: string): boolean;
  atvClose(id: string): void;
  addListener(event: 'onTlsData', cb: (e: { id: string; base64: string }) => void): Subscription;
  addListener(event: 'onTlsClose', cb: (e: { id: string; message: string }) => void): Subscription;
}

declare const require: (id: string) => unknown;

export const ATV_CONNECT_TIMEOUT_MS = 8000;
/** keyPem handed to the driver: the private key lives in the iOS Keychain and is never exported. */
export const KEYCHAIN_KEY_REF = 'keychain:couch.atv.client';
/** Rejection code LanAtv.swift uses when the TV refused the client certificate in the handshake. */
export const ERR_ATV_TLS_AUTH = 'ERR_ATV_TLS_AUTH';

const FUNCTIONS = ['atvKey', 'atvSign', 'atvSetCertificate', 'atvConnect', 'atvWrite', 'atvClose', 'addListener'] as const;

function loadModule(): LanAtvModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/lan-wss') as { default?: Partial<LanAtvModule> | null } | null;
    const m = mod?.default ?? null;
    if (!m) return null;
    for (const f of FUNCTIONS) if (typeof m[f] !== 'function') return null;
    return m as LanAtvModule;
  } catch {
    return null;
  }
}

function randomSerial(): Uint8Array {
  const out = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    try {
      c.getRandomValues(out);
      return out;
    } catch {
      // fall through
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/**
 * Loads (or makes, once) the client identity: the Keychain key, and a certificate for it built in
 * TS and signed natively. A stored certificate for a different key is replaced.
 */
export async function ensureIdentity(mod: LanAtvModule, now: () => Date = () => new Date()): Promise<ClientIdentity> {
  const k = await mod.atvKey();
  const pkcs1 = fromBase64(k.publicKeyBase64);
  const publicKey: RsaPublicKey = parseRsaPublicKey(pkcs1);
  if (k.certBase64) {
    const cert = fromBase64(k.certBase64);
    let matches = false;
    try {
      matches = sameRsaKey(certificatePublicKey(cert), publicKey);
    } catch {
      matches = false;
    }
    if (matches) return { certPem: toPem(cert), keyPem: KEYCHAIN_KEY_REF, publicKey };
  }
  const tbs = buildTbsCertificate({ publicKeyPkcs1: pkcs1, serial: randomSerial(), ...clientCertValidity(now()) });
  const signature = fromBase64(await mod.atvSign(toBase64(tbs)));
  if (signature.length < 128) throw new Error('Signature missing');
  const cert = assembleCertificate(tbs, signature);
  const ok = await mod.atvSetCertificate(toBase64(cert));
  if (!ok) throw new Error('Keychain identity unavailable');
  return { certPem: toPem(cert), keyPem: KEYCHAIN_KEY_REF, publicKey };
}

let seq = 0;

/** TlsClientFactory over a LanAtv module (real or fake). The client cert args are ignored: native presents the Keychain identity. */
export function atvTlsFromModule(mod: LanAtvModule, connectTimeoutMs = ATV_CONNECT_TIMEOUT_MS): TlsClientFactory {
  return async (host, port) => {
    if (!isRfc1918Host(host)) throw new Error('Only local network addresses are allowed.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
    seq += 1;
    const id = `atv${Date.now().toString(36)}-${seq}`;

    const buffered: Uint8Array[] = [];
    const dataCbs: ((d: Uint8Array) => void)[] = [];
    const closeCbs: ((err?: Error) => void)[] = [];
    let closed = false;
    let closeError: Error | undefined;

    const dataSub = mod.addListener('onTlsData', (e) => {
      if (e.id !== id || closed) return;
      const bytes = fromBase64(e.base64);
      if (dataCbs.length === 0) buffered.push(bytes);
      else for (const cb of dataCbs) cb(bytes);
    });
    const closeSub = mod.addListener('onTlsClose', (e) => {
      if (e.id !== id || closed) return;
      closed = true;
      closeError = e.message ? new Error(e.message) : undefined;
      dataSub.remove();
      closeSub.remove();
      for (const cb of closeCbs.splice(0)) cb(closeError);
    });

    let peerKeyBase64 = '';
    try {
      const r = await mod.atvConnect(id, host, port, connectTimeoutMs);
      peerKeyBase64 = typeof r?.peerKeyBase64 === 'string' ? r.peerKeyBase64 : '';
    } catch (e) {
      closed = true;
      dataSub.remove();
      closeSub.remove();
      const code = (e as { code?: unknown } | null)?.code;
      if (code === ERR_ATV_TLS_AUTH) throw new TlsAuthError();
      throw e instanceof Error ? e : new Error(String(e));
    }

    let peer: RsaPublicKey | null = null;
    const sock: TlsSocketLike = {
      write: (data) => {
        if (closed || !mod.atvWrite(id, toBase64(data))) throw new Error('Socket is closed');
      },
      close: () => {
        try {
          mod.atvClose(id);
        } catch {
          // already closed
        }
      },
      onData: (cb) => {
        dataCbs.push(cb);
        if (dataCbs.length === 1 && buffered.length > 0) {
          const pending = buffered.splice(0);
          for (const d of pending) cb(d);
        }
      },
      onClose: (cb) => {
        if (closed) cb(closeError);
        else closeCbs.push(cb);
      },
      peerPublicKey: () => {
        if (!peer) {
          if (!peerKeyBase64) throw new Error('No peer certificate');
          peer = parseRsaPublicKey(fromBase64(peerKeyBase64));
        }
        return peer;
      },
    };
    return sock;
  };
}

/** The Android TV transport for a module: TLS factory + a cached identity loader (retried after a failure). */
export function androidTvFromModule(mod: LanAtvModule): AndroidTvTransport {
  let pending: Promise<ClientIdentity> | null = null;
  return {
    tls: atvTlsFromModule(mod),
    identity: () => {
      if (!pending) {
        pending = ensureIdentity(mod).catch((e: unknown) => {
          pending = null;
          throw e;
        });
      }
      return pending;
    },
  };
}

/** The Google TV remote transport, or null when the native code is absent or switched off. */
export function loadAndroidTvTransport(): AndroidTvTransport | null {
  if (!ANDROIDTV_NATIVE_ON) return null;
  const mod = loadModule();
  return mod ? androidTvFromModule(mod) : null;
}

export function hasAndroidTvTls(): boolean {
  return ANDROIDTV_NATIVE_ON && loadModule() !== null;
}
