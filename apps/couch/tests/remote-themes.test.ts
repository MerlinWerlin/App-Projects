/**
 * owner-1017 T56/T57: remote themes are wired everywhere, gated only in src/plus, never change
 * controls or d-pad geometry, and keep contrast over their generated textures.
 * Source-scanning checks (React Native components cannot render under Bun), plus pure helpers.
 * Node built-ins only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { en } from '../src/i18n/catalog';
import { PLUS_FEATURES, PLUS_FEATURE_COPY } from '../src/plus/entitlement';
import { DEFAULT_REMOTE_THEME, REMOTE_THEME_IDS, REMOTE_THEMES, PRESS_SCALE, effectiveRemoteTheme } from '../src/theme/remoteThemes';
import { pickTheme, previewThemeId, themeBadge } from '../src/theme/themePicker';
import { blend, contrast } from '../src/ui/fx/glow';
import { keyPressScale, themedHaptic } from '../src/ui/remote/press';
import { AURORA, texturePeak, woodgrainLines } from '../src/ui/remote/textureArt';

const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
function tsx(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    if (statSync(join(root, rel)).isDirectory()) return tsx(rel);
    return /\.tsx$/.test(n) ? [rel] : [];
  });
}
/** Code without comments, so a doc comment mentioning useTheme() does not count. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Files that draw the remote or what it opens. RemoteTexture takes its texture as a prop. */
const REMOTE_FILES = [
  ...tsx('src/ui/remote'),
  'app/(tabs)/remote.tsx',
  'src/ui/keyboard/KeyboardSheet.tsx',
  'src/ui/fx/VolumeHud.tsx',
  'src/ui/fx/StatusPill.tsx',
];
const PROP_THEMED = new Set(['src/ui/remote/RemoteTexture.tsx']);

