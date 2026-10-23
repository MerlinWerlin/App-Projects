/**
 * Tap gate for widget deep links (T77). Pure TypeScript, injected clock.
 *
 * A widget button can deliver the same link twice (a double tap, or the system replaying the launch
 * URL when the app comes up). The gate drops an identical action for the same TV that arrives within
 * `dedupeMs` of the last accepted one, and caps the overall rate so a flood of links cannot queue
 * dozens of key presses.
 */
import type { WidgetLink } from './links';

export const WIDGET_DEDUPE_MS = 250;
export const WIDGET_RATE_WINDOW_MS = 1000;
export const WIDGET_RATE_MAX = 8;

export interface TapGateOptions {
  dedupeMs?: number;
  windowMs?: number;
  maxPerWindow?: number;
}

export type TapVerdict = 'ok' | 'duplicate' | 'rateLimited';

export class WidgetTapGate {
  private readonly dedupeMs: number;
  private readonly windowMs: number;
  private readonly maxPerWindow: number;
  private last: { key: string; at: number } | null = null;
  private accepted: number[] = [];

  constructor(opts: TapGateOptions = {}) {
    this.dedupeMs = opts.dedupeMs ?? WIDGET_DEDUPE_MS;
    this.windowMs = opts.windowMs ?? WIDGET_RATE_WINDOW_MS;
    this.maxPerWindow = opts.maxPerWindow ?? WIDGET_RATE_MAX;
  }

  /** Decides whether a tap at time `now` (ms) goes through; an 'ok' tap is recorded. */
  check(link: WidgetLink, now: number): TapVerdict {
    const key = `${link.action}\n${link.tvId}`;
    if (this.last && this.last.key === key && now >= this.last.at && now - this.last.at < this.dedupeMs) {
      return 'duplicate';
    }
    this.accepted = this.accepted.filter((at) => now >= at && now - at < this.windowMs);
    if (this.accepted.length >= this.maxPerWindow) return 'rateLimited';
    this.accepted.push(now);
    this.last = { key, at: now };
    return 'ok';
  }

  /** Convenience: true when check() says 'ok'. */
  allow(link: WidgetLink, now: number): boolean {
    return this.check(link, now) === 'ok';
  }

  reset(): void {
    this.last = null;
    this.accepted = [];
  }
}
