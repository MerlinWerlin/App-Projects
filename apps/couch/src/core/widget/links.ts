/**
 * Widget deep links (T77): couch://widget/<action>?tv=<savedTvId>. Pure TypeScript.
 *
 * The parser is strict on purpose: a deep link can come from anywhere on the phone, so only this
 * exact shape is accepted. Another scheme or host, a trailing slash, a fragment, extra or repeated
 * query parameters, an unknown action or a malformed TV id all give null. No URL class is used (the
 * React Native URL polyfill is incomplete); the string is matched as a whole.
 */
import { isWidgetAction, type WidgetAction } from './actions';

export const WIDGET_LINK_PREFIX = 'couch://widget/';

/** Longest link we look at; real ones are well under 200 characters. */
export const MAX_WIDGET_LINK_LENGTH = 512;

/**
 * Saved TV ids are `<platform>-<usn or host>` with [A-Za-z0-9._:-] (src/core/addTv.ts tvIdFor), plus
 * short ids like `demo-1` or IR ids. Anything else is refused.
 */
const TV_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export function isValidWidgetTvId(v: unknown): v is string {
  return typeof v === 'string' && TV_ID_RE.test(v);
}

export interface WidgetLink {
  action: WidgetAction;
  tvId: string;
}

/** The deep link a widget button opens. Throws on an invalid TV id (a programming error). */
export function buildWidgetLink(action: WidgetAction, tvId: string): string {
  if (!isWidgetAction(action)) throw new Error(`unknown widget action: ${String(action)}`);
  if (!isValidWidgetTvId(tvId)) throw new Error('invalid widget TV id');
  return `${WIDGET_LINK_PREFIX}${action}?tv=${encodeURIComponent(tvId)}`;
}

// action: lowercase words joined by '-'; tv value: unreserved characters, ':' and %XX escapes only.
const LINK_RE = /^couch:\/\/widget\/([a-z]+(?:-[a-z]+)*)\?tv=((?:[A-Za-z0-9._~:-]|%[0-9A-Fa-f]{2})+)$/;

/** Parses a widget deep link, or null for anything that is not exactly a valid one. Never throws. */
export function parseWidgetLink(url: unknown): WidgetLink | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_WIDGET_LINK_LENGTH) return null;
  const m = LINK_RE.exec(url);
  if (!m) return null;
  const action = m[1]!;
  if (!isWidgetAction(action)) return null;
  let tvId: string;
  try {
    tvId = decodeURIComponent(m[2]!);
  } catch {
    return null;
  }
  if (!isValidWidgetTvId(tvId)) return null;
  return { action, tvId };
}

/** True when a URL is aimed at the widget path (valid or not), so the app can swallow it quietly. */
export function looksLikeWidgetLink(url: unknown): boolean {
  return typeof url === 'string' && url.startsWith(WIDGET_LINK_PREFIX);
}
