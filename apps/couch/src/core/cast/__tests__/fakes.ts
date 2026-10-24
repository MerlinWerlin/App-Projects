/**
 * Test doubles for the cast tests (T89): a fake CastTimer, a recording fetch, a fake UPnP renderer
 * that answers with the SOAP fixtures in this folder, and a fake UDP socket. Test-only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike, UdpLike } from '../../driver';
import type { CastTimer } from '../session';

export const fx = (name: string): string => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

/** Deterministic timer: advance(ms) fires each interval at its due times, in order. */
export class FakeTimer implements CastTimer {
  t = 0;
  private next = 1;
  readonly intervals = new Map<number, { cb: () => void; ms: number; due: number }>();
  setInterval(cb: () => void, ms: number): unknown {
    const id = this.next++;
    this.intervals.set(id, { cb, ms, due: this.t + ms });
    return id;
  }
  clearInterval(h: unknown): void {
    this.intervals.delete(h as number);
  }
  now(): number {
    return this.t;
  }
  get active(): number {
    return this.intervals.size;
  }
  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    for (;;) {
      let pick: [number, { cb: () => void; ms: number; due: number }] | null = null;
      for (const e of this.intervals) if (e[1].due <= end && (!pick || e[1].due < pick[1].due)) pick = e;
      if (!pick) break;
      const [, iv] = pick;
      this.t = iv.due;
      iv.due += iv.ms;
      iv.cb();
      await flush();
    }
    this.t = end;
    await flush();
  }
}

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface FakeReply {
  status?: number;
  body?: string;
}

/** Records every request; `handler` returns a reply, or throws to simulate an unreachable host. */
export function recordingFetch(handler: (c: FetchCall) => FakeReply | Promise<FakeReply>): {
  fetch: FetchLike;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetch: FetchLike = async (url, init = {}) => {
    const c: FetchCall = { url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ?? '' };
    calls.push(c);
    const r = await handler(c);
    const status = r.status ?? 200;
    return { status, ok: status >= 200 && status < 300, text: async () => r.body ?? '' };
  };
  return { fetch, calls };
}

export const unreachable = (): never => {
  throw new Error('connect ECONNREFUSED');
};

/** A UPnP AVTransport renderer answering with this folder's SOAP fixtures. */
export class FakeRenderer {
  state: 'NO_MEDIA_PRESENT' | 'STOPPED' | 'PLAYING' | 'PAUSED_PLAYBACK' = 'NO_MEDIA_PRESENT';
  /** Actions that answer with the 714 SOAP fault. */
  faults = new Set<string>();
  actions: string[] = [];
  readonly http = recordingFetch((c) => this.reply(c));

  private reply(c: FetchCall): FakeReply {
    const action = /#(\w+)"$/.exec(c.headers['SOAPACTION'] ?? '')?.[1] ?? '';
    this.actions.push(action);
    if (this.faults.has(action)) return { status: 500, body: fx('soap-fault-714.xml') };
    switch (action) {
      case 'SetAVTransportURI':
        this.state = 'STOPPED';
        return { body: fx('soap-set-uri-response.xml') };
      case 'Play':
        this.state = 'PLAYING';
        return { body: fx('soap-play-response.xml') };
      case 'Pause':
        this.state = 'PAUSED_PLAYBACK';
        return { body: fx('soap-pause-response.xml') };
      case 'Stop':
        this.state = 'STOPPED';
        return { body: fx('soap-stop-response.xml') };
      case 'Seek':
        return { body: fx('soap-seek-response.xml') };
      case 'GetTransportInfo':
        return {
          body:
            this.state === 'PLAYING'
              ? fx('soap-get-transport-info.xml')
              : this.state === 'PAUSED_PLAYBACK'
                ? fx('soap-get-transport-info-paused.xml')
                : fx('soap-get-transport-info-stopped.xml'),
        };
      case 'GetPositionInfo':
        return { body: fx('soap-get-position-info.xml') };
      default:
        return { status: 500, body: '' };
    }
  }
}

/** Fake UDP socket: `onSend` may answer by calling `deliver`. */
export class FakeUdp implements UdpLike {
  sent: { text: string; port: number; host: string }[] = [];
  closed = false;
  private cb: ((data: Uint8Array, from: { address: string; port: number }) => void) | null = null;
  constructor(private readonly onSend: (sock: FakeUdp, text: string, host: string) => void = () => undefined) {}
  async send(data: Uint8Array, port: number, host: string): Promise<void> {
    const text = new TextDecoder().decode(data);
    this.sent.push({ text, port, host });
    this.onSend(this, text, host);
  }
  close(): void {
    this.closed = true;
  }
  onMessage(cb: (data: Uint8Array, from: { address: string; port: number }) => void): void {
    this.cb = cb;
  }
  deliver(text: string, address: string): void {
    this.cb?.(new TextEncoder().encode(text), { address, port: 1900 });
  }
}
