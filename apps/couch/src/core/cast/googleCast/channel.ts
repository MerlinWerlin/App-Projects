/**
 * Google Cast (CASTV2) channel (T106): one TLS socket to a Cast device on port 8009.
 *
 * - Opens the socket through the injected TcpFactory with `{ tls: true }` (the device presents a
 *   self-signed certificate; the native side accepts it only for RFC 1918 hosts).
 * - Sends CONNECT on urn:x-cast:com.google.cast.tp.connection (sender-0 -> receiver-0).
 * - Heartbeat on urn:x-cast:com.google.cast.tp.heartbeat: a PING every 5 s, answers the device's
 *   PING with PONG, and gives up when nothing has arrived for 15 s.
 * - JSON payloads, requestId-matched request/response and generic waits, both with timeouts on the
 *   injected CastTimer.
 *
 * Reconstructed from public protocol descriptions. Tested against a scripted fake socket only;
 * never against a real TV.
 */
import type { TcpFactory, TcpLike } from '../../driver';
import { isRfc1918Host } from '../../lanHost';
import type { CastTimer } from '../session';
import { CastFrameDecoder, frameCastMessage } from './framing';

export const NS_CONNECTION = 'urn:x-cast:com.google.cast.tp.connection';
export const NS_HEARTBEAT = 'urn:x-cast:com.google.cast.tp.heartbeat';
export const NS_RECEIVER = 'urn:x-cast:com.google.cast.receiver';
export const NS_MEDIA = 'urn:x-cast:com.google.cast.media';
export const SENDER_ID = 'sender-0';
export const RECEIVER_ID = 'receiver-0';
export const CAST_PORT = 8009;
export const HEARTBEAT_MS = 5000;
/** No message at all for this long (PONGs included) means the connection is gone. */
export const HEARTBEAT_TIMEOUT_MS = 15_000;
export const CONNECT_TIMEOUT_MS = 8000;

export type CastPayload = { type?: string; requestId?: number } & Record<string, unknown>;

export interface CastJsonMessage {
  namespace: string;
  sourceId: string;
  destinationId: string;
  payload: CastPayload;
}

export type CastChannelFailure = 'refused' | 'timeout' | 'closed' | 'framing' | 'heartbeat' | 'notLan';

export class CastChannelError extends Error {
  constructor(
    readonly reason: CastChannelFailure,
    message: string,
  ) {
    super(message);
    this.name = 'CastChannelError';
  }
}

/** One-shot timer on a CastTimer (which only has intervals). */
export function castAfter(timer: CastTimer, ms: number, cb: () => void): () => void {
  let fired = false;
  const h = timer.setInterval(() => {
    if (fired) return;
    fired = true;
    timer.clearInterval(h);
    cb();
  }, ms);
  return () => {
    fired = true;
    timer.clearInterval(h);
  };
}

interface Waiter {
  pred: (m: CastJsonMessage) => boolean;
  resolve: (m: CastJsonMessage) => void;
  reject: (e: Error) => void;
  cancel: () => void;
}

export class CastChannel {
  private readonly decoder = new CastFrameDecoder();
  private readonly listeners = new Set<(m: CastJsonMessage) => void>();
  private readonly closeListeners = new Set<(e: CastChannelError) => void>();
  private readonly waiters = new Set<Waiter>();
  private heartbeat: unknown = null;
  private lastRx: number;
  private nextId = 1;
  private done = false;

  /**
   * Opens the socket and sends CONNECT to receiver-0. Rejects with CastChannelError: 'notLan' for a
   * host that is not a literal RFC 1918 address, 'timeout', or 'refused' (connection or TLS failure).
   */
  static async open(
    tcp: TcpFactory,
    host: string,
    timer: CastTimer,
    opts: { connectTimeoutMs?: number; port?: number } = {},
  ): Promise<CastChannel> {
    if (!isRfc1918Host(host)) throw new CastChannelError('notLan', 'Not a LAN host.');
    const ms = opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
    const socket = await new Promise<TcpLike>((resolve, reject) => {
      let settled = false;
      const cancel = castAfter(timer, ms, () => {
        if (settled) return;
        settled = true;
        reject(new CastChannelError('timeout', 'Timed out opening the cast connection.'));
      });
      tcp(host, opts.port ?? CAST_PORT, { tls: true }).then(
        (s) => {
          if (settled) {
            try {
              s.close();
            } catch {
              // ignore
            }
            return;
          }
          settled = true;
          cancel();
          resolve(s);
        },
        (e: unknown) => {
          if (settled) return;
          settled = true;
          cancel();
          reject(new CastChannelError('refused', e instanceof Error ? e.message : String(e)));
        },
      );
    });
    const ch = new CastChannel(socket, timer);
    ch.connect(RECEIVER_ID);
    return ch;
  }

  private constructor(
    private readonly socket: TcpLike,
    private readonly timer: CastTimer,
  ) {
    this.lastRx = timer.now();
    socket.onData((d) => this.onData(d));
    socket.onClose?.((err) => this.fail(new CastChannelError('closed', err?.message || 'The cast connection closed.')));
    this.heartbeat = timer.setInterval(() => this.beat(), HEARTBEAT_MS);
  }

  get closed(): boolean {
    return this.done;
  }

