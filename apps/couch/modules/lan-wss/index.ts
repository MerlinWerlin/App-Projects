/**
 * lan-wss: a minimal WebSocket client for TVs on the home network. It behaves like a normal wss://
 * client, except that when `allowSelfSignedLan` is true AND the URL host is a literal RFC 1918 IPv4
 * address (10/8, 172.16/12, 192.168/16) it accepts the TV's self-signed certificate. Public hosts
 * and hostnames always get normal certificate validation.
 *
 * It also offers `fetch`: one HTTP(S) request under the same rule (https:// + allowSelfSignedLan +
 * literal RFC 1918 host), returning the status, all response headers and the body as text.
 *
 * UNVERIFIED: not compiled yet (needs a dev build). See README.md.
 *
 * Events (all carry the caller-chosen socket id):
 *   onMessage { id, data }   text frame from the server
 *   onClose   { id, code, reason }
 *   onError   { id, message }   followed by onClose
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
  addListener(event: 'onMessage', cb: (e: LanWssMessageEvent) => void): LanWssSubscription;
  addListener(event: 'onClose', cb: (e: LanWssCloseEvent) => void): LanWssSubscription;
  addListener(event: 'onError', cb: (e: LanWssErrorEvent) => void): LanWssSubscription;
}

/** The native module, or null in Expo Go / web / tests where it is not compiled in. */
const LanWss = requireOptionalNativeModule<LanWssNativeModule>('LanWss');

export default LanWss;

export function isLanWssAvailable(): boolean {
  return LanWss !== null;
}