describe('every remote surface reads the remote theme', () => {
  it('scans the remote files', () => {
    expect(tsx('src/ui/remote').length).toBeGreaterThanOrEqual(10);
  });

  for (const f of REMOTE_FILES) {
    it(`${f} uses useRemoteTheme, not useTheme`, () => {
      const src = code(read(f));
      expect({ f, useTheme: /\buseTheme\s*\(/.test(src) }).toEqual({ f, useTheme: false });
      if (!PROP_THEMED.has(f)) expect({ f, useRemoteTheme: /\buseRemoteTheme\s*\(/.test(src) }).toEqual({ f, useRemoteTheme: true });
    });
  }

  it('no hard-coded white text on the accent: accentInk instead', () => {
    for (const f of REMOTE_FILES) {
      expect({ f, white: /color:\s*['"]#fff(fff)?['"]/i.test(code(read(f))) }).toEqual({ f, white: false });
    }
  });

  it('sheets opened from the remote pass the remote palette to Sheet', () => {
    for (const f of ['src/ui/remote/NumpadSheet.tsx', 'src/ui/remote/SourceSheet.tsx', 'src/ui/keyboard/KeyboardSheet.tsx']) {
      expect({ f, palette: /<Sheet\s+palette=\{t\}/.test(read(f)) }).toEqual({ f, palette: true });
    }
    expect(read('src/ui/Sheet.tsx')).toMatch(/palette\?: Palette/);
  });

  it('the remote screen takes its stage, glow and texture from the theme', () => {
    const src = read('app/(tabs)/remote.tsx');
    expect(src).toContain('glowColor(prefs.glow, snap.demo ? null : (tv?.id ?? null), theme.glow)');
    expect(src).toContain('remoteStage(theme, glow)');
    expect(src).toContain('<RemoteTexture texture={theme.texture}');
  });
});

describe('d-pad and controls: themes change colours only', () => {
  const dpad = read('src/ui/remote/DPad.tsx');
  it('every d-pad size still comes from dpadGeometry; no theme geometry', () => {
    expect(dpad).toContain('dpadGeometry(');
    expect(code(dpad)).not.toMatch(/\bt\.radius\b/);
    expect(dpad).toContain('backgroundColor: t.ring');
    expect(dpad).toContain('borderTopColor: t.ringLit');
    expect(dpad).toContain('color: t.accentInk');
  });

  it('press scale and haptic weight follow the press style', () => {
    const key = read('src/ui/remote/RemoteKey.tsx');
    expect(key).toContain('scaleTo={keyPressScale(t.press)}');
    expect(key).toContain('themedHaptic(kind, t.press)');
    expect(key).toContain('borderRadius: t.radius');
    expect(dpad).toContain("themedHaptic('medium', t.press)");
    for (const s of ['soft', 'firm', 'click'] as const) expect(keyPressScale(s)).toBe(PRESS_SCALE[s]);
    expect(themedHaptic('light', 'firm')).toBe('light');
    expect(themedHaptic('light', 'soft')).toBe('selection');
    expect(themedHaptic('medium', 'click')).toBe('heavy');
    // Power and status cues keep their meaning in every theme.
    for (const s of ['soft', 'firm', 'click'] as const) {
      expect(themedHaptic('heavy', s)).toBe('heavy');
      expect(themedHaptic('success', s)).toBe('success');
      expect(themedHaptic('none', s)).toBe('none');
    }
  });

  it('themes never hide a control: no remote file branches on the theme id or tier', () => {
    for (const f of REMOTE_FILES) {
      expect({ f, branches: /\b(t|theme)\.(id|tier)\b/.test(code(read(f))) }).toEqual({ f, branches: false });
    }
  });
});

describe('Couch Plus gating stays in src/plus', () => {
  it('no file under src/ui/remote (or the remote tab) checks the entitlement', () => {
    for (const f of [...tsx('src/ui/remote'), 'app/(tabs)/remote.tsx', 'src/theme/useRemoteTheme.ts', 'src/theme/RemoteThemeContext.ts']) {
      const src = code(read(f));
      expect({ f, plus: /usePlus|canUse|tierCanUse|entitlement|plusStore|['"][^'"]*\/plus(\/[^'"]*)?['"]/.test(src) }).toEqual({ f, plus: false });
    }
  });

  it('src/plus/themes.tsx supplies access at the root', () => {
    const p = read('src/plus/themes.tsx');
    expect(p).toContain("tierCanUse(tier, 'themes')");
    expect(p).toContain('RemoteThemeAccessContext.Provider');
    const layout = read('app/_layout.tsx');
    expect(layout).toContain('<PlusThemeProvider>');
    expect(layout.indexOf('<PrefsProvider>')).toBeLessThan(layout.indexOf('<PlusThemeProvider>'));
  });

  it('themes is a Plus feature with copy; TV controls are not', () => {
    expect(PLUS_FEATURES).toContain('themes');
    expect(PLUS_FEATURE_COPY.themes.title.length).toBeGreaterThan(0);
    expect(PLUS_FEATURE_COPY.themes.hint.length).toBeGreaterThan(0);
    for (const f of PLUS_FEATURES) expect(f).not.toMatch(/key|button|control.?pad|dpad|volume|channel|power/i);
  });

  it('effective theme: Plus or trying shows it; without Plus a chosen Plus theme shows Midnight', () => {
    expect(effectiveRemoteTheme('neon', { plus: false }).id).toBe(DEFAULT_REMOTE_THEME);
    expect(effectiveRemoteTheme('neon', { plus: true }).id).toBe('neon');
    expect(effectiveRemoteTheme('daylight', { plus: false, trying: 'aurora' }).id).toBe('aurora');
    expect(effectiveRemoteTheme('oled', { plus: false }).id).toBe('oled');
  });
});

describe('Themes screen (app/themes.tsx)', () => {
  const src = read('app/themes.tsx');
  const catalogue = en as unknown as Record<string, unknown>;

  it('is registered and reached from Settings', () => {
    expect(read('app/_layout.tsx')).toMatch(/<Stack\.Screen name="themes"/);
    // v1 used <Link href="/themes">; the v2 row (T68) pushes the route from its onPress.
    expect(read('app/settings.tsx')).toMatch(/href="\/themes"|router\.push\('\/themes'\)/);
  });

  it('lists every theme id, with a name in the catalogue', () => {
    expect(src).toContain('REMOTE_THEME_IDS.map(');
    expect(REMOTE_THEME_IDS.length).toBe(11);
    for (const id of REMOTE_THEME_IDS) expect(typeof catalogue[REMOTE_THEMES[id].nameKey]).toBe('string');
  });

  it('never reads the entitlement itself and offers Try it / keep / stop', () => {
    expect(code(src)).not.toMatch(/usePlus|canUse|entitlement/);
    expect(src).toContain("router.navigate('/plus')");
    expect(src).toContain('tryTheme(null)');
    expect(src).toContain("t('app.themes.keep')");
    expect(src).toContain("t('app.themes.stopTrying')");
  });

  it('cross-fades with the native driver and is instant under Reduce Motion', () => {
    expect(src).toContain('useReducedMotion()');
    expect(src).toMatch(/if \(reduce\) \{\s*fade\.setValue\(1\);/);
    expect(src).toContain('useNativeDriver: true');
  });

  it('the preview d-pad uses the shared geometry', () => {
    expect(src).toContain('dpadGeometry(');
  });

  it('one-time purchase wording only, never a subscription', () => {
    const copy = Object.entries(catalogue).filter(([k]) => k.startsWith('app.themes.') || k.startsWith('core.settings.remoteTheme.'));
    expect(copy.length).toBeGreaterThanOrEqual(12);
    for (const [k, v] of copy) {
      const text = String(v);
      expect({ k, sub: /subscri/i.test(text) && !/no subscription/i.test(text) }).toEqual({ k, sub: false });
      expect({ k, periodic: /per month|monthly|per year|yearly|\/mo\b/i.test(text) }).toEqual({ k, periodic: false });
    }
    expect(String(catalogue['app.themes.keepHint'])).toMatch(/One-time purchase/);
  });

  it('pickTheme: free or with Plus applies, otherwise tries', () => {
    expect(pickTheme('daylight', { plus: false })).toEqual({ kind: 'apply', id: 'daylight' });
    expect(pickTheme('cinema', { plus: false })).toEqual({ kind: 'try', id: 'cinema' });
    expect(pickTheme('cinema', { plus: true })).toEqual({ kind: 'apply', id: 'cinema' });
    expect(previewThemeId('neon', { plus: false, trying: null })).toBe('midnight');
    expect(previewThemeId('neon', { plus: false, trying: 'forest' })).toBe('forest');
    expect(previewThemeId('oled', { plus: false, trying: null })).toBe('oled');
    expect(REMOTE_THEME_IDS.filter((id) => themeBadge(id) === 'free')).toEqual(['midnight', 'daylight', 'oled']);
  });
});

describe('RemoteTexture (generated, decoration only)', () => {
  const src = read('src/ui/remote/RemoteTexture.tsx');

  it('aurora drift pauses when idle/blurred and is still under Reduce Motion', () => {
    expect(src).toContain('useReducedMotion()');
    expect(src).toContain('useActive()');
    expect(src).toContain('idleMode({ reduce, active })');
    expect(src).toMatch(/mode === 'still'[\s\S]*drift\.setValue\(0\)/);
    expect(src).toMatch(/mode === 'paused'[\s\S]*drift\.stopAnimation\(\)/);
    expect(src).toContain('useNativeDriver: true');
    expect(src).not.toMatch(/useNativeDriver: false/);
  });

  it('never takes touches or focus, and draws no images', () => {
    expect(src).toContain('pointerEvents="none"');
    expect(src).toContain('importantForAccessibility="no-hide-descendants"');
    expect(src).not.toMatch(/\bImage\b|require\(|uri:/);
  });

  it('woodgrain is deterministic and fills the card', () => {
    const a = woodgrainLines(300, 600, ['#111111', '#222222']);
    expect(a).toEqual(woodgrainLines(300, 600, ['#111111', '#222222']));
    expect(a.length).toBeGreaterThanOrEqual(6);
    expect(woodgrainLines(0, 600, ['#111111'])).toEqual([]);
  });

  it('body text keeps AA over every theme texture at its strongest point', () => {
    for (const t of Object.values(REMOTE_THEMES)) {
      const alpha = t.texture.opacity * texturePeak(t.texture.kind);
      for (const c of t.texture.colors) {
        const bg = blend(c, t.body, alpha);
        expect({ theme: t.id, c, muted: contrast(t.muted, bg) >= 4.5 }).toEqual({ theme: t.id, c, muted: true });
        expect({ theme: t.id, c, ink: contrast(t.ink, bg) >= 4.5 }).toEqual({ theme: t.id, c, ink: true });
      }
    }
    expect(AURORA.peak).toBeLessThanOrEqual(0.6);
  });
});
