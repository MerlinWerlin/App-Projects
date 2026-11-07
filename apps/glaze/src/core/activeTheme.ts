// T184 / T185 (owner-1101 items 2 and 3): the one theme "in use" across the app. "Use this theme" on a
// theme page writes it here (plus the icon style, the widget theme and the wallpaper maker's start),
// and the Icons, Widgets and wallpaper screens re-read it on focus, so a hidden (frozen) tab never
// keeps showing the previous theme. Also the per-theme "Saved to Photos" flag of the wallpaper
// screen: it only changes the badge and the button label, never hides the Save button.
// Pure: no React Native / Expo imports (docs/CONVENTIONS.md).

export const ACTIVE_THEME_KEY = 'glaze.activeTheme.v1';
export const SAVED_WALLPAPERS_KEY = 'glaze.savedWallpapers.v1';

export type ActiveTheme = { themeId: string; at: number };

/** Same rule as the Icon Studio's theme keys (src/core/studio.ts cleanThemeKey). */
const MAX_ID = 120;

function cleanId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const t = id.trim();
  return t && t.length <= MAX_ID ? t : null;
}

export function parseActiveTheme(raw: string | null | undefined): ActiveTheme | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const o = v as { themeId?: unknown; at?: unknown };
    const themeId = cleanId(o.themeId);
    if (!themeId) return null;
    const at = typeof o.at === 'number' && Number.isFinite(o.at) && o.at >= 0 ? o.at : 0;
    return { themeId, at };
  } catch {
    return null;
  }
}

export function serializeActiveTheme(a: ActiveTheme): string {
  return JSON.stringify({ themeId: a.themeId, at: a.at });
}

/**
 * The theme in use: the stored one, else the Icon Studio's theme (people who applied a theme
 * before T184 have only that), else none.
 */
export function activeThemeId(stored: ActiveTheme | null, studioThemeId: string | null | undefined): string | null {
  return stored?.themeId ?? cleanId(studioThemeId);
}

/** "In use ✓" on a theme page: only for the theme that is in use. */
export function isThemeInUse(activeId: string | null, themeId: string): boolean {
  return activeId !== null && activeId === themeId;
}

/**
 * The Widgets tab keeps a local pick (a theme chip tapped there). Once another theme is put in use,
 * the pick is dropped so the tab shows the new theme straight away. A first load (null → id) keeps it.
 */
export function pickAfterActiveChange(prevActive: string | null, nextActive: string | null, picked: string | null): string | null {
  if (prevActive === nextActive) return picked;
  if (prevActive === null) return picked;
  return null;
}

/** Which theme a screen opened without a theme id starts from: the one in use, else its default. */
export function startThemeId(param: string | null | undefined, activeId: string | null): string | undefined {
  const p = cleanId(param);
  return p ?? activeId ?? undefined;
}

// ---------------------------------------------------------------- saved wallpapers

/** themeId -> when its wallpaper was last saved to Photos (ms). */
export type SavedWallpapers = Readonly<Record<string, number>>;

const SAVED_CAP = 200;

export function parseSavedWallpapers(raw: string | null | undefined): SavedWallpapers {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, number> = {};
    for (const [k, at] of Object.entries(v as Record<string, unknown>)) {
      const id = cleanId(k);
      if (id && typeof at === 'number' && Number.isFinite(at) && at >= 0) out[id] = at;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeSavedWallpapers(s: SavedWallpapers): string {
  return JSON.stringify(s);
}

/** Remember that `themeId`'s wallpaper was saved (newest kept when over the cap). */
export function markWallpaperSaved(s: SavedWallpapers, themeId: string, at: number): SavedWallpapers {
  const id = cleanId(themeId);
  if (!id) return s;
  const next: Record<string, number> = { ...s, [id]: at };
  const ids = Object.keys(next);
  if (ids.length <= SAVED_CAP) return next;
  const keep = ids.sort((a, b) => next[b] - next[a]).slice(0, SAVED_CAP);
  const out: Record<string, number> = {};
  for (const k of keep) out[k] = next[k];
  return out;
}

export type WallpaperSaveView = {
  /** Show "Saved to Photos ✓". */
  badge: boolean;
  /** Always true: someone who deleted it from Photos must be able to save it again. */
  showSave: true;
  label: 'saving' | 'again' | 'cta';
};

/** The wallpaper screen's save area for a theme (saved earlier or in this visit). */
export function wallpaperSaveView(saved: boolean, saving: boolean): WallpaperSaveView {
  return { badge: saved, showSave: true, label: saving ? 'saving' : saved ? 'again' : 'cta' };
}

/**
 * The theme page's views: the overview, or one of its own clean screens. T201: `widgets` is the
 * theme's widgets screen (practical pieces, then art, then the standard set in its palette).
 */
export type ThemeStep = 'overview' | 'wallpaper' | 'icons' | 'widgets';

export function themeStepOf(param: unknown): ThemeStep {
  return param === 'wallpaper' || param === 'icons' || param === 'widgets' ? param : 'overview';
}
