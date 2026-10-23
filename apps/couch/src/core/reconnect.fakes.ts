import { Emitter, type DriverEvent, type TvDriver } from './driver';
import type { Key } from './keys';
import type { ConnectionState, Platform } from './types';

/**
 * Test fakes for the reconnect / keep-alive / key-hold logic (T70). Not imported by app code.
 * fakeClock(): injected timers + clock; advance() runs due callbacks in order and never really waits.
 * ScriptedDriver: connect() follows a script of outcomes and emits states like a real driver;
 * optional request() makes it look like a webOS socket for keepAlivePing().
 */

export interface FakeTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

export function fakeClock() {
  let now = 0;
  let seq = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: FakeTimers = {
    setTimeout(fn, ms) {
      const id = ++seq;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(h) {
      pending.delete(h as number);
    },
  };
  return {
    timers,
    now: () => now,
    pendingCount: () => pending.size,
    async advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let next: [number, { at: number; fn: () => void }] | null = null;
        for (const e of pending) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
        if (!next) break;
        pending.delete(next[0]);
        now = next[1].at;
        next[1].fn();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

export type Outcome = 'ok' | 'fail' | 'off';

export class ScriptedDriver implements TvDriver {
  readonly capabilities = new Set<never>();
  readonly events = new Emitter();
  connects = 0;
  sent: Key[] = [];
  /** When set, sendKey throws (socket gone). */
  sendFails = false;
  /** webOS-style request(): resolves, rejects or hangs per pingScript (default 'ok'). */
  pings: string[] = [];
  pingScript: Array<'ok' | 'fail' | 'hang'> = [];
  /** Optional hook run inside connect() before the outcome (e.g. to hold it open). */
  connectGate: (() => Promise<void>) | null = null;

  constructor(
    private outcomes: Outcome[] = [],
    readonly platform: Platform = 'roku',
  ) {}

  setOutcomes(o: Outcome[]): void {
    this.outcomes = o;
  }
  emitState(state: ConnectionState): void {
    this.events.emit({ type: 'state', state });
  }
  async connect(): Promise<void> {
    this.connects += 1;
    this.emitState('connecting');
    if (this.connectGate) await this.connectGate();
    const o = this.outcomes.shift() ?? 'fail';
    if (o === 'fail') {
      this.events.emit({ type: 'error', message: 'unreachable' });
      this.emitState('error');
      throw new Error('unreachable');
    }
    this.emitState(o === 'off' ? 'off' : 'connected');
  }
  async disconnect(): Promise<void> {}
  async sendKey(key: Key): Promise<void> {
    if (this.sendFails) throw new Error('not connected');
    this.sent.push(key);
    this.events.emit({ type: 'sent', what: key, ms: 10 });
  }
  async sendText(): Promise<void> {}
  async launchApp(): Promise<void> {}
  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }
}

/** A ScriptedDriver with a webOS-like request(), so keepAlivePing() gives it a ping. */
export class SocketDriver extends ScriptedDriver {
  constructor(outcomes: Outcome[] = []) {
    super(outcomes, 'webos');
  }
  request(uri: string): Promise<Record<string, unknown>> {
    this.pings.push(uri);
    const o = this.pingScript.shift() ?? 'ok';
    if (o === 'ok') return Promise.resolve({});
    if (o === 'fail') return Promise.reject(new Error('not connected'));
    return new Promise(() => {});
  }
}
