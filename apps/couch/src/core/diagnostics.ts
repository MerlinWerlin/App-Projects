import { getLocale, t, type MessageKey } from '../i18n/core';
import type { AnyLocale } from '../i18n/locales';
import type { DriverEvent, TvDriver } from './driver';
import { isRfc1918Host } from './lanHost';
import { PLATFORM_LABEL, type ConnectionState, type Tv } from './types';

/**
 * Per-TV connection diagnostics (PLAN positioning #2: latency lives in a diagnostics screen).
 * Subscribes to a RemoteSession from the outside (no hooks inside session.ts): every TV that
 * becomes active gets its driver observed for 'sent' latency, 'state' changes and 'error's,
 * and keeps being observed after the user switches away. Pure TS, unit-tested in Node.
 */

export const LATENCY_WINDOW = 50;
export const LOG_LIMIT = 50;

export interface LatencyStats {
  count: number;
  last: number;
  median: number;
  p90: number;
  min: number;
  max: number;
}

export interface ReconnectLogEntry {
  at: number;
  from: ConnectionState | null;
  to: ConnectionState;
  /** Reconnect attempt number when the change happened (0 = not a reconnect run). */
  attempt: number;
}

export interface TvDiagnostics {
  tvId: string;
  samples: readonly number[];
  state: ConnectionState | null;
  lastError: { message: string; at: number } | null;
  log: readonly ReconnectLogEntry[];
}

/** What Diagnostics needs from RemoteSession (structural, so tests can use the real one). */
export interface DiagnosticsSource {
  subscribe(cb: () => void): () => void;
  getSnapshot(): { tvs: Tv[]; activeId: string | null; lastError: string | null; demo: boolean };
  activeDriver(): TvDriver | null;
}

export interface DiagnosticsOptions {
  now?: () => number;
  /** Current reconnect attempt for a TV (Reconnector.attemptFor). */
  attemptFor?: (tvId: string) => number;
}

/** Median and nearest-rank p90 over a window of ms values. Null for an empty window. */
export function latencyStats(samples: readonly number[]): LatencyStats | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const at = (i: number) => sorted[Math.min(n - 1, Math.max(0, i))] as number;
  const median = n % 2 === 1 ? at((n - 1) / 2) : (at(n / 2 - 1) + at(n / 2)) / 2;
  return {
    count: n,
    last: samples[n - 1] as number,
    median,
    p90: at(Math.ceil(0.9 * n) - 1),
    min: at(0),
    max: at(n - 1),
  };
}

interface Entry {
  tvId: string;
  driver: TvDriver;
  unsub: () => void;
  samples: number[];
  state: ConnectionState | null;
  lastError: { message: string; at: number } | null;
  log: ReconnectLogEntry[];
}

export class Diagnostics {
  private readonly now: () => number;
  private readonly attemptFor: (tvId: string) => number;
  private entries = new Map<string, Entry>();
  private tvs: Tv[] = [];
  private activeId: string | null = null;
  private demo = false;
  private lastSessionError: string | null = null;
  private unsubSource: (() => void) | null = null;
  private subs = new Set<() => void>();
  private rev = 0;

