/**
 * Widget deep-link handling (T77), without React so it is unit-tested in Node.
 *
 * A widget tap opens couch://widget/<action>?tv=<id>. The handler parses it strictly, drops
 * duplicates and floods (WidgetTapGate), switches to that TV if it is not the active one, and sends
 * the action's keys through the session like any remote button.
 *
 * Every TV control is free: this file never looks at Couch Plus. A link that arrives always sends
 * its key, with or without Plus. Plus only decides whether the widget is offered with buttons at all
 * (snapshotSync.ts / useWidgetLinks.ts).
 */
import type { Key } from '../../core/keys';
import { actionKeys } from '../../core/widget/actions';
import { looksLikeWidgetLink, parseWidgetLink, type WidgetLink } from '../../core/widget/links';
import { WidgetTapGate } from '../../core/widget/tapGate';

/** The slice of RemoteSession the handler needs (tests pass a fake). */
export interface WidgetLinkTarget {
  /** Ids of the TVs the session knows right now (empty while saved TVs are still loading). */
  tvIds(): readonly string[];
  activeId(): string | null;
  /** Demo mode: widget links never drive the demo TVs. */
  isDemo(): boolean;
  select(id: string): void;
  sendKey(key: Key): Promise<boolean>;
}

export type WidgetLinkResult =
  /** Not a widget link at all: leave it to the router. */
  | 'notWidget'
  /** Aimed at the widget path but malformed: swallowed, nothing sent. */
  | 'rejected'
  | 'duplicate'
  | 'rateLimited'
  /** The session has no TVs yet (cold start); kept and retried by retryPending(). */
  | 'pending'
  /** The TV in the link is not one of ours (removed, or demo mode): nothing sent. */
  | 'unknownTv'
  | 'sent'
  /** Keys were tried but the session reported a failure (shown by the remote's usual error toast). */
  | 'failed';

export interface WidgetLinkHandlerOptions {
  now?: () => number;
  gate?: WidgetTapGate;
  /** A link that arrived before the TVs loaded is still sent if they load within this time. */
  pendingMs?: number;
}

export const WIDGET_PENDING_MS = 4000;

export interface WidgetLinkHandler {
  handle(url: string | null | undefined): Promise<WidgetLinkResult>;
  /** Call when the session changes; sends a pending link once its TV is known. */
  retryPending(): Promise<WidgetLinkResult | null>;
  hasPending(): boolean;
}

export function createWidgetLinkHandler(target: WidgetLinkTarget, opts: WidgetLinkHandlerOptions = {}): WidgetLinkHandler {
  const now = opts.now ?? (() => Date.now());
  const gate = opts.gate ?? new WidgetTapGate();
  const pendingMs = opts.pendingMs ?? WIDGET_PENDING_MS;
  let pending: { link: WidgetLink; at: number } | null = null;

  async function deliver(link: WidgetLink): Promise<WidgetLinkResult> {
    if (target.isDemo() || !target.tvIds().includes(link.tvId)) return 'unknownTv';
    if (target.activeId() !== link.tvId) target.select(link.tvId);
    if (target.activeId() !== link.tvId) return 'unknownTv';
    let ok = true;
    for (const key of actionKeys(link.action)) {
      // sendKey never throws in RemoteSession; guard anyway so a fake or future change cannot crash startup.
      const sent = await target.sendKey(key).catch(() => false);
      ok = ok && sent;
    }
    return ok ? 'sent' : 'failed';
  }

  return {
    async handle(url) {
      if (!looksLikeWidgetLink(url)) return 'notWidget';
      const link = parseWidgetLink(url);
      if (!link) return 'rejected';
      const verdict = gate.check(link, now());
      if (verdict !== 'ok') return verdict;
      if (target.tvIds().length === 0 && !target.isDemo()) {
        pending = { link, at: now() };
        return 'pending';
      }
      pending = null;
      return deliver(link);
    },

    async retryPending() {
      if (!pending) return null;
      if (now() - pending.at > pendingMs || now() < pending.at) {
        pending = null;
        return null;
      }
      if (target.tvIds().length === 0 && !target.isDemo()) return null;
      const { link } = pending;
      pending = null;
      return deliver(link);
    },

    hasPending() {
      return pending !== null;
    },
  };
}
