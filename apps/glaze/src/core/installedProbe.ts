// T229 (owner brief owner-1101f #2, "the app does it for them"): pre-select the icons for apps that
// are already on this iPhone.
//
// iOS can't list installed apps. It can answer `canOpenURL` for the URL schemes an app declares in
// Info.plist LSApplicationQueriesSchemes (Apple allows up to 50). This file holds that list, picked
// from the catalogue by popularity (AU / US, across categories), and the pure selection rules.
//
// Rules for the list:
//  - catalogue rows with a non-null urlScheme and verified === true first; T239 (owner-1101g #4:
//    "fill it to 50") then tops up with PROBE_UNVERIFIED_IDS, the best-known public schemes of the
//    most-owned apps, marked unverified (ProbeApp.verified false). A wrong scheme fails safely:
//    canOpenURL answers false and the app simply stays unticked;
//  - no System (Apple) rows: Phone, Messages, App Store and friends are on every iPhone, so asking
//    tells us nothing, and tel: / sms: answer true without being declared;
//  - at most 50 unique bare scheme names (Apple's limit), most popular first.
// native-plugins/queryschemes.json must equal schemesToQuery() (scripts/gen-query-schemes.mjs writes
// it; installedProbe.test.ts pins it).
// Nothing here leaves the phone: the answers are used only to tick those apps in Icon Studio.
// Pure TypeScript (no React Native / Expo imports) so Node runs it directly.

import { getById } from './catalogue.ts';
import { MAX_SELECTED } from './studio.ts';

/** Apple's documented ceiling for LSApplicationQueriesSchemes. */
export const MAX_QUERY_SCHEMES = 50;

/** Catalogue ids to probe, most popular first (AU / US, across categories). */
export const PROBE_APP_IDS: readonly string[] = Object.freeze([
  // The big everyday apps
  'instagram',
  'whatsapp',
  'facebook',
  'messenger',
  'snapchat',
  'spotify',
  'gmail',
  'x',
  'google-maps',
  'uber',
  'pinterest',
  'outlook',
  'telegram',
  'zoom',
  'chrome',
  'waze',
  'twitch',
  'slack',
  // Work and study
  'word',
  'excel',
  'lyft',
  'powerpoint',
  'tumblr',
  'firefox',
  'onenote',
  'skype',
  'todoist',
  'citymapper',
  // Smaller, loved by people who theme their phones
  'obsidian',
  'things',
  'drafts',
  'bear',
]);

/**
 * T239: popular apps whose catalogue scheme is the widely published one but not yet verified by us,
 * most-owned first (AU / US top charts). Probed after PROBE_APP_IDS, up to MAX_QUERY_SCHEMES.
 */
export const PROBE_UNVERIFIED_IDS: readonly string[] = Object.freeze([
  'youtube',
  'netflix',
  'tiktok',
  'reddit',
  'amazon',
  'linkedin',
  'discord',
  'paypal',
  'ebay',
  'disney-plus',
  'prime-video',
  'uber-eats',
  'doordash',
  'threads',
  'duolingo',
  'google',
  'google-drive',
  'shazam',
  'notion',
  'google-photos',
  'dropbox',
  'airbnb',
  'booking',
  'strava',
  'signal',
]);

/** T239: schemes for unverified rows whose catalogue scheme is empty (bare names). */
export const UNVERIFIED_SCHEME_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({ youtube: 'youtube' });

/** "instagram://" / "spotify:" / "instagram" -> "instagram" (lower case, no ':' or '//'). */
export function bareScheme(scheme: string): string {
  return scheme.trim().replace(/:(\/\/)?$/, '').toLowerCase();
}

export type ProbeApp = { id: string; scheme: string; verified: boolean };

/** The ordered { id, scheme } list (bare scheme names), unknown or unverified rows dropped. */
export const PROBE_APPS: readonly ProbeApp[] = Object.freeze(
  (() => {
    const seen = new Set<string>();
    const out: ProbeApp[] = [];
    for (const id of PROBE_APP_IDS) {
      const e = getById(id);
      if (!e || !e.urlScheme || e.verified !== true || e.category === 'System') continue;
      const scheme = bareScheme(e.urlScheme);
      if (!scheme || seen.has(scheme)) continue;
      seen.add(scheme);
      out.push(Object.freeze({ id, scheme, verified: true }));
      if (out.length >= MAX_QUERY_SCHEMES) break;
    }
    for (const id of PROBE_UNVERIFIED_IDS) {
      if (out.length >= MAX_QUERY_SCHEMES) break;
      const e = getById(id);
      if (!e || e.category === 'System' || out.some((a) => a.id === id)) continue;
      const raw = e.urlScheme ?? UNVERIFIED_SCHEME_OVERRIDES[id] ?? null;
      if (!raw) continue;
      const scheme = bareScheme(raw);
      if (!scheme || seen.has(scheme)) continue;
      seen.add(scheme);
      out.push(Object.freeze({ id, scheme, verified: e.verified === true }));
    }
    return out;
  })(),
);

