/**
 * Widget snapshot (T77): the small JSON document the app writes to shared storage (an App Group on
 * iOS, SharedPreferences on Android) for the widget extension to draw. Pure TypeScript.
 *
 * The widget never talks to the app's JS: it renders this snapshot and opens deep links. Labels are
 * translated here, in the app's active language, so the extension needs no catalogue of its own.
 * Nothing secret goes in (no host, MAC or pairing token; widgets.md section 2 keeps those for a
 * later Keychain step).
 *
 * `plus` is a plain boolean passed in by the caller (src/ui/widget reads it from src/plus); src/core
 * never reads the entitlement. Without Plus the snapshot carries no buttons, only a hint and an
 * "Open Couch" tile. The app's remote is never affected either way.
 */
import { t } from '../../i18n/core';
import type { ConnectionState } from '../types';
import {
  DEFAULT_WIDGET_ACTIONS,
  MAX_WIDGET_ACTIONS,
  isWidgetAction,
  widgetActionLabel,
  type WidgetAction,
} from './actions';
import { buildWidgetLink, isValidWidgetTvId, parseWidgetLink } from './links';

export const WIDGET_SNAPSHOT_VERSION = 1;

/** Where a plain tap on the widget (outside a button) goes: the app's start screen. */
export const WIDGET_OPEN_URL = 'couch://';

/** Longest TV name shown on a widget before it is cut with an ellipsis. */
export const MAX_WIDGET_TV_NAME = 32;

export type WidgetConnection = 'connected' | 'connecting' | 'offline' | 'off';
export const WIDGET_CONNECTIONS: readonly WidgetConnection[] = ['connected', 'connecting', 'offline', 'off'];

export interface WidgetButton {
  action: WidgetAction;
  label: string;
  url: string;
}

export interface WidgetTv {
  id: string;
  name: string;
  connection: WidgetConnection;
  connectionLabel: string;
}

export interface WidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  updatedAt: number;
  plus: boolean;
  tv: WidgetTv | null;
  buttons: WidgetButton[];
  /** A short line for the widget when it has no buttons (no Plus, or no TV yet); otherwise null. */
  message: string | null;
  openLabel: string;
  openUrl: typeof WIDGET_OPEN_URL;
}

export interface WidgetSnapshotInput {
  /** The current TV (last used / active), or null when there is none or the app is in demo mode. */
  tv: { id: string; name: string } | null;
  state: ConnectionState | null;
  reconnecting?: boolean;
  /** Whether the user has Couch Plus (read by the caller through src/plus). */
  plus: boolean;
  actions?: readonly WidgetAction[];
  maxActions?: number;
  now: number;
}

/** Maps the session's connection state to what the widget shows. */
export function widgetConnection(state: ConnectionState | null, reconnecting = false): WidgetConnection {
  if (reconnecting) return 'connecting';
  switch (state) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'off':
      return 'off';
    default:
      return 'offline';
  }
}

export function widgetConnectionLabel(c: WidgetConnection): string {
  switch (c) {
    case 'connected':
      return t('core.widget.state.connected');
    case 'connecting':
      return t('core.widget.state.connecting');
    case 'off':
      return t('core.widget.state.off');
    default:
      return t('core.widget.state.offline');
  }
}

/** Trims, collapses whitespace, falls back to "Your TV" and cuts long names with an ellipsis. */
export function widgetTvName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return t('core.widget.unnamedTv');
  const chars = Array.from(clean);
  if (chars.length <= MAX_WIDGET_TV_NAME) return clean;
  return `${chars.slice(0, MAX_WIDGET_TV_NAME - 1).join('').trimEnd()}…`;
}

