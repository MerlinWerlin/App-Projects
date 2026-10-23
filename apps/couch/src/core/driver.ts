import type { IrTransmitter } from './ir/transmitter';
import type { Key } from './keys';
import type { Capability, ConnectionState, Platform, TvApp, TvInput } from './types';

/**
 * Transport adapters are injected so drivers stay pure and run in Node tests
 * with fakes and recorded fixtures (src/core/drivers/__fixtures__/).
 */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number },
) => Promise<{
  status: number;
  ok: boolean;
  text(): Promise<string>;
  /** Response headers (case-insensitive), when the adapter exposes them (Philips Digest needs WWW-Authenticate). */
  headers?: { get(name: string): string | null };
}>;

export interface WsLike {
  send(data: string): void;
  close(): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
}
export type WsFactory = (url: string, opts?: { allowSelfSignedLan?: boolean }) => Promise<WsLike>;

export interface TcpLike {
  write(data: Uint8Array): void;
  close(): void;
  onData(cb: (data: Uint8Array) => void): void;
}
export type TcpFactory = (host: string, port: number, opts?: { tls?: boolean }) => Promise<TcpLike>;

export interface UdpLike {
  send(data: Uint8Array, port: number, host: string): Promise<void>;
  close(): void;
  /** Datagrams received on this socket (needed for SSDP replies). Optional: send-only sockets omit it. */
  onMessage?(cb: (data: Uint8Array, from: { address: string; port: number }) => void): void;
}

export interface Transport {
  fetch?: FetchLike;
  ws?: WsFactory;
  tcp?: TcpFactory;
  udp?: () => Promise<UdpLike>;
  /** Infrared emitter (Android dev builds with an IR blaster); absent elsewhere. */
  ir?: IrTransmitter;
  /** Self-signed-tolerant fetch for RFC 1918 https (lan-wss module, dev builds only): Vizio, Philips, Fire TV. */
  lanFetch?: FetchLike;
}

export type DriverEvent =
  | { type: 'state'; state: ConnectionState }
  | { type: 'sent'; what: string; ms: number }
  | { type: 'error'; message: string };

export interface TvDriver {
  readonly platform: Platform;
  readonly capabilities: ReadonlySet<Capability>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendKey(key: Key): Promise<void>;
  sendText(text: string): Promise<void>;
  launchApp(appId: string): Promise<void>;
  listApps?(): Promise<TvApp[]>;
  volume?(): Promise<number>;
  powerOn?(): Promise<void>;
  /** Inputs the TV reports (capability 'inputs'). Without it the UI sends SOURCE / cycles. */
  listInputs?(): Promise<TvInput[]>;
  setInput?(inputId: string): Promise<void>;
  /**
   * Icon for an app exactly as the TV supplies it (capability 'appIcons'): an http(s) URL on the
   * LAN or a data: URI. null when the TV gives none; the UI then shows the house-style tile.
   * Never a bundled or redrawn service logo.
   */
  appIcon?(app: TvApp): Promise<string | null>;
  /** Native voice over the TV protocol (capability 'voice'); otherwise the app uses phone speech-to-text + sendText. */
  beginVoice?(): Promise<VoiceStream>;
  /** Subscribe to state/latency events; returns an unsubscribe function. */
  on(cb: (e: DriverEvent) => void): () => void;
}

export interface VoiceStream {
  /** PCM 16-bit mono chunks from the microphone. */
  sendAudio(chunk: Uint8Array): void;
  end(): Promise<void>;
  cancel(): void;
}

/** Small helper drivers can reuse for listener bookkeeping. */
export class Emitter {
  private subs = new Set<(e: DriverEvent) => void>();
  on(cb: (e: DriverEvent) => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
  emit(e: DriverEvent): void {
    for (const s of this.subs) s(e);
  }
}
