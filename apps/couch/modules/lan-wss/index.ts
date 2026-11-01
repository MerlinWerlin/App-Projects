/**
 * lan-wss: a minimal WebSocket client for TVs on the home network. It behaves like a normal wss://
 * client, except that when `allowSelfSignedLan` is true AND the URL host is a literal RFC 1918 IPv4
 * address (10/8, 172.16/12, 192.168/16) it accepts the TV's self-signed certificate. Public hosts
 * and hostnames always get normal certificate validation.
 *
 * It also offers `fetch`: one HTTP(S) request under the same rule (https:// + allowSelfSignedLan +
 * literal RFC 1918 host), returning the status, all response headers and the body as text.
 *
 * And (T106) a raw TLS socket: `tlsConnect` / `tlsWrite` / `tlsClose`, for Google Cast (CASTV2 on
 * port 8009). It only connects to literal RFC 1918 IPv4 hosts and accepts their self-signed
 * certificate (Cast devices present one); every other host is refused.
 *
 * And the Google TV remote (Android TV Remote v2, iOS only): `atvKey` / `atvSign` /
 * `atvSetCertificate` keep this phone's RSA-2048 client identity in the Keychain (the certificate is
 * built in TS, src/core/drivers/androidtv/x509.ts), and `atvConnect` / `atvWrite` / `atvClose` open a
 * mutual-TLS socket presenting it, RFC 1918 hosts only, reusing the onTlsData / onTlsClose events.
 * src/native/androidTvTls.ts wraps them.
 *
 * UNVERIFIED: not compiled yet (needs a dev build). See README.md.
 *
 * Events (all carry the caller-chosen socket id):
 *   onMessage  { id, data }   text frame from the server
 *   onClose    { id, code, reason }
 *   onError    { id, message }   followed by onClose
 *   onTlsData  { id, base64 }   bytes received on a TLS socket
 *   onTlsClose { id, message }  TLS socket closed (by either side; message empty for a clean close)
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface LanWssMessageEvent {
  id: string;
  data: string;
}
export interface LanWssCloseEvent {
  id: string;
  code: number;
  reason: string;
}
export interface LanWssErrorEvent {
  id: string;
  message: string;
}

/** Result of LanWssNativeModule.fetch. */
export interface LanFetchResult {
  status: number;
  /** JSON object of response headers: lower-cased names, repeated headers joined with ", ". */
  headersJson: string;
  /** Response body decoded as UTF-8. */
  body: string;
}

export interface LanTlsDataEvent {
  id: string;
  /** Received bytes, base64-encoded (standard alphabet, padded). */
  base64: string;
}
export interface LanTlsCloseEvent {
  id: string;
  message: string;
}

export interface LanWssSubscription {
  remove(): void;
}

export interface LanWssNativeModule {
  /**
   * Opens `url` under the caller-chosen `id` (choose it before connecting so listeners are in place
   * before the first frame). Resolves once the handshake completes; rejects on failure.
   */
  connect(id: string, url: string, allowSelfSignedLan: boolean): Promise<void>;
  /** Sends a text frame; false when the socket is unknown or already closed. */
  send(id: string, data: string): boolean;
  close(id: string): void;
  /**
   * One HTTP(S) request. `headersJson` is a JSON object of request headers; `body` is null for none.
   * Resolves for every HTTP status (including 401, with its WWW-Authenticate header); rejects on
   * network/TLS failure (code ERR_LAN_FETCH) or timeout (ERR_LAN_FETCH_TIMEOUT). Redirects are not
   * followed on relaxed-trust requests. No cookies, cache or stored credentials.
   */
  fetch(
    url: string,
    method: string,
    headersJson: string,
    body: string | null,
    timeoutMs: number,
    allowSelfSignedLan: boolean,
  ): Promise<LanFetchResult>;
  /**
   * Opens a raw TCP + TLS socket under the caller-chosen `id` (T106). `host` must be a literal
   * RFC 1918 IPv4 address, otherwise it rejects with ERR_LAN_TLS_HOST without connecting; the
   * device's self-signed certificate is accepted only for such hosts. Resolves after the TLS
   * handshake; rejects with ERR_LAN_TLS_CONNECT (refused, TLS failure) or ERR_LAN_TLS_TIMEOUT.
   * Optional: builds made before T106 lack it (src/native/lanTls.ts checks).
   */
  tlsConnect?(id: string, host: string, port: number, timeoutMs: number): Promise<void>;
  /** Queues base64-encoded bytes for sending; false when the socket is unknown or closed. */
  tlsWrite?(id: string, base64: string): boolean;
  /** Closes the socket; onTlsClose follows. */
  tlsClose?(id: string): void;
  /**
   * Google TV remote identity (iOS, LanAtv.swift). Returns this phone's Keychain RSA public key as
   * PKCS#1 DER (base64), creating the key pair on first call, and the stored client certificate
   * (DER, base64), or '' when none is stored or the Keychain does not pair it with the key as an
   * identity. Optional: absent on Android and older builds.
   */
  atvKey?(): Promise<{ publicKeyBase64: string; certBase64: string }>;
  /** Signs bytes with the Keychain private key (RSA PKCS#1 v1.5, SHA-256); base64 in and out. */
  atvSign?(dataBase64: string): Promise<string>;
  /** Stores the client certificate (DER, base64) for the key; resolves true once the identity is usable. */
  atvSetCertificate?(certBase64: string): Promise<boolean>;
  /**
   * Mutual TLS socket presenting the Keychain identity, RFC 1918 IPv4 hosts only (ERR_ATV_TLS_HOST
   * otherwise). Resolves after the handshake with the TV certificate's RSA public key (PKCS#1 DER,
   * base64; '' when unreadable). Rejects with ERR_ATV_TLS_AUTH when the TV refused the client
   * certificate, ERR_ATV_TLS_IDENTITY without an identity, ERR_ATV_TLS_CONNECT / ERR_ATV_TLS_TIMEOUT.
   * Data and close arrive as onTlsData / onTlsClose with this id.
   */
  atvConnect?(id: string, host: string, port: number, timeoutMs: number): Promise<{ peerKeyBase64: string }>;
  atvWrite?(id: string, base64: string): boolean;
  atvClose?(id: string): void;
  addListener(event: 'onMessage', cb: (e: LanWssMessageEvent) => void): LanWssSubscription;
  addListener(event: 'onClose', cb: (e: LanWssCloseEvent) => void): LanWssSubscription;
  addListener(event: 'onError', cb: (e: LanWssErrorEvent) => void): LanWssSubscription;
  addListener(event: 'onTlsData', cb: (e: LanTlsDataEvent) => void): LanWssSubscription;
  addListener(event: 'onTlsClose', cb: (e: LanTlsCloseEvent) => void): LanWssSubscription;
}

/** The native module, or null in Expo Go / web / tests where it is not compiled in. */
const LanWss = requireOptionalNativeModule<LanWssNativeModule>('LanWss');

export default LanWss;

export function isLanWssAvailable(): boolean {
  return LanWss !== null;
}
