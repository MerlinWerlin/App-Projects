/**
 * User preferences (Settings screen): haptics, theme, simple mode, one-handed layout, cinema glow,
 * remote theme (owner-1017).
 * Pure TS so it is unit-tested in Node; src/state/prefs.tsx only subscribes to it.
 * Storage is an injected async key-value store (AsyncStorage-shaped). Stored JSON is
 * validated field by field, so a corrupt or old value never crashes the app: unknown
 * or invalid fields fall back to defaults. Every pref is free.
 */
import { withCopy } from '../i18n/lazyCopy';
import { DEFAULT_REMOTE_THEME, isRemoteThemeId, type RemoteThemeId } from '../theme/remoteThemes';

export type ThemePref = 'system' | 'light' | 'dark';
export type OneHanded = 'off' | 'left' | 'right';
/**
 * Cinema glow behind the remote: 'theme' (the remote theme's own glow colour, none for themes without
 * one; the default since owner-1017), a colour, 'tv' (per-saved-TV colour), or 'off' (plain screen).
 */
export type GlowPref = 'theme' | 'amber' | 'blue' | 'violet' | 'tv' | 'off';

/** App language: 'system' follows the phone; otherwise a shipped locale code (src/i18n/locales.ts). */
export type LanguagePref = 'system' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-Hans' | 'hi' | 'ar';

export interface Prefs {
  language: LanguagePref;
  haptics: boolean;
  theme: ThemePref;
  simple: boolean;
  oneHanded: OneHanded;
  glow: GlowPref;
  /** Remote theme (owner-1017). A Plus theme without Plus shows Midnight (effectiveRemoteTheme). */
  remoteTheme: RemoteThemeId;
}

export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({
  language: 'system',
  haptics: true,
  theme: 'system',
  simple: false,
  oneHanded: 'off',
  glow: 'theme',
  remoteTheme: DEFAULT_REMOTE_THEME,
});

export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];
export const ONE_HANDED: readonly OneHanded[] = ['off', 'left', 'right'];
export const GLOW_PREFS: readonly GlowPref[] = ['theme', 'amber', 'blue', 'violet', 'tv', 'off'];

export const LANGUAGE_PREFS: readonly LanguagePref[] = ['system', 'en', 'es', 'fr', 'de', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];

export const PREFS_KEY = 'couch.prefs.v1';

/** AsyncStorage-shaped store. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** In-memory store (used until a persistent store is installed, and in tests). */
export class MemoryKV implements KeyValueStore {
  private m = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.m.has(key) ? (this.m.get(key) ?? null) : null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.m.set(key, value);
  }
}

function isLanguagePref(v: unknown): v is LanguagePref {
  return typeof v === 'string' && (LANGUAGE_PREFS as readonly string[]).includes(v);
}
function isThemePref(v: unknown): v is ThemePref {
  return typeof v === 'string' && (THEME_PREFS as readonly string[]).includes(v);
}
function isOneHanded(v: unknown): v is OneHanded {
  return typeof v === 'string' && (ONE_HANDED as readonly string[]).includes(v);
}
function isGlowPref(v: unknown): v is GlowPref {
  return typeof v === 'string' && (GLOW_PREFS as readonly string[]).includes(v);
}

/** Parse stored JSON into Prefs; invalid fields (or invalid JSON) become defaults. */
export function parsePrefs(raw: string | null | undefined): Prefs {
  const out: Prefs = { ...DEFAULT_PREFS };
  if (!raw) return out;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return out;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  const o = v as Record<string, unknown>;
  if (isLanguagePref(o.language)) out.language = o.language;
  if (typeof o.haptics === 'boolean') out.haptics = o.haptics;
  if (isThemePref(o.theme)) out.theme = o.theme;
  if (typeof o.simple === 'boolean') out.simple = o.simple;
  if (isOneHanded(o.oneHanded)) out.oneHanded = o.oneHanded;
  if (isGlowPref(o.glow)) out.glow = o.glow;
  if (isRemoteThemeId(o.remoteTheme)) out.remoteTheme = o.remoteTheme;
  return out;
}

/** Keep only valid fields of a patch. */
export function sanitizePatch(patch: Partial<Prefs>): Partial<Prefs> {
  const out: Partial<Prefs> = {};
  if (isLanguagePref(patch.language)) out.language = patch.language;
  if (typeof patch.haptics === 'boolean') out.haptics = patch.haptics;
  if (isThemePref(patch.theme)) out.theme = patch.theme;
  if (typeof patch.simple === 'boolean') out.simple = patch.simple;
  if (isOneHanded(patch.oneHanded)) out.oneHanded = patch.oneHanded;
  if (isGlowPref(patch.glow)) out.glow = patch.glow;
  if (isRemoteThemeId(patch.remoteTheme)) out.remoteTheme = patch.remoteTheme;
  return out;
}

/** Resolve the theme pref against the OS scheme (any ColorSchemeName string). */
export function resolveScheme(theme: ThemePref, system: string | null | undefined): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

/** expo-status-bar style for a resolved scheme: dark text on light backgrounds. */
export function statusBarStyle(scheme: 'light' | 'dark'): 'light' | 'dark' {
  return scheme === 'dark' ? 'light' : 'dark';
}

/** Flex alignment for the remote column in one-handed mode. */
export function oneHandedAlign(mode: OneHanded): 'stretch' | 'flex-start' | 'flex-end' {
  return mode === 'left' ? 'flex-start' : mode === 'right' ? 'flex-end' : 'stretch';
}

export interface PrefsSnapshot {
  prefs: Prefs;
  /** True once stored prefs were read (or reading failed). */
  loaded: boolean;
  rev: number;
}

