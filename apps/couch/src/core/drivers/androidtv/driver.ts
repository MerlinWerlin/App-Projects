/**
 * Google TV / Android TV driver (Android TV Remote protocol v2).
 *
 * - Pairing on :6467 over mutual TLS: pairing_request -> options -> configuration; the TV shows a
 *   6-hex code; the client answers with secret = SHA-256 over both certificates' RSA numbers and
 *   the code (see pairing.ts). After that the TV trusts the client certificate.
 * - Remote on :6466 over mutual TLS with the same client certificate: the TV sends
 *   remote_configure and remote_set_active, the client answers each, the TV reports its power state
 *   in remote_start and pings periodically (the client must echo val1 or the TV drops it).
 *
 * The TLS socket (with a client certificate and access to the TV's certificate) and the client
 * key/certificate generation are native and injected through TlsClientFactory / ClientIdentity
 * (iOS: modules/lan-wss LanAtv.swift + src/native/androidTvTls.ts; the key stays in the Keychain).
 *
 * Written from public protocol knowledge (androidtvremote2, Apache-2.0; kud/androidtv-remote, MIT;
 * logic described, nothing copied). Tested only against reconstructed fixtures in
 * src/core/drivers/__fixtures__/androidtv/. NOT verified on hardware: everything is UNVERIFIED.
 */
import { Emitter, type DriverEvent, type TcpLike, type TvDriver } from '../../driver';
import type { Key } from '../../keys';
import { DriverError, type Capability, type PairState } from '../../types';
import { t } from '../../../i18n/core';
import { driverError, asDriverError } from '../errors';
import { ANDROIDTV_KEYS, KEYCODE } from './keys';
import { pairingSecret, type RsaPublicKey } from './pairing';
import { COUCH_APP_PACKAGE } from '../../appIdentity';
import {
  FrameReader,
  KeyDirection,
  PairingStatus,
  REMOTE_FEATURES,
  decodePairingMessage,
  decodeRemoteMessage,
  encodePairingMessage,
  encodeRemoteMessage,
  frame,
  pairingConfigurationMessage,
  pairingOptionsMessage,
  pairingRequestMessage,
  pairingSecretMessage,
  type PairingMessage,
  type RemoteDeviceInfo,
  type RemoteMessage,
} from './proto';

export const ANDROIDTV_PAIRING_PORT = 6467;
export const ANDROIDTV_REMOTE_PORT = 6466;
/** mDNS service type advertised by TVs that speak this protocol. */
export const ANDROIDTV_MDNS_SERVICE = '_androidtvremote2._tcp';
/** Shown on the TV during pairing and in its list of connected remotes. No brand names. */
export const ANDROIDTV_DEFAULT_CLIENT_NAME = 'Couch Remote';
/** package_name in the device_info of remote_configure: the app's real bundle id (app.json). */
export const ANDROIDTV_PACKAGE_NAME = COUCH_APP_PACKAGE;
/** How pairing looks to the add-TV flow. */
export const ANDROIDTV_PAIR_STATE: PairState = { kind: 'code', length: 6 };

/**
 * TLS socket supplied by the native layer. It is a TcpLike plus the TV's certificate public key.
 */
export interface TlsSocketLike extends TcpLike {
  /**
   * RSA public key of the certificate the TV presented in the handshake (raw big-endian modulus
   * and exponent bytes; leading zero bytes are fine). Must be available as soon as the factory
   * resolves. Used only for pairing.
   */
  peerPublicKey(): RsaPublicKey;
  /** Socket closed by either side or by an error. Optional, but without it drops go unnoticed. */
  onClose?(cb: (err?: Error) => void): void;
}

/**
 * Opens a TLS connection presenting the given client certificate. The TV uses a self-signed
 * certificate, so the native side must NOT validate the server chain (trust is established by
 * the pairing hash instead).
 *
 * Contract: resolve once the TLS handshake has completed. Reject with TlsAuthError when the TV
 * refuses the client certificate during the handshake (not paired, or pairing revoked), and with
 * any other Error for network failures.
 */
export type TlsClientFactory = (host: string, port: number, client: { certPem: string; keyPem: string }) => Promise<TlsSocketLike>;

