// T146 (fb-1025 A): the widget link check. The owner's TestFlight widgets kept drawing the built-in
// fallback theme, and nothing on the phone could tell whether the app and the widget extension
// share the App Group. Now:
// - the extension (targets/widget/ThemeStore.swift) writes what it last rendered to App Group key
//   WIDGET_LAST_READ_KEY: JSON {at, themeId, source: "defaults" | "file" | "fallback"};
// - the bridge (modules/glaze-widget-bridge, `linkStatus`) reports containerOk / themeStored /
//   lastRead (+ the stored theme JSON);
// - widgetLinkVerdict turns that into one plain answer for the Widgets tab.
// Pure: no React Native imports, runs under node --test.
import { parseWidgetTheme } from './widgetTheme.ts';

/** App Group UserDefaults key the widget extension writes on every theme load. */
export const WIDGET_LAST_READ_KEY = 'glaze.widget.lastRead.v1';

export type WidgetReadSource = 'defaults' | 'file' | 'fallback';

/** What the extension last rendered (WIDGET_LAST_READ_KEY, parsed). */
export type WidgetLastRead = { at: string; themeId: string; source: WidgetReadSource };

/** The bridge's answer, normalised (src/native/widgets.ts linkStatus). */
export type WidgetLinkStatus = {
  /** False in Expo Go, on Android and when the native module is missing: nothing to check. */
  available: boolean;
  /** False when the build's bridge predates T146 (no `linkStatus`): the link is unknown. */
  supported: boolean;
  /** containerURL(forSecurityApplicationGroupIdentifier:) answered: the app has the App Group. */
  containerOk: boolean;
  /** The app's App Group UserDefaults holds glaze.theme.v1. */
  themeStored: boolean;
  /** Raw WIDGET_LAST_READ_KEY JSON ("" when the extension never wrote it where the app can see). */
  lastRead: string;
  /** Raw glaze.theme.v1 JSON as stored ("" when missing or not reported). */
  storedTheme: string;
};

export type WidgetLinkVerdict =
  /** No native link to check (Expo Go, Android, module missing): the Widgets tab shows nothing. */
  | 'expoGo'
  /** Native build whose bridge has no linkStatus: also shows nothing. */
  | 'unknown'
  /** The app has no App Group container, or the extension rendered its fallback after the app stored a theme. */
  | 'noAppGroup'
  /** The extension has never written a read the app can see (no widget on the Home Screen yet, or no App Group on the extension). */
  | 'notReadYet'
  /** The widgets last rendered before the latest theme was applied. */
  | 'stale'
  /** The widgets rendered the latest data. */
  | 'ok'
  /** The widgets rendered a different theme from the one the app applied. */
  | 'wrongTheme';

/** Status for every place with nothing to check (Expo Go, Android, missing module). */
export const NO_WIDGET_LINK: WidgetLinkStatus = Object.freeze({
  available: false,
  supported: false,
  containerOk: false,
  themeStored: false,
  lastRead: '',
  storedTheme: '',
});

/** How far a widget read may sit before the apply and still count (clock rounding between processes). */
export const WIDGET_LINK_TOLERANCE_MS = 2_000;

/** Seconds after a theme pick before the Widgets tab checks again (widgets reload in the meantime). */
export const WIDGET_LINK_RECHECK_MS = 3_000;

const SOURCES: readonly WidgetReadSource[] = ['defaults', 'file', 'fallback'];

function time(iso: unknown): number | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Parse the extension's WIDGET_LAST_READ_KEY JSON; null for anything unusable. */
export function parseWidgetLastRead(raw: unknown): WidgetLastRead | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.trim().length === 0) return null;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  if (time(o.at) === null) return null;
  const themeId = typeof o.themeId === 'string' ? o.themeId.trim() : '';
  if (themeId.length === 0) return null;
  const source = SOURCES.find((s) => s === o.source);
  if (!source) return null;
  return { at: o.at as string, themeId, source };
}

/** Normalise whatever the native `linkStatus` returned (never throws; unknown fields are dropped). */
export function normaliseWidgetLinkStatus(raw: unknown): WidgetLinkStatus {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...NO_WIDGET_LINK, available: true, supported: true };
  const o = raw as Record<string, unknown>;
  return {
    available: true,
    supported: true,
    containerOk: o.containerOk === true,
    themeStored: o.themeStored === true,
    lastRead: typeof o.lastRead === 'string' ? o.lastRead : '',
    storedTheme: typeof o.storedTheme === 'string' ? o.storedTheme : '',
  };
}

/**
 * One plain answer for the Widgets tab.
 * - expectedThemeId: the theme the app last applied to the widgets; null = the stored theme's id.
 * - now: the device clock; an apply time later than now is ignored (clock moved back).
 *
 * Rules, in order: nothing to check -> expoGo / unknown; app has no App Group container ->
 * noAppGroup; no read visible -> notReadYet; widgets drew the fallback after the app stored a
 * theme -> noAppGroup (they can't see the app's data); last read before the latest apply ->
 * stale; read theme differs from the expected one -> wrongTheme; else ok.
 */
export function widgetLinkVerdict(status: WidgetLinkStatus, expectedThemeId: string | null, now: Date): WidgetLinkVerdict {
  if (!status.available) return 'expoGo';
  if (!status.supported) return 'unknown';
  if (!status.containerOk) return 'noAppGroup';
  const read = parseWidgetLastRead(status.lastRead);
  if (!read) return 'notReadYet';

  const stored = status.storedTheme ? parseWidgetTheme(status.storedTheme) : null;
  const nowMs = now.getTime();
  const appliedRaw = stored ? time(stored.updatedAt) : null;
  // The fallback's 1970 updatedAt and a future apply time (clock moved back) carry no information.
  const appliedMs = appliedRaw !== null && appliedRaw > 0 && appliedRaw <= nowMs + WIDGET_LINK_TOLERANCE_MS ? appliedRaw : null;
  const readMs = time(read.at) ?? 0;
  const readBeforeApply = appliedMs !== null && readMs < appliedMs - WIDGET_LINK_TOLERANCE_MS;

  if (read.source === 'fallback') {
    if (!status.themeStored) return expectedThemeId === null ? 'ok' : 'wrongTheme';
    return readBeforeApply ? 'stale' : 'noAppGroup';
  }
  if (readBeforeApply) return 'stale';
  const expected = expectedThemeId ?? stored?.themeId ?? null;
  if (expected !== null && read.themeId !== expected) return 'wrongTheme';
  return 'ok';
}

/** Verdicts the Widgets tab draws a line for (the rest show nothing). */
export function widgetLinkVisible(v: WidgetLinkVerdict | null): v is Exclude<WidgetLinkVerdict, 'expoGo' | 'unknown'> {
  return v !== null && v !== 'expoGo' && v !== 'unknown';
}