  /** Sends a JSON payload. Throws CastChannelError('closed') when the channel is gone. */
  send(namespace: string, destinationId: string, payload: CastPayload): void {
    if (this.done) throw new CastChannelError('closed', 'The cast connection is closed.');
    const frame = frameCastMessage({
      sourceId: SENDER_ID,
      destinationId,
      namespace,
      payloadUtf8: JSON.stringify(payload),
    });
    try {
      this.socket.write(frame);
    } catch (e) {
      const err = new CastChannelError('closed', e instanceof Error ? e.message : String(e));
      this.fail(err);
      throw err;
    }
  }

  /** Virtual connection to a receiver or an app's transportId. */
  connect(destinationId: string): void {
    this.send(NS_CONNECTION, destinationId, { type: 'CONNECT', origin: {} });
  }

  /** Waits for the first message matching `pred`. Rejects on timeout or when the channel closes. */
  waitFor(pred: (m: CastJsonMessage) => boolean, timeoutMs: number): Promise<CastJsonMessage> {
    if (this.done) return Promise.reject(new CastChannelError('closed', 'The cast connection is closed.'));
    return new Promise<CastJsonMessage>((resolve, reject) => {
      const w: Waiter = {
        pred,
        resolve: (m) => {
          w.cancel();
          this.waiters.delete(w);
          resolve(m);
        },
        reject: (e) => {
          w.cancel();
          this.waiters.delete(w);
          reject(e);
        },
        cancel: () => undefined,
      };
      w.cancel = castAfter(this.timer, timeoutMs, () => {
        this.waiters.delete(w);
        reject(new CastChannelError('timeout', 'The TV did not answer in time.'));
      });
      this.waiters.add(w);
    });
  }

  /**
   * Sends `payload` with a fresh requestId and resolves with the reply that carries the same
   * requestId on the same namespace from the same destination.
   */
  async request(namespace: string, destinationId: string, payload: CastPayload, timeoutMs: number): Promise<CastJsonMessage> {
    const requestId = this.newRequestId();
    const reply = this.waitFor(
      (m) => m.namespace === namespace && m.sourceId === destinationId && m.payload.requestId === requestId,
      timeoutMs,
    );
    try {
      this.send(namespace, destinationId, { ...payload, requestId });
    } catch (e) {
      reply.catch(() => undefined);
      throw e;
    }
    return reply;
  }

  newRequestId(): number {
    const id = this.nextId;
    this.nextId = id >= 0x7fffffff ? 1 : id + 1;
    return id;
  }

  /** Every incoming JSON message (heartbeats excluded). Returns an unsubscribe function. */
  onMessage(cb: (m: CastJsonMessage) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Called once when the channel fails or the device closes it (not after close()). */
  onClose(cb: (e: CastChannelError) => void): () => void {
    this.closeListeners.add(cb);
    return () => {
      this.closeListeners.delete(cb);
    };
  }

  /** Closes the virtual connection and the socket. Pending waits reject with 'closed'. */
  close(): void {
    if (this.done) return;
    try {
      this.send(NS_CONNECTION, RECEIVER_ID, { type: 'CLOSE' });
    } catch {
      // already gone
    }
    this.shutdown(new CastChannelError('closed', 'The cast connection is closed.'));
    this.closeListeners.clear();
  }

  private beat(): void {
    if (this.done) return;
    if (this.timer.now() - this.lastRx > HEARTBEAT_TIMEOUT_MS) {
      this.fail(new CastChannelError('heartbeat', 'The TV stopped answering.'));
      return;
    }
    try {
      this.send(NS_HEARTBEAT, RECEIVER_ID, { type: 'PING' });
    } catch {
      // fail() already ran
    }
  }

  private onData(chunk: Uint8Array): void {
    if (this.done) return;
    let frames;
    try {
      frames = this.decoder.push(chunk);
    } catch (e) {
      this.fail(new CastChannelError('framing', e instanceof Error ? e.message : String(e)));
      return;
    }
    for (const f of frames) {
      if (this.done) return;
      this.lastRx = this.timer.now();
      let payload: unknown;
      try {
        payload = JSON.parse(f.payloadUtf8);
      } catch {
        continue;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
      const m: CastJsonMessage = {
        namespace: f.namespace,
        sourceId: f.sourceId,
        destinationId: f.destinationId,
        payload: payload as CastPayload,
      };
      if (m.namespace === NS_HEARTBEAT) {
        if (m.payload.type === 'PING') {
          try {
            this.send(NS_HEARTBEAT, m.sourceId || RECEIVER_ID, { type: 'PONG' });
          } catch {
            return;
          }
        }
        continue;
      }
      for (const cb of [...this.listeners]) cb(m);
      for (const w of [...this.waiters]) if (this.waiters.has(w) && w.pred(m)) w.resolve(m);
    }
  }

  private fail(e: CastChannelError): void {
    if (this.done) return;
    this.shutdown(e);
    const cbs = [...this.closeListeners];
    this.closeListeners.clear();
    for (const cb of cbs) cb(e);
  }

  private shutdown(e: CastChannelError): void {
    this.done = true;
    if (this.heartbeat !== null) {
      this.timer.clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    try {
      this.socket.close();
    } catch {
      // ignore
    }
    for (const w of [...this.waiters]) w.reject(e);
    this.waiters.clear();
    this.listeners.clear();
  }
}