/** Rejection reason for a TlsClientFactory when the TV refused our certificate. */
export class TlsAuthError extends Error {
  constructor(message = 'TLS client certificate rejected') {
    super(message);
    this.name = 'TlsAuthError';
  }
}

/**
 * This phone's long-lived identity: a self-signed RSA (2048-bit) certificate generated once by the
 * native layer and stored with the Tv record. The same identity must be used for pairing and every
 * later connect. publicKey must be the key inside certPem.
 */
export interface ClientIdentity {
  certPem: string;
  keyPem: string;
  publicKey: RsaPublicKey;
}

/**
 * Where the client identity comes from: the identity itself, or a loader (the native Keychain
 * identity is created on first use, asynchronously). A loader is called at most once per success.
 */
export type ClientIdentitySource = ClientIdentity | (() => Promise<ClientIdentity>);

export interface AndroidTvDriverOptions {
  host: string;
  tls: TlsClientFactory;
  identity: ClientIdentitySource;
  /** Client name shown on the TV while pairing. */
  clientName?: string;
  /** Overrides for the device_info sent in remote_configure. */
  deviceInfo?: Partial<RemoteDeviceInfo>;
  pairingPort?: number;
  remotePort?: number;
  now?: () => number;
  /** Per-step timeout for pairing replies and the remote handshake. */
  timeoutMs?: number;
  /**
   * After remote_set_active, how long to wait for remote_start before assuming the TV is on.
   * UNVERIFIED whether every TV sends remote_start on connect.
   */
  startGraceMs?: number;
}

export type AndroidTvPairingState = 'idle' | 'starting' | 'awaiting_code' | 'verifying' | 'paired' | 'failed';

type Pending = { resolve: (m: PairingMessage) => void; reject: (e: DriverError) => void; timer: ReturnType<typeof setTimeout> };

function closeQuietly(s: TcpLike | null | undefined): void {
  try {
    s?.close();
  } catch {
    // ignore
  }
}

function pairingStatusError(status: number): DriverError {
  if (status === PairingStatus.BAD_SECRET) {
    return driverError('pair_required', 'core.driver.androidtv.codeRejected');
  }
  if (status === PairingStatus.BAD_CONFIGURATION) {
    return driverError('unsupported', 'core.driver.androidtv.methodUnsupported');
  }
  return driverError('pair_required', 'core.driver.androidtv.pairingEnded', { status: String(status) });
}

export class AndroidTvDriver implements TvDriver {
  readonly platform = 'androidtv' as const;
  /**
   * 'voice' is deliberately not advertised: the protocol has native voice (remote_voice_begin /
   * payload / end) but it needs audio streaming. TODO: beginVoice() could use remote_voice_begin.
   * 'text' is not advertised: text needs remote_ime_batch_edit with IME counters (TODO).
   */
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>(['keys', 'launch', 'numbers', 'colorKeys', 'powerOn']);

  /** device_info the TV sent in its remote_configure. */
  tvInfo: RemoteDeviceInfo | null = null;
  /** Name the TV gave in pairing_request_ack. */
  serverName: string | undefined;
  /** Power state from remote_start; undefined until the TV reports it. */
  isOn: boolean | undefined;
  pairingState: AndroidTvPairingState = 'idle';

  private readonly opts: AndroidTvDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly startGraceMs: number;

  // pairing
  private pairSock: TlsSocketLike | null = null;
  private pairInbox: PairingMessage[] = [];
  private pairWaiter: Pending | null = null;
  private pairClosed = false;

  // remote
  private sock: TlsSocketLike | null = null;
  private connected = false;

  // identity (resolved lazily when opts.identity is a loader)
  private identity: ClientIdentity | null = null;

