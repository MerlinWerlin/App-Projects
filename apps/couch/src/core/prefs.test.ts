import {
  DEFAULT_PREFS,
  GLOW_OPTIONS,
  GLOW_PREFS,
  ONE_HANDED,
  ONE_HANDED_OPTIONS,
  SETTING_COPY,
  THEME_OPTIONS,
  THEME_PREFS,
  MemoryKV,
  PREFS_KEY,
  PrefsStore,
  oneHandedAlign,
  parsePrefs,
  resolveScheme,
  sanitizePatch,
  statusBarStyle,
  type KeyValueStore,
} from './prefs';
import { REMOTE_THEME_IDS } from '../theme/remoteThemes';

describe('parsePrefs', () => {
  it('returns defaults for null, empty and invalid JSON', () => {
    expect(parsePrefs(null)).toEqual({ ...DEFAULT_PREFS });
    expect(parsePrefs('')).toEqual({ ...DEFAULT_PREFS });
    expect(parsePrefs('{not json')).toEqual({ ...DEFAULT_PREFS });
    expect(parsePrefs('[1,2]')).toEqual({ ...DEFAULT_PREFS });
    expect(parsePrefs('42')).toEqual({ ...DEFAULT_PREFS });
  });

  it('defaults match the prototype (haptics on, simple off)', () => {
    expect(DEFAULT_PREFS).toEqual({ language: 'system', haptics: true, theme: 'system', simple: false, oneHanded: 'off', glow: 'theme', remoteTheme: 'midnight' });
  });

  it('keeps valid fields and drops invalid ones', () => {
    const p = parsePrefs(JSON.stringify({ haptics: false, theme: 'neon', simple: 'yes', oneHanded: 'left', extra: 1 }));
    expect(p).toEqual({ language: 'system', haptics: false, theme: 'system', simple: false, oneHanded: 'left', glow: 'theme', remoteTheme: 'midnight' });
  });

  it('round-trips a full value', () => {
    const v = { language: 'ar', haptics: false, theme: 'dark', simple: true, oneHanded: 'right', glow: 'violet', remoteTheme: 'neon' } as const;
    expect(parsePrefs(JSON.stringify(v))).toEqual(v);
  });
});

describe('language pref (owner-1016)', () => {
  it('accepts shipped locales and system, rejects others', () => {
    expect(parsePrefs(JSON.stringify({ language: 'ja' })).language).toBe('ja');
    expect(parsePrefs(JSON.stringify({ language: 'pt-BR' })).language).toBe('pt-BR');
    expect(parsePrefs(JSON.stringify({ language: 'klingon' })).language).toBe('system');
  });
  it('store.set persists a language change', async () => {
    const kv = new MemoryKV();
    const a = new PrefsStore(kv);
    await a.set({ language: 'ar' });
    const b = new PrefsStore(kv);
    await b.load();
    expect(b.get().language).toBe('ar');
  });
});

describe('glow pref', () => {
  it("defaults to the remote theme's glow and old stored prefs without glow get the default", () => {
    expect(DEFAULT_PREFS.glow).toBe('theme');
    expect(parsePrefs(JSON.stringify({ haptics: false })).glow).toBe('theme');
  });

  it('parses every valid value and rejects others', () => {
    for (const g of GLOW_PREFS) expect(parsePrefs(JSON.stringify({ glow: g })).glow).toBe(g);
    expect(parsePrefs(JSON.stringify({ glow: 'neon' })).glow).toBe('theme');
    expect(parsePrefs(JSON.stringify({ glow: 3 })).glow).toBe('theme');
    expect(parsePrefs(JSON.stringify({ glow: 'amber' })).glow).toBe('amber');
    expect(sanitizePatch({ glow: 'pink' as never })).toEqual({});
    expect(sanitizePatch({ glow: 'off' })).toEqual({ glow: 'off' });
  });

  it('set persists a glow change and skips a no-op', async () => {
    const kv = new MemoryKV();
    const s = new PrefsStore(kv);
    await s.set({ glow: 'tv' });
    const after = s.getSnapshot();
    expect(after.prefs.glow).toBe('tv');
    expect(parsePrefs(await kv.getItem(PREFS_KEY)).glow).toBe('tv');
    await s.set({ glow: 'tv' });
    expect(s.getSnapshot()).toBe(after);
    await s.set({ glow: 'off' });
    expect(s.getSnapshot()).not.toBe(after);
    expect(s.get().glow).toBe('off');
  });

  it('copy and options', () => {
    expect(SETTING_COPY.glow).toEqual({ title: 'Glow', hint: 'Soft light behind the remote, like a TV backlight' });
    expect(GLOW_OPTIONS.map((o) => o.value)).toEqual([...GLOW_PREFS]);
    expect(GLOW_OPTIONS.map((o) => o.label)).toEqual(['Remote theme', 'Warm amber', 'Cool blue', 'Violet', 'Match TV', 'Off']);
    for (const o of GLOW_OPTIONS) expect(o.short.length).toBeLessThanOrEqual(8);
  });
});

