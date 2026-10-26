/**
 * Test double for the Google Cast tests (T106): a scripted Cast receiver behind a fake TLS
 * TcpFactory. It decodes what the driver writes with the real framing code and answers the way the
 * public CASTV2 descriptions say a Default Media Receiver does (reconstructed, never captured from
 * a real TV). Test-only.
 */
import type { TcpFactory, TcpLike } from '../../driver';
import { CastFrameDecoder, frameCastMessage } from '../googleCast/framing';

export const NS_CONN = 'urn:x-cast:com.google.cast.tp.connection';
export const NS_HB = 'urn:x-cast:com.google.cast.tp.heartbeat';
export const NS_RCV = 'urn:x-cast:com.google.cast.receiver';
export const NS_MEDIA = 'urn:x-cast:com.google.cast.media';
export const APP_ID = 'CC1AD845';
export const TRANSPORT = 'web-7';
export const SESSION = 'b1c2d3e4-sess';

export interface SentMessage {
  namespace: string;
  sourceId: string;
  destinationId: string;
  payload: Record<string, unknown>;
}

export type LoadMode = 'playing' | 'buffering' | 'photo-idle' | 'LOAD_FAILED' | 'LOAD_CANCELLED' | 'INVALID_REQUEST' | 'idle-error' | 'silent';

export class FakeCastSocket implements TcpLike {
  closed = false;
  private dataCb: ((d: Uint8Array) => void) | null = null;
  private closeCb: ((e?: Error) => void) | null = null;
  private readonly decoder = new CastFrameDecoder();
  constructor(private readonly device: FakeCastDevice) {}
  write(data: Uint8Array): void {
    if (this.closed) throw new Error('closed');
    for (const m of this.decoder.push(data)) {
      this.device.receive(this, {
        namespace: m.namespace,
        sourceId: m.sourceId,
        destinationId: m.destinationId,
        payload: JSON.parse(m.payloadUtf8) as Record<string, unknown>,
      });
    }
  }
  close(): void {
    this.closed = true;
  }
  onData(cb: (d: Uint8Array) => void): void {
    this.dataCb = cb;
  }
  onClose(cb: (e?: Error) => void): void {
    this.closeCb = cb;
  }
  deliver(bytes: Uint8Array): void {
    if (this.closed) return;
    if (this.device.chunked) for (const b of bytes) this.dataCb?.(Uint8Array.of(b));
    else this.dataCb?.(bytes);
  }
  /** The device drops the connection. */
  drop(message = 'Connection reset'): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCb?.(new Error(message));
  }
}

export class FakeCastDevice {
  /** Every message the sender wrote (heartbeats included). */
  sent: SentMessage[] = [];
  connects: { host: string; port: number; tls: boolean }[] = [];
  sockets: FakeCastSocket[] = [];
  /** 'refuse' rejects the TcpFactory, 'hang' never settles it. */
  connectMode: 'ok' | 'refuse' | 'hang' = 'ok';
  launchMode: 'ok' | 'error' | 'silent' | 'two-step' = 'ok';
  loadMode: LoadMode = 'playing';
  /** Deliver replies byte by byte (exercises the stream decoder). */
  chunked = false;
  /** Answer heartbeat PINGs. */
  answerPing = true;
  duration = 120;
  playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING' = 'IDLE';
  currentTime = 0;
  mediaSessionId = 0;
  appRunning = false;

  readonly tcp: TcpFactory = (host, port, opts) => {
    this.connects.push({ host, port, tls: opts?.tls === true });
    if (this.connectMode === 'refuse') return Promise.reject(new Error('ECONNREFUSED'));
    if (this.connectMode === 'hang') return new Promise<TcpLike>(() => undefined);
    const s = new FakeCastSocket(this);
    this.sockets.push(s);
    return Promise.resolve(s);
  };

  get socket(): FakeCastSocket {
    const s = this.sockets[this.sockets.length - 1];
    if (!s) throw new Error('no socket');
    return s;
  }

  /** Messages the sender wrote, without heartbeats. */
  get commands(): SentMessage[] {
    return this.sent.filter((m) => m.namespace !== NS_HB);
  }

  types(ns?: string): string[] {
    return this.commands.filter((m) => !ns || m.namespace === ns).map((m) => String(m.payload['type']));
  }

