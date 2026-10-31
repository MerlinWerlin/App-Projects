// T194 (owner brief 1 Nov, item 10): clean up old Glaze icons. Apps can't delete Home Screen
// icons, so for the Shortcuts path Glaze remembers which icons it last walked the person through
// (theme + app names) and, when they start on a different theme's icons, lists the old ones to
// remove first. Pure TS (no React Native / Expo); persisted by src/store/iconCleanup.ts.

export const ICON_CLEANUP_STORE_VERSION = 1;
/** Theme id recorded for a set made in the person's own style (no theme applied). */
export const CUSTOM_THEME_ID = 'custom';

const MAX_APPS = 200;
const MAX_TEXT = 120;

export type WalkedApp = { id: string; label: string };

/** One set of Shortcuts icons Glaze walked the person through. */
export type WalkedSet = { themeId: string; themeName: string; apps: WalkedApp[] };

export type IconCleanupRecord = {
  /** The set Glaze walked through most recently. */
  last: WalkedSet | null;
  /** The set before `last`, kept while it is a different theme and not marked removed. */
  previous: WalkedSet | null;
};

export function emptyCleanupRecord(): IconCleanupRecord {
  return { last: null, previous: null };
}

/** Theme id to record ("custom" when no theme is applied). */
export function cleanupThemeId(themeId: string | null | undefined): string {
  const t = typeof themeId === 'string' ? themeId.trim() : '';
  return t ? t.slice(0, MAX_TEXT) : CUSTOM_THEME_ID;
}

function text(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t ? t.slice(0, MAX_TEXT) : null;
}

function sanitizeApps(raw: unknown): WalkedApp[] {
  if (!Array.isArray(raw)) return [];
  const out: WalkedApp[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const id = text((v as { id?: unknown }).id);
    const label = text((v as { label?: unknown }).label);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
    if (out.length >= MAX_APPS) break;
  }
  return out;
}

function sanitizeSet(raw: unknown): WalkedSet | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const themeId = text(r.themeId);
  const apps = sanitizeApps(r.apps);
  if (!themeId || apps.length === 0) return null;
  return { themeId, themeName: text(r.themeName) ?? themeId, apps };
}

export function sanitizeCleanupRecord(raw: unknown): IconCleanupRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyCleanupRecord();
  const r = raw as Record<string, unknown>;
  const last = sanitizeSet(r.last);
  let previous = sanitizeSet(r.previous);
  if (!last || (previous && previous.themeId === last.themeId)) previous = null;
  return { last, previous };
}

export function parseCleanupRecord(json: string | null | undefined): IconCleanupRecord {
  if (!json) return emptyCleanupRecord();
  try {
    const v: unknown = JSON.parse(json);
    if (v && typeof v === 'object' && (v as { v?: unknown }).v === ICON_CLEANUP_STORE_VERSION) return sanitizeCleanupRecord(v);
  } catch {
    // Corrupt: start empty.
  }
  return emptyCleanupRecord();
}

export function serializeCleanupRecord(r: IconCleanupRecord): string {
  return JSON.stringify({ v: ICON_CLEANUP_STORE_VERSION, last: r.last, previous: r.previous });
}

/**
 * Record that Glaze walked the person through `apps` of a theme (Photos save or a ticked
 * shortcut). Same theme as `last`: the apps are merged in. A different theme: `last` becomes
 * `previous` (the icons to remove). Returns the same object when nothing changed.
 */
export function recordWalk(
  r: IconCleanupRecord,
  themeId: string,
  themeName: string,
  apps: readonly WalkedApp[],
): IconCleanupRecord {
  const clean = sanitizeApps(apps);
  if (clean.length === 0) return r;
  const id = cleanupThemeId(themeId);
  const name = text(themeName) ?? id;
  if (r.last && r.last.themeId === id) {
    const have = new Set(r.last.apps.map((a) => a.id));
    const added = clean.filter((a) => !have.has(a.id));
    if (added.length === 0 && r.last.themeName === name) return r;
    const merged = [...r.last.apps, ...added].slice(0, MAX_APPS);
    return { last: { themeId: id, themeName: name, apps: merged }, previous: r.previous };
  }
  return { last: { themeId: id, themeName: name, apps: clean }, previous: r.last };
}

/** The person removed the old icons (or doesn't want the note): forget the old set. */
export function markOldRemoved(r: IconCleanupRecord, currentThemeId: string | null | undefined): IconCleanupRecord {
  const id = cleanupThemeId(currentThemeId);
  const last = r.last && r.last.themeId !== id ? null : r.last;
  if (last === r.last && r.previous === null) return r;
  return { last, previous: null };
}

export type OldIcons = {
  themeName: string;
  /** Old icons of apps that are in the new set too (the new icon replaces them). */
  replaced: WalkedApp[];
  /** Old icons of apps not in the new set. */
  leftover: WalkedApp[];
};

/**
 * Old Glaze Shortcuts icons to remove before (or while) installing `themeId`'s icons for
 * `newAppIds`: the most recent walked set from a different theme. Null when there is none.
 */
export function oldIconsToRemove(
  r: IconCleanupRecord,
  themeId: string | null | undefined,
  newAppIds: readonly string[],
): OldIcons | null {
  const id = cleanupThemeId(themeId);
  const old = r.last && r.last.themeId !== id ? r.last : r.previous && r.previous.themeId !== id ? r.previous : null;
  if (!old) return null;
  const now = new Set(newAppIds);
  return {
    themeName: old.themeName,
    replaced: old.apps.filter((a) => now.has(a.id)),
    leftover: old.apps.filter((a) => !now.has(a.id)),
  };
}

/** All old icon names, replaced first, in recorded order. */
export function oldIconNames(o: OldIcons): string[] {
  return [...o.replaced, ...o.leftover].map((a) => a.label);
}

/**
 * Names for a short note: at most `max` shown joined with `separator`, plus how many more.
 * `{ shown: "Music, Maps", more: 3 }`.
 */
export function namesList(names: readonly string[], max = 8, separator = ', '): { shown: string; more: number } {
  const n = Math.max(1, Math.trunc(Number.isFinite(max) ? max : 8));
  const list = names.map((x) => x.trim()).filter(Boolean);
  return { shown: list.slice(0, n).join(separator), more: Math.max(0, list.length - n) };
}