  constructor(opts: AndroidTvDriverOptions) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 10000;
    this.startGraceMs = opts.startGraceMs ?? 1500;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  /** The client identity, loading it on first use. Throws a translated DriverError when it cannot be made. */
  private async clientIdentity(): Promise<ClientIdentity> {
    if (this.identity) return this.identity;
    const src = this.opts.identity;
    try {
      this.identity = typeof src === 'function' ? await src() : src;
    } catch {
      throw driverError('network', 'core.driver.androidtv.identity');
    }
    return this.identity;
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  // ------------------------------------------------------------------ pairing

  /**
   * Opens the pairing port and runs request -> options -> configuration. When it resolves the TV
   * is showing a 6-character code; pass it to submitCode().
   */
  async startPairing(): Promise<{ serverName?: string }> {
    this.cancelPairing();
    this.pairingState = 'starting';
    this.pairInbox = [];
    this.pairClosed = false;
    try {
      const identity = await this.clientIdentity();
      let sock: TlsSocketLike;
      try {
        sock = await this.opts.tls(this.opts.host, this.opts.pairingPort ?? ANDROIDTV_PAIRING_PORT, {
          certPem: identity.certPem,
          keyPem: identity.keyPem,
        });
      } catch {
        throw driverError('network', 'core.driver.androidtv.pairUnreachable', { port: '6467' });
      }
      this.pairSock = sock;
      const reader = new FrameReader();
      sock.onData((chunk) => {
        if (this.pairSock !== sock) return;
        let frames: Uint8Array[];
        try {
          frames = reader.push(chunk);
        } catch {
          this.pairAbort(driverError('network', 'core.driver.androidtv.unreadable'));
          return;
        }
        for (const f of frames) {
          let m: PairingMessage;
          try {
            m = decodePairingMessage(f);
          } catch {
            this.pairAbort(driverError('network', 'core.driver.androidtv.unreadable'));
            return;
          }
          this.pairDeliver(m);
        }
      });
      sock.onClose?.(() => {
        if (this.pairSock !== sock) return;
        this.pairClosed = true;
        this.pairAbort(driverError('network', 'core.driver.androidtv.pairingClosed'));
      });

      const ack = await this.pairExchange(pairingRequestMessage(this.opts.clientName ?? ANDROIDTV_DEFAULT_CLIENT_NAME), 'pairingRequestAck');
      this.serverName = ack.pairingRequestAck?.serverName;
      await this.pairExchange(pairingOptionsMessage(), 'options');
      await this.pairExchange(pairingConfigurationMessage(), 'configurationAck');
      this.pairingState = 'awaiting_code';
      return this.serverName === undefined ? {} : { serverName: this.serverName };
    } catch (e) {
      this.pairingState = 'failed';
      this.closePairing();
      return this.fail(e);
    }
  }

  /**
   * Checks the code against the TV's certificate and sends the secret. A malformed or mistyped
   * code throws DriverError('pair_required') and leaves pairing open so the user can retype it.
   */
  async submitCode(code: string): Promise<void> {
    try {
      const sock = this.pairSock;
      if (this.pairingState !== 'awaiting_code' || !sock) {
        throw driverError('pair_required', 'core.driver.androidtv.notPairing');
      }
      let server: RsaPublicKey;
      try {
        server = sock.peerPublicKey();
      } catch {
        throw driverError('network', 'core.driver.androidtv.certificate');
      }
      const secret = pairingSecret((await this.clientIdentity()).publicKey, server, code); // throws on mismatch
      this.pairingState = 'verifying';
      try {
        await this.pairExchange(pairingSecretMessage(secret), 'secretAck');
      } catch (e) {
        this.pairingState = 'failed';
        this.closePairing();
        throw e;
      }
      this.pairingState = 'paired';
      this.closePairing();
    } catch (e) {
      this.fail(e);
    }
  }

  /** Abandons a pairing in progress (closes :6467). */
  cancelPairing(): void {
    if (this.pairingState === 'starting' || this.pairingState === 'awaiting_code' || this.pairingState === 'verifying') {
      this.pairingState = 'idle';
    }
    this.pairAbort(driverError('pair_required', 'core.driver.androidtv.cancelled'));
    this.closePairing();
  }

  private closePairing(): void {
    const s = this.pairSock;
    this.pairSock = null;
    closeQuietly(s);
  }

  private pairDeliver(m: PairingMessage): void {
    const w = this.pairWaiter;
    if (w) {
      this.pairWaiter = null;
      clearTimeout(w.timer);
      w.resolve(m);
    } else {
      this.pairInbox.push(m);
    }
  }

  private pairAbort(e: DriverError): void {
    const w = this.pairWaiter;
    this.pairWaiter = null;
    if (w) {
      clearTimeout(w.timer);
      w.reject(e);
    }
  }

  private nextPairingMessage(): Promise<PairingMessage> {
    const queued = this.pairInbox.shift();
    if (queued) return Promise.resolve(queued);
    if (this.pairClosed || !this.pairSock) {
      return Promise.reject(driverError('network', 'core.driver.androidtv.pairingClosed'));
    }
    return new Promise((resolve, reject) => {
      this.pairWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.pairWaiter = null;
          reject(driverError('timeout', 'core.driver.common.timeout'));
        }, this.timeoutMs),
      };
    });
  }

  /** Sends one pairing message and waits for the reply carrying `expect`. */
  private async pairExchange(msg: PairingMessage, expect: keyof PairingMessage): Promise<PairingMessage> {
    const sock = this.pairSock;
    if (!sock) throw driverError('network', 'core.driver.androidtv.pairingClosed');
    sock.write(frame(encodePairingMessage(msg)));
    const reply = await this.nextPairingMessage();
    if (reply.status !== PairingStatus.OK) throw pairingStatusError(reply.status);
    if (reply[expect] === undefined) {
      throw driverError('network', 'core.driver.androidtv.unexpectedReply', { detail: String(expect) });
    }
    return reply;
  }

  // ------------------------------------------------------------------ remote session

  get deviceInfo(): RemoteDeviceInfo {
    return {
      model: this.opts.clientName ?? ANDROIDTV_DEFAULT_CLIENT_NAME,
      vendor: 'Couch',
      unknown1: 1,
      unknown2: '1',
      packageName: ANDROIDTV_PACKAGE_NAME,
      appVersion: '0.1.0',
      ...this.opts.deviceInfo,
    };
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      await this.openRemote();
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.events.emit({ type: 'state', state: this.isOn === false ? 'off' : 'connected' });
  }

  private async openRemote(): Promise<void> {
    const old = this.sock;
    this.sock = null;
    this.connected = false;
    closeQuietly(old);

    const identity = await this.clientIdentity();
    let sock: TlsSocketLike;
    try {
      sock = await this.opts.tls(this.opts.host, this.opts.remotePort ?? ANDROIDTV_REMOTE_PORT, {
        certPem: identity.certPem,
        keyPem: identity.keyPem,
      });
    } catch (e) {
      if (e instanceof TlsAuthError || (e instanceof Error && e.name === 'TlsAuthError')) {
        throw driverError('pair_required', 'core.driver.androidtv.needsPairing');
      }
      throw driverError('network', 'core.driver.androidtv.unreachable', { port: '6466' });
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let configured = false;
      let grace: ReturnType<typeof setTimeout> | undefined;
      const settle = (err?: DriverError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (grace) clearTimeout(grace);
        if (err) {
          closeQuietly(sock);
          reject(err);
        } else {
          this.sock = sock;
          this.connected = true;
          resolve();
        }
      };
      const timer = setTimeout(() => settle(driverError('timeout', 'core.driver.androidtv.connectTimeout')), this.timeoutMs);
      const write = (m: RemoteMessage): void => sock.write(frame(encodeRemoteMessage(m)));
      const reader = new FrameReader();

      sock.onData((chunk) => {
        if (settled && this.sock !== sock) return;
        let msgs: RemoteMessage[];
        try {
          msgs = reader.push(chunk).map(decodeRemoteMessage);
        } catch {
          this.events.emit({ type: 'error', message: t('core.driver.androidtv.unreadable') });
          return;
        }
        for (const m of msgs) {
          if (m.remoteConfigure) {
            configured = true;
            this.tvInfo = m.remoteConfigure.deviceInfo ?? {};
            write({ remoteConfigure: { code1: REMOTE_FEATURES, deviceInfo: this.deviceInfo } });
          }
          if (m.remoteSetActive) {
            write({ remoteSetActive: { active: REMOTE_FEATURES } });
            if (!settled && !grace) grace = setTimeout(() => settle(), this.startGraceMs);
          }
          if (m.remotePingRequest) write({ remotePingResponse: { val1: m.remotePingRequest.val1 } });
          if (m.remoteStart) {
            const was = this.isOn;
            this.isOn = m.remoteStart.started;
            if (!settled) settle();
            else if (was !== this.isOn) this.events.emit({ type: 'state', state: this.isOn ? 'connected' : 'off' });
          }
          if (m.remoteError) {
            this.events.emit({ type: 'error', message: t('core.driver.androidtv.commandError') });
          }
        }
      });
      sock.onClose?.(() => {
        if (!settled) {
          settle(
            configured
              ? driverError('network', 'core.driver.androidtv.remoteClosed')
              : driverError('pair_required', 'core.driver.androidtv.dropped'),
          );
          return;
        }
        if (this.sock !== sock) return;
        this.sock = null;
        const was = this.connected;
        this.connected = false;
        if (was) this.events.emit({ type: 'state', state: 'disconnected' });
      });
    });
  }

  async disconnect(): Promise<void> {
    const s = this.sock;
    this.sock = null;
    this.connected = false;
    closeQuietly(s);
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  private ensureConnected(): TlsSocketLike {
    if (!this.connected || !this.sock) throw driverError('not_connected', 'core.driver.common.notConnected');
    return this.sock;
  }

  private send(m: RemoteMessage, what: string): void {
    const sock = this.ensureConnected();
    const start = this.now();
    sock.write(frame(encodeRemoteMessage(m)));
    this.events.emit({ type: 'sent', what, ms: Math.max(0, Math.round(this.now() - start)) });
  }

  codeFor(key: Key): number {
    const code = ANDROIDTV_KEYS[key];
    if (code === undefined) throw driverError('unsupported', 'core.driver.common.keyUnavailable', { key });
    return code;
  }

  private inject(key: Key, direction: number, what: string): void {
    const code = this.codeFor(key);
    this.ensureConnected();
    if (this.isOn === false && key !== 'POWER') throw driverError('tv_off', 'core.driver.common.standby');
    this.send({ remoteKeyInject: { keyCode: code, direction } }, what);
  }

  async sendKey(key: Key): Promise<void> {
    try {
      if (key === 'POWER' && this.isOn === false) {
        await this.powerOn();
        return;
      }
      this.inject(key, KeyDirection.SHORT, key);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Press and hold (d-pad repeat, volume ramp); pair with keyUp. */
  async keyDown(key: Key): Promise<void> {
    try {
      this.inject(key, KeyDirection.START_LONG, `${key} down`);
    } catch (e) {
      this.fail(e);
    }
  }

  async keyUp(key: Key): Promise<void> {
    try {
      this.inject(key, KeyDirection.END_LONG, `${key} up`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Not supported yet (needs remote_ime_batch_edit). The app falls back to key-by-key or nothing. */
  async sendText(_text: string): Promise<void> {
    this.fail(driverError('unsupported', 'core.driver.androidtv.noTyping'));
  }

  /**
   * Launches an app by app link (remote_app_link_launch_request), e.g. a URL the TV resolves to an
   * installed app like "https://www.youtube.com" or a "market://launch?id=<package>" link.
   * UNVERIFIED which link forms each TV resolves.
   */
  async launchApp(appLink: string): Promise<void> {
    try {
      const link = appLink.trim();
      if (link === '') throw driverError('unsupported', 'core.driver.androidtv.noLink');
      this.ensureConnected();
      this.send({ remoteAppLinkLaunchRequest: { appLink: link } }, `LAUNCH ${link}`);
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * Turns the TV on with KEYCODE_POWER when it reports standby (remote_start started=false). The
   * remote service stays reachable in network standby on most models (UNVERIFIED). Connects first
   * when needed; does nothing unless the TV reports it is off (POWER is a toggle and would turn
   * an on TV off).
   */
  async powerOn(): Promise<void> {
    try {
      if (!this.connected || !this.sock) await this.openRemote();
      if (this.isOn !== false) return;
      this.send({ remoteKeyInject: { keyCode: KEYCODE.POWER, direction: KeyDirection.SHORT } }, 'POWER_ON');
    } catch (e) {
      this.fail(e);
    }
  }
}