describe('remote theme pref (owner-1017 T56)', () => {
  it('defaults to Midnight; old stored prefs without it get the default', () => {
    expect(DEFAULT_PREFS.remoteTheme).toBe('midnight');
    expect(parsePrefs(JSON.stringify({ haptics: false })).remoteTheme).toBe('midnight');
  });

  it('parses every theme id and rejects others', () => {
    for (const id of REMOTE_THEME_IDS) expect(parsePrefs(JSON.stringify({ remoteTheme: id })).remoteTheme).toBe(id);
    expect(parsePrefs(JSON.stringify({ remoteTheme: 'vaporwave' })).remoteTheme).toBe('midnight');
    expect(parsePrefs(JSON.stringify({ remoteTheme: 7 })).remoteTheme).toBe('midnight');
    expect(sanitizePatch({ remoteTheme: 'pink' as never })).toEqual({});
    expect(sanitizePatch({ remoteTheme: 'aurora' })).toEqual({ remoteTheme: 'aurora' });
  });

  it('round-trips through the store (remembered per device) and skips a no-op', async () => {
    const kv = new MemoryKV();
    const a = new PrefsStore(kv);
    await a.set({ remoteTheme: 'retro' });
    const snap = a.getSnapshot();
    await a.set({ remoteTheme: 'retro' });
    expect(a.getSnapshot()).toBe(snap);
    const b = new PrefsStore(kv);
    await b.load();
    expect(b.get().remoteTheme).toBe('retro');
    expect(parsePrefs(await kv.getItem(PREFS_KEY)).remoteTheme).toBe('retro');
  });

  it('has Settings copy', () => {
    expect(SETTING_COPY.remoteTheme.title).toBe('Remote theme');
    expect(SETTING_COPY.remoteTheme.hint.length).toBeGreaterThan(0);
  });
});

describe('helpers', () => {
  it('sanitizePatch drops invalid values', () => {
    expect(sanitizePatch({ theme: 'x' as never, simple: true })).toEqual({ simple: true });
  });

  it('resolveScheme follows the system only for "system"', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('statusBarStyle uses light text on dark backgrounds', () => {
    expect(statusBarStyle('dark')).toBe('light');
    expect(statusBarStyle('light')).toBe('dark');
  });

  it('oneHandedAlign maps modes to flex alignment', () => {
    expect(oneHandedAlign('off')).toBe('stretch');
    expect(oneHandedAlign('left')).toBe('flex-start');
    expect(oneHandedAlign('right')).toBe('flex-end');
  });
});

describe('PrefsStore', () => {
  it('starts with defaults, not loaded, and a stable snapshot', () => {
    const s = new PrefsStore(new MemoryKV());
    const a = s.getSnapshot();
    expect(a.prefs).toEqual({ ...DEFAULT_PREFS });
    expect(a.loaded).toBe(false);
    expect(s.getSnapshot()).toBe(a);
  });

  it('loads stored prefs and notifies subscribers', async () => {
    const kv = new MemoryKV();
    await kv.setItem(PREFS_KEY, JSON.stringify({ simple: true, theme: 'dark' }));
    const s = new PrefsStore(kv);
    let n = 0;
    s.subscribe(() => n++);
    await s.load();
    expect(n).toBe(1);
    expect(s.getSnapshot().loaded).toBe(true);
    expect(s.get().simple).toBe(true);
    expect(s.get().theme).toBe('dark');
    expect(s.get().haptics).toBe(true);
  });

  it('set updates the snapshot, persists, and skips no-op changes', async () => {
    const kv = new MemoryKV();
    const s = new PrefsStore(kv);
    const before = s.getSnapshot();
    await s.set({ haptics: false });
    const after = s.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.prefs.haptics).toBe(false);
    expect(parsePrefs(await kv.getItem(PREFS_KEY)).haptics).toBe(false);
    await s.set({ haptics: false });
    expect(s.getSnapshot()).toBe(after);
    await s.set({ theme: 'bogus' as never });
    expect(s.getSnapshot()).toBe(after);
  });

  it('a later persisted store reads what an earlier one wrote', async () => {
    const kv = new MemoryKV();
    const a = new PrefsStore(kv);
    await a.set({ simple: true, oneHanded: 'left' });
    const b = new PrefsStore(kv);
    await b.load();
    expect(b.get()).toEqual({ language: 'system', haptics: true, theme: 'system', simple: true, oneHanded: 'left', glow: 'theme', remoteTheme: 'midnight' });
  });

  it('survives storage errors', async () => {
    const broken: KeyValueStore = {
      getItem: () => Promise.reject(new Error('boom')),
      setItem: () => Promise.reject(new Error('boom')),
    };
    const s = new PrefsStore(broken);
    await expect(s.load()).resolves.toEqual({ ...DEFAULT_PREFS });
    await expect(s.set({ simple: true })).resolves.toBeUndefined();
    expect(s.get().simple).toBe(true);
  });

  it('a change made before load finishes is not overwritten by the load', async () => {
    let release: (v: string | null) => void = () => {};
    const kv: KeyValueStore = {
      getItem: () => new Promise((r) => (release = r)),
      setItem: async () => {},
    };
    const s = new PrefsStore(kv);
    const loading = s.load();
    await s.set({ simple: true });
    release(JSON.stringify({ simple: false, theme: 'dark' }));
    await loading;
    expect(s.get().simple).toBe(true);
    expect(s.getSnapshot().loaded).toBe(true);
  });

  it('unsubscribe stops notifications', async () => {
    const s = new PrefsStore();
    let n = 0;
    const off = s.subscribe(() => n++);
    off();
    await s.set({ simple: true });
    expect(n).toBe(0);
  });
});

describe('settings copy', () => {
  it('uses the prototype wording for simple mode and haptics', () => {
    expect(SETTING_COPY.simple).toEqual({ title: 'Simple mode', hint: 'Big power, volume, channel and home buttons only' });
    expect(SETTING_COPY.haptics).toEqual({ title: 'Haptics', hint: 'A small tap on every key press' });
  });

  it('options cover every valid value', () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual([...THEME_PREFS]);
    expect(ONE_HANDED_OPTIONS.map((o) => o.value)).toEqual([...ONE_HANDED]);
  });
});