/** Bare scheme names for Info.plist LSApplicationQueriesSchemes (unique, <= 50, list order). */
export function schemesToQuery(): string[] {
  return PROBE_APPS.map((a) => a.scheme);
}

/** The URL to ask canOpenURL about: 'instagram' -> 'instagram://'. */
export function probeUrlFor(scheme: string): string {
  return `${bareScheme(scheme)}://`;
}

/** Catalogue ids whose scheme answered true. */
export function installedIdsFrom(answers: Readonly<Record<string, boolean>>): string[] {
  return PROBE_APPS.filter((a) => answers[a.scheme] === true).map((a) => a.id);
}

/**
 * The selection after auto-select: adds each installed id that is not selected yet and was not
 * unticked by the person (so a removal sticks), in probe order, up to MAX_SELECTED. Returns the
 * same array when nothing changes.
 */
export function autoSelect(
  currentSelected: readonly string[],
  installedIds: readonly string[],
  userUnticked: ReadonlySet<string> | readonly string[],
): readonly string[] {
  const unticked = userUnticked instanceof Set ? userUnticked : new Set(userUnticked as readonly string[]);
  const have = new Set(currentSelected);
  const add: string[] = [];
  for (const id of installedIds) {
    if (have.has(id) || unticked.has(id)) continue;
    if (currentSelected.length + add.length >= MAX_SELECTED) break;
    have.add(id);
    add.push(id);
  }
  return add.length === 0 ? currentSelected : [...currentSelected, ...add];
}

// ---------------------------------------------------------------------------
// Persisted probe state (AsyncStorage 'glaze.installedProbe.v1', see src/store/installedProbe.ts)

export type ProbeState = {
  /** Apps the person removed from Icon Studio: auto-select never adds these back. */
  unticked: string[];
  /** Probed apps found on this iPhone last time and kept in the icon set (for the one-line note). */
  foundIds: string[];
};

export function defaultProbeState(): ProbeState {
  return { unticked: [], foundIds: [] };
}

const PROBE_IDS = new Set(PROBE_APPS.map((a) => a.id));

function probeIds(x: unknown): string[] {
  return Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string' && PROBE_IDS.has(v)))] : [];
}

export function parseProbeState(json: string | null | undefined): ProbeState {
  if (!json) return defaultProbeState();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return defaultProbeState();
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultProbeState();
  const r = raw as Record<string, unknown>;
  const unticked = probeIds(r.unticked);
  return { unticked, foundIds: probeIds(r.foundIds).filter((id) => !unticked.includes(id)) };
}

export function serializeProbeState(s: ProbeState): string {
  return JSON.stringify({ v: 1, unticked: s.unticked, foundIds: s.foundIds });
}

/** After a check: the installed apps that are now in the icon set (unticked ones left out). */
export function withFound(s: ProbeState, installedIds: readonly string[], selected: readonly string[]): ProbeState {
  const unticked = new Set(s.unticked);
  const sel = new Set(selected);
  return { ...s, foundIds: installedIds.filter((id) => PROBE_IDS.has(id) && !unticked.has(id) && sel.has(id)) };
}

/** The person removed `id` from their icons: remember it (only probed apps matter). */
export function markUnticked(s: ProbeState, id: string): ProbeState {
  if (!PROBE_IDS.has(id) || s.unticked.includes(id)) return s;
  return { unticked: [...s.unticked, id], foundIds: s.foundIds.filter((x) => x !== id) };
}

/** The person ticked `id` again: auto-select may add it from now on. */
export function clearUnticked(s: ProbeState, id: string): ProbeState {
  return s.unticked.includes(id) ? { ...s, unticked: s.unticked.filter((x) => x !== id) } : s;
}

// ---------------------------------------------------------------- T250: throttle + chunking

/** T250: the launch probe runs at most once per this interval (a theme apply or icon install always probes). */
export const PROBE_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** T250: canOpenURL answers asked per tick; the JS thread yields between chunks. */
export const PROBE_CHUNK = 10;
export const PROBE_LAST_RUN_KEY = 'glaze.installedProbe.lastRun.v1';

export type ProbeReason = 'launch' | 'apply' | 'install';

/**
 * T250: should the installed-apps check run now? A launch probes only when the last finished check
 * is unknown, at least PROBE_INTERVAL_MS old, or in the future (clock changed); 'apply' and
 * 'install' always probe (the deferred queue coalesces repeats).
 */
export function probeDue(lastRunAt: number | null, now: number, reason: ProbeReason): boolean {
  if (reason !== 'launch') return true;
  if (lastRunAt === null || !Number.isFinite(lastRunAt)) return true;
  if (lastRunAt > now) return true;
  return now - lastRunAt >= PROBE_INTERVAL_MS;
}

/** T250: the stored last-run time (ms), or null when missing / unreadable. */
export function parseProbeLastRun(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