  constructor(opts: DiagnosticsOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.attemptFor = opts.attemptFor ?? (() => 0);
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  /** Bumps on every change (cheap change detection for React). */
  getRev(): number {
    return this.rev;
  }

  /** Follow a session: observe each active TV's driver; forget TVs that leave the list. */
  bind(source: DiagnosticsSource): () => void {
    this.unsubSource?.();
    const sync = () => {
      const snap = source.getSnapshot();
      this.tvs = snap.tvs;
      this.demo = snap.demo;
      const switched = snap.activeId !== this.activeId;
      this.activeId = snap.activeId;
      const ids = new Set(snap.tvs.map((t) => t.id));
      for (const [id, e] of this.entries) {
        if (!ids.has(id)) {
          e.unsub();
          this.entries.delete(id);
        }
      }
      const d = source.activeDriver();
      if (snap.activeId && d) this.attach(snap.activeId, d);
      // Errors the session caught from thrown driver calls (not every driver emits 'error').
      if (!switched && snap.lastError && snap.lastError !== this.lastSessionError && snap.activeId) {
        this.recordError(snap.activeId, snap.lastError);
      }
      this.lastSessionError = snap.lastError;
      this.changed();
    };
    this.unsubSource = source.subscribe(sync);
    sync();
    return () => {
      this.unsubSource?.();
      this.unsubSource = null;
    };
  }

  /** Observe one TV's driver (re-attaches if the driver object for that id changed). */
  attach(tvId: string, driver: TvDriver): void {
    const cur = this.entries.get(tvId);
    if (cur && cur.driver === driver) return;
    cur?.unsub();
    const e: Entry = {
      tvId,
      driver,
      unsub: () => {},
      samples: cur?.samples ?? [],
      state: cur?.state ?? null,
      lastError: cur?.lastError ?? null,
      log: cur?.log ?? [],
    };
    e.unsub = driver.on((ev) => this.onEvent(e, ev));
    this.entries.set(tvId, e);
    this.changed();
  }

  get(tvId: string): TvDiagnostics | null {
    const e = this.entries.get(tvId);
    if (!e) return null;
    return { tvId, samples: e.samples, state: e.state, lastError: e.lastError, log: e.log };
  }

  stats(tvId: string): LatencyStats | null {
    const e = this.entries.get(tvId);
    return e ? latencyStats(e.samples) : null;
  }

  /** Record an error for a TV (also used for the session's caught errors). */
  recordError(tvId: string, message: string): void {
    const e = this.entries.get(tvId);
    if (!e) return;
    e.lastError = { message, at: this.now() };
    this.changed();
  }

  dispose(): void {
    this.unsubSource?.();
    this.unsubSource = null;
    for (const e of this.entries.values()) e.unsub();
    this.entries.clear();
    this.subs.clear();
  }

  /**
   * Plain-text report the user can copy or share. TVs are numbered (their names and rooms are
   * the user's own words and stay out); the only address included is the TV's private LAN IP.
   */
  formatReport(now: number, info: { appVersion: string; os?: string } = { appVersion: 'unknown' }): string {
    const lines: string[] = [];
    lines.push('Couch diagnostics');
    lines.push(`Generated: ${iso(now)}`);
    lines.push(`App version: ${info.appVersion}`);
    if (info.os) lines.push(`Device OS: ${info.os}`);
    lines.push(`Mode: ${this.demo ? 'demo TVs' : 'real TVs'}`);
    lines.push(`TVs: ${this.tvs.length}`);
    this.tvs.forEach((tv, i) => {
      const e = this.entries.get(tv.id);
      lines.push('');
      const active = tv.id === this.activeId ? ' [active]' : '';
      lines.push(`TV ${i + 1}: ${PLATFORM_LABEL[tv.platform]}${tv.model ? ` ${tv.model}` : ''}${active}`);
      lines.push(`  Address: ${!tv.host ? '(none)' : isRfc1918Host(tv.host) ? tv.host : '(not a LAN IP, hidden)'}`);
      lines.push(`  State: ${e?.state ?? 'unknown'}`);
      const s = e ? latencyStats(e.samples) : null;
      lines.push(
        s
          ? `  Latency (last ${s.count}): last ${s.last} ms, median ${fmt(s.median)} ms, p90 ${s.p90} ms, min ${s.min} ms, max ${s.max} ms`
          : '  Latency: no commands sent yet',
      );
      lines.push(e?.lastError ? `  Last error: ${e.lastError.message} (${iso(e.lastError.at)}, ${ago(now, e.lastError.at, 'en')})` : '  Last error: none');
      const log = e?.log ?? [];
      if (log.length === 0) {
        lines.push('  Connection log: empty');
      } else {
        lines.push(`  Connection log (${log.length}, oldest first):`);
        for (const l of log) lines.push(`    ${formatLogEntry(l, 'en')}`);
      }
    });
    return lines.join('\n');
  }

  // --- internals ---

  private onEvent(e: Entry, ev: DriverEvent): void {
    if (ev.type === 'sent') {
      if (!Number.isFinite(ev.ms)) return;
      e.samples = [...e.samples, ev.ms].slice(-LATENCY_WINDOW);
    } else if (ev.type === 'state') {
      if (ev.state === e.state) return;
      const entry: ReconnectLogEntry = { at: this.now(), from: e.state, to: ev.state, attempt: this.attemptFor(e.tvId) };
      e.log = [...e.log, entry].slice(-LOG_LIMIT);
      e.state = ev.state;
    } else if (ev.type === 'error') {
      e.lastError = { message: ev.message, at: this.now() };
    }
    this.changed();
  }

  private changed(): void {
    this.rev += 1;
    for (const cb of this.subs) cb();
  }
}

const STATE_KEY: Record<ConnectionState, MessageKey> = {
  disconnected: 'core.diagnostics.state.disconnected',
  connecting: 'core.diagnostics.state.connecting',
  connected: 'core.diagnostics.state.connected',
  off: 'core.diagnostics.state.off',
  error: 'core.diagnostics.state.error',
};

/**
 * One connection-log line, e.g. "10:00:05 connected -> off (attempt 2)". Shown on the Diagnostics
 * screen in the active language; the shared report (formatReport) passes 'en' so support can read it.
 */
export function formatLogEntry(l: ReconnectLogEntry, locale: AnyLocale = getLocale()): string {
  const params = {
    time: iso(l.at).slice(11, 19),
    from: l.from ? t(STATE_KEY[l.from], undefined, locale) : t('core.diagnostics.start', undefined, locale),
    to: t(STATE_KEY[l.to], undefined, locale),
  };
  if (l.attempt > 0) return t('core.diagnostics.logEntryAttempt', { ...params, attempt: l.attempt }, locale);
  return t('core.diagnostics.logEntry', params, locale);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "5s ago", "3m ago", "2h ago" in the active (or given) language. */
export function ago(now: number, at: number, locale: AnyLocale = getLocale()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return t('core.diagnostics.agoSeconds', { count: s }, locale);
  const m = Math.round(s / 60);
  if (m < 60) return t('core.diagnostics.agoMinutes', { count: m }, locale);
  return t('core.diagnostics.agoHours', { count: Math.round(m / 60) }, locale);
}