/** Unknown actions dropped, duplicates removed (first wins), capped at maxActions (1..MAX). */
export function pickWidgetActions(actions: readonly WidgetAction[] = DEFAULT_WIDGET_ACTIONS, max = MAX_WIDGET_ACTIONS): WidgetAction[] {
  const cap = Math.max(0, Math.min(MAX_WIDGET_ACTIONS, Math.floor(Number.isFinite(max) ? max : MAX_WIDGET_ACTIONS)));
  const out: WidgetAction[] = [];
  for (const a of actions) {
    if (out.length >= cap) break;
    if (isWidgetAction(a) && !out.includes(a)) out.push(a);
  }
  return out;
}

/** Builds the snapshot the widget renders. */
export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const tvOk = input.tv !== null && isValidWidgetTvId(input.tv.id);
  const connection = widgetConnection(input.state, input.reconnecting ?? false);
  const tv: WidgetTv | null =
    tvOk && input.tv
      ? { id: input.tv.id, name: widgetTvName(input.tv.name), connection, connectionLabel: widgetConnectionLabel(connection) }
      : null;
  const buttons: WidgetButton[] =
    input.plus && tv
      ? pickWidgetActions(input.actions, input.maxActions).map((action) => ({
          action,
          label: widgetActionLabel(action),
          url: buildWidgetLink(action, tv.id),
        }))
      : [];
  let message: string | null = null;
  if (!input.plus) message = t('core.widget.plusHint');
  else if (!tv) message = t('core.widget.noTv');
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    updatedAt: input.now,
    plus: input.plus,
    tv,
    buttons,
    message,
    openLabel: t('core.widget.openApp'),
    openUrl: WIDGET_OPEN_URL,
  };
}

/** The JSON written to shared storage (read back with parseWidgetSnapshot). */
export function serializeWidgetSnapshot(s: WidgetSnapshot): string {
  return JSON.stringify(s);
}

/** True when two snapshots would draw the same widget (ignores updatedAt). */
export function sameWidgetContent(a: WidgetSnapshot | null, b: WidgetSnapshot | null): boolean {
  if (a === null || b === null) return a === b;
  return JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Reads a stored snapshot back (the contract the native widget follows). Anything malformed, from
 * another version, or with a button whose link does not match its action and TV gives null.
 */
export function parseWidgetSnapshot(raw: string | null): WidgetSnapshot | null {
  if (raw === null) return null;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(j) || j['version'] !== WIDGET_SNAPSHOT_VERSION) return null;
  if (typeof j['updatedAt'] !== 'number' || typeof j['plus'] !== 'boolean') return null;
  if (typeof j['openLabel'] !== 'string' || j['openUrl'] !== WIDGET_OPEN_URL) return null;
  if (j['message'] !== null && typeof j['message'] !== 'string') return null;
  let tv: WidgetTv | null = null;
  if (j['tv'] !== null) {
    const v = j['tv'];
    if (!isObj(v) || !isValidWidgetTvId(v['id']) || typeof v['name'] !== 'string' || typeof v['connectionLabel'] !== 'string') return null;
    const c = v['connection'];
    if (typeof c !== 'string' || !(WIDGET_CONNECTIONS as readonly string[]).includes(c)) return null;
    tv = { id: v['id'], name: v['name'], connection: c as WidgetConnection, connectionLabel: v['connectionLabel'] };
  }
  const rawButtons = j['buttons'];
  if (!Array.isArray(rawButtons) || rawButtons.length > MAX_WIDGET_ACTIONS) return null;
  if (rawButtons.length > 0 && (!tv || !j['plus'])) return null;
  const buttons: WidgetButton[] = [];
  for (const b of rawButtons) {
    if (!isObj(b) || !isWidgetAction(b['action']) || typeof b['label'] !== 'string') return null;
    const link = parseWidgetLink(b['url']);
    if (!link || !tv || link.action !== b['action'] || link.tvId !== tv.id) return null;
    buttons.push({ action: b['action'], label: b['label'], url: b['url'] as string });
  }
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    updatedAt: j['updatedAt'],
    plus: j['plus'],
    tv,
    buttons,
    message: j['message'] as string | null,
    openLabel: j['openLabel'],
    openUrl: WIDGET_OPEN_URL,
  };
}