  /** Sends a message from the device to the sender (asynchronously, like a socket). */
  push(namespace: string, sourceId: string, payload: Record<string, unknown>, destinationId = 'sender-0'): void {
    const s = this.socket;
    const bytes = frameCastMessage({ namespace, sourceId, destinationId, payloadUtf8: JSON.stringify(payload) });
    void Promise.resolve().then(() => s.deliver(bytes));
  }

  mediaStatus(requestId: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      type: 'MEDIA_STATUS',
      requestId,
      status: [
        {
          mediaSessionId: this.mediaSessionId,
          playerState: this.playerState,
          currentTime: this.currentTime,
          media: { contentId: 'x', duration: this.duration },
          ...extra,
        },
      ],
    };
  }

  receiverStatus(requestId: number): Record<string, unknown> {
    return {
      type: 'RECEIVER_STATUS',
      requestId,
      status: {
        applications: this.appRunning
          ? [{ appId: APP_ID, displayName: 'Default Media Receiver', sessionId: SESSION, transportId: TRANSPORT, namespaces: [{ name: NS_MEDIA }] }]
          : [],
        volume: { level: 0.5, muted: false },
      },
    };
  }

  receive(_s: FakeCastSocket, m: SentMessage): void {
    this.sent.push(m);
    const p = m.payload;
    const rid = typeof p['requestId'] === 'number' ? p['requestId'] : 0;
    if (m.namespace === NS_HB) {
      if (p['type'] === 'PING' && this.answerPing) this.push(NS_HB, m.destinationId, { type: 'PONG' });
      return;
    }
    if (m.namespace === NS_RCV) {
      if (p['type'] === 'LAUNCH') {
        if (this.launchMode === 'silent') return;
        if (this.launchMode === 'error') {
          this.push(NS_RCV, 'receiver-0', { type: 'LAUNCH_ERROR', requestId: rid, reason: 'NOT_FOUND' });
          return;
        }
        if (this.launchMode === 'two-step') {
          // First a status without the app yet (reply to the request), then a broadcast with it.
          this.push(NS_RCV, 'receiver-0', this.receiverStatus(rid));
          this.appRunning = true;
          this.push(NS_RCV, 'receiver-0', this.receiverStatus(0));
          return;
        }
        this.appRunning = true;
        this.push(NS_RCV, 'receiver-0', this.receiverStatus(rid));
      } else if (p['type'] === 'STOP') {
        this.appRunning = false;
        this.playerState = 'IDLE';
        this.push(NS_RCV, 'receiver-0', this.receiverStatus(rid));
      } else if (p['type'] === 'GET_STATUS') {
        this.push(NS_RCV, 'receiver-0', this.receiverStatus(rid));
      }
      return;
    }
    if (m.namespace !== NS_MEDIA || m.destinationId !== TRANSPORT) return;
    switch (p['type']) {
      case 'LOAD': {
        const mode = this.loadMode;
        if (mode === 'silent') return;
        if (mode === 'LOAD_FAILED' || mode === 'LOAD_CANCELLED' || mode === 'INVALID_REQUEST') {
          this.push(NS_MEDIA, TRANSPORT, { type: mode, requestId: rid, reason: 'INVALID_PARAMS' });
          return;
        }
        this.mediaSessionId += 1;
        this.currentTime = 0;
        if (mode === 'idle-error') {
          this.playerState = 'IDLE';
          this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid, { idleReason: 'ERROR' }));
          return;
        }
        if (mode === 'photo-idle') {
          this.playerState = 'IDLE';
          this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid));
          return;
        }
        this.playerState = mode === 'buffering' ? 'BUFFERING' : 'PLAYING';
        this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid));
        return;
      }
      case 'PLAY':
        this.playerState = 'PLAYING';
        this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid));
        return;
      case 'PAUSE':
        this.playerState = 'PAUSED';
        this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid));
        return;
      case 'SEEK':
        this.currentTime = Number(p['currentTime']);
        this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid));
        return;
      case 'STOP':
        this.playerState = 'IDLE';
        this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid, { idleReason: 'CANCELLED' }));
        return;
      case 'GET_STATUS':
        if (this.playerState === 'IDLE' && this.mediaSessionId === 0) this.push(NS_MEDIA, TRANSPORT, { type: 'MEDIA_STATUS', requestId: rid, status: [] });
        else this.push(NS_MEDIA, TRANSPORT, this.mediaStatus(rid));
        return;
    }
  }
}