export class PrefsStore {
  private prefs: Prefs = { ...DEFAULT_PREFS };
  private loaded = false;
  private rev = 0;
  private subs = new Set<() => void>();
  private snap: PrefsSnapshot;
  /** Set once the user changes something, so a slow load cannot clobber it. */
  private dirty = false;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly kv: KeyValueStore = new MemoryKV(),
    private readonly key: string = PREFS_KEY,
  ) {
    this.snap = this.makeSnap();
  }

  private makeSnap(): PrefsSnapshot {
    return { prefs: this.prefs, loaded: this.loaded, rev: this.rev };
  }

  private changed(): void {
    this.rev += 1;
    this.snap = this.makeSnap();
    for (const s of this.subs) s();
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  /** Stable between changes (safe for React useSyncExternalStore). */
  getSnapshot(): PrefsSnapshot {
    return this.snap;
  }

  get(): Prefs {
    return this.prefs;
  }

  /** Read stored prefs. Never throws; storage errors keep defaults. */
  async load(): Promise<Prefs> {
    let raw: string | null = null;
    try {
      raw = await this.kv.getItem(this.key);
    } catch {
      raw = null;
    }
    if (!this.dirty) this.prefs = parsePrefs(raw);
    this.loaded = true;
    this.changed();
    return this.prefs;
  }

  /** Apply a patch (invalid fields ignored) and persist. Resolves when written; never throws. */
  set(patch: Partial<Prefs>): Promise<void> {
    const clean = sanitizePatch(patch);
    const next: Prefs = { ...this.prefs, ...clean };
    if (
      next.language === this.prefs.language &&
      next.haptics === this.prefs.haptics &&
      next.theme === this.prefs.theme &&
      next.simple === this.prefs.simple &&
      next.oneHanded === this.prefs.oneHanded &&
      next.glow === this.prefs.glow &&
      next.remoteTheme === this.prefs.remoteTheme
    ) {
      return this.writing;
    }
    this.dirty = true;
    this.prefs = next;
    this.changed();
    const json = JSON.stringify(next);
    // Serialise writes so the last change always wins on disk.
    this.writing = this.writing.then(() => this.kv.setItem(this.key, json)).catch(() => {});
    return this.writing;
  }
}

/* ---------- Settings screen copy (prototype viewTvs() Settings panel) ---------- */

export interface SettingCopy {
  title: string;
  hint: string;
}

/** Text fields translate on read (t() getters), so a language switch applies on the next render. */
export const SETTING_COPY: Readonly<Record<keyof Prefs, SettingCopy>> = {
  language: withCopy({ title: '', hint: '' }, { title: 'core.settings.language.title', hint: 'core.settings.language.hint' }),
  simple: withCopy({ title: '', hint: '' }, { title: 'core.settings.simple.title', hint: 'core.settings.simple.hint' }),
  haptics: withCopy({ title: '', hint: '' }, { title: 'core.settings.haptics.title', hint: 'core.settings.haptics.hint' }),
  theme: withCopy({ title: '', hint: '' }, { title: 'core.settings.theme.title', hint: 'core.settings.theme.hint' }),
  oneHanded: withCopy({ title: '', hint: '' }, { title: 'core.settings.oneHanded.title', hint: 'core.settings.oneHanded.hint' }),
  glow: withCopy({ title: '', hint: '' }, { title: 'core.settings.glow.title', hint: 'core.settings.glow.hint' }),
  remoteTheme: withCopy({ title: '', hint: '' }, { title: 'core.settings.remoteTheme.title', hint: 'core.settings.remoteTheme.hint' }),
};

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemePref; label: string }> = [
  withCopy({ value: 'system' as ThemePref, label: '' }, { label: 'core.settings.theme.system' }),
  withCopy({ value: 'light' as ThemePref, label: '' }, { label: 'core.settings.theme.light' }),
  withCopy({ value: 'dark' as ThemePref, label: '' }, { label: 'core.settings.theme.dark' }),
];

export const ONE_HANDED_OPTIONS: ReadonlyArray<{ value: OneHanded; label: string }> = [
  withCopy({ value: 'off' as OneHanded, label: '' }, { label: 'core.settings.oneHanded.off' }),
  withCopy({ value: 'left' as OneHanded, label: '' }, { label: 'core.settings.oneHanded.left' }),
  withCopy({ value: 'right' as OneHanded, label: '' }, { label: 'core.settings.oneHanded.right' }),
];

/** `label` is the full name (spoken by screen readers); `short` fits the five-way segmented control. */
export const GLOW_OPTIONS: ReadonlyArray<{ value: GlowPref; label: string; short: string }> = [
  withCopy({ value: 'theme' as GlowPref, label: '', short: '' }, { label: 'core.settings.glow.theme', short: 'core.settings.glow.themeShort' }),
  withCopy({ value: 'amber' as GlowPref, label: '', short: '' }, { label: 'core.settings.glow.amber', short: 'core.settings.glow.amberShort' }),
  withCopy({ value: 'blue' as GlowPref, label: '', short: '' }, { label: 'core.settings.glow.blue', short: 'core.settings.glow.blueShort' }),
  withCopy({ value: 'violet' as GlowPref, label: '', short: '' }, { label: 'core.settings.glow.violet', short: 'core.settings.glow.violetShort' }),
  withCopy({ value: 'tv' as GlowPref, label: '', short: '' }, { label: 'core.settings.glow.tv', short: 'core.settings.glow.tvShort' }),
  withCopy({ value: 'off' as GlowPref, label: '', short: '' }, { label: 'core.settings.glow.off', short: 'core.settings.glow.offShort' }),
];
