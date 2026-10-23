/**
 * T68 (market-1018 M3b): screens migrated to the design v2 primitives (docs/DESIGN_V2.md) stay on
 * them: large-title scaffold, inset-grouped rows, no v1 tokens or v1 Screen column, and every
 * accessibility label the v1 screen had is still wired.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('Settings on design v2 (T68 step 1)', () => {
  const src = read('app/settings.tsx');

  it('uses the v2 scaffold and hides the native header', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain("from '../src/ui/v2'");
    expect(src).toMatch(/<Stack\.Screen options=\{\{ headerShown: false \}\} \/>/);
    expect(src).not.toMatch(/from '\.\.\/src\/theme\/tokens'|from '\.\.\/src\/ui\/Screen'/);
  });

  it('keeps every setting, all free, with the Remote / General / Help groups', () => {
    for (const key of ['remoteTheme', 'glow', 'haptics', 'simple', 'oneHanded', 'language', 'theme']) expect(src).toContain(`SETTING_COPY.${key}`);
    for (const key of ['groupRemote', 'groupGeneral', 'groupHelp']) expect(src).toContain(`t('app.settings.${key}')`);
    expect(src).toContain("router.push('/themes')");
    expect(src).toContain("router.push('/diagnostics')");
    expect(src).toContain("router.push('/plus')");
    expect(src).toContain("footer={t('ui.screen.freePromise')}");
    expect(src).not.toMatch(/usePlus|isPlus|src\/plus/);
  });

  it('keeps the v1 accessibility labels', () => {
    expect(src).toContain("t('app.settings.remoteThemeLabel'");
    expect(src).toContain("t('app.settings.optionLabel'");
    expect(src).toContain("accessibilityHint={t('app.settings.diagnosticsHint')}");
    expect(src).toContain("accessibilityHint={t('app.settings.plusHint')}");
  });
});

describe('TVs on design v2 (T68 step 2)', () => {
  const src = read('app/(tabs)/tvs.tsx');

  it('uses the v2 scaffold, inset-grouped TVs and a card empty state', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain('<Card');
    expect(src).toContain("from '../../src/ui/v2'");
    expect(src).not.toMatch(/from '\.\.\/\.\.\/src\/theme\/tokens'|<Screen\b/);
    expect(src).toMatch(/accessory=\{inUse \? \{ type: 'check', checked: true \} : \{ type: 'chevron' \}\}/);
  });

  it('keeps the v1 behaviour and accessibility labels', () => {
    for (const key of ['tvLabel', 'tvLabelInUse', 'tvLabelRoom', 'tvLabelRoomInUse', 'wakeLabel', 'addTv', 'demoMode', 'settings', 'nowControlling']) {
      expect(src).toContain(`'app.tvs.${key}'`);
    }
    expect(src).toContain('session.select(tv.id)');
    expect(src).toContain("router.navigate('/remote')");
    expect(src).toContain("router.push('/add-tv')");
    expect(src).toContain("router.push('/settings')");
    expect(src).toContain('setDemoMode(session, on)');
    expect(src).toContain('accessibilityLiveRegion="polite"');
    expect(src).toContain('canWake(tv, udp !== null)');
  });
});

describe('Diagnostics on design v2 (T68 step 3)', () => {
  const src = read('app/diagnostics.tsx');

  it('uses the v2 scaffold with one inset group per TV and v2 pills', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain("from '../src/ui/v2'");
    expect(src).toMatch(/<Stack\.Screen options=\{\{ headerShown: false \}\} \/>/);
    expect(src).not.toMatch(/from '\.\.\/src\/theme\/tokens'|<Screen\b|<Pressable\b/);
    expect(src).toContain('variant="tinted"');
    expect(src).toContain("textStyle('numeric')");
  });

  it('keeps reconnect, share and the v1 accessibility labels', () => {
    expect(src).toContain("accessibilityLabel={t('app.diagnostics.reconnect')}");
    expect(src).toContain("accessibilityHint={t('app.diagnostics.shareHint')}");
    expect(src).toContain("t('app.diagnostics.latencyLabel'");
    expect(src).toContain('reconnector.reconnectNow()');
    expect(src).toContain('diagnostics.formatReport(');
    expect(src).toContain('accessibilityLiveRegion="polite"');
    expect(src).toContain("disabled={connecting}");
  });
});

describe('Plus on design v2 (T68 step 4)', () => {
  const src = read('app/plus.tsx');

  it('uses the v2 scaffold: benefit card, large filled stretch pill, plain restore, tip jar rows', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain('<Card');
    expect(src).toContain("from '../src/ui/v2'");
    expect(src).toMatch(/<Stack\.Screen options=\{\{ headerShown: false \}\} \/>/);
    expect(src).not.toMatch(/from '\.\.\/src\/theme\/tokens'|<Screen\b|<Pressable\b/);
    expect(src).toMatch(/size="large"\s+stretch/);
    expect(src).toContain('variant="plain"');
    expect(src).toContain('<FreePromise');
  });

  it('keeps one-time purchase, restore, tips and the v1 accessibility labels', () => {
    expect(src).toContain('applyPurchase(plusStore(), purchaseProvider(), action)');
    expect(src).toContain("buy('buy')");
    expect(src).toContain("buy('restore')");
    expect(src).toContain('.tip(id)');
    expect(src).toContain('PLUS_FEATURES.map(');
    expect(src).toContain('TIP_TIERS.map(');
    expect(src).toContain("t('app.plus.featureLabel'");
    expect(src).toContain("accessibilityHint={t('app.plus.buyHint')}");
    expect(src).toContain("accessibilityLabel={t('app.plus.restore')}");
    expect(src).toContain('accessibilityHint={tt.note}');
    expect(src).toContain('accessibilityLiveRegion="polite"');
    expect(src).not.toMatch(/subscri|per month|monthly/i);
  });
});

describe('Themes on design v2 (T68 step 5)', () => {
  const src = read('app/themes.tsx');

  it('uses the v2 scaffold: preview in a mid Card, themes as check rows with a swatch tile', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain('<Card elevation="mid"');
    expect(src).toContain("from '../src/ui/v2'");
    expect(src).toMatch(/<Stack\.Screen options=\{\{ headerShown: false \}\} \/>/);
    expect(src).not.toMatch(/<Screen\b|<Pressable\b|from '\.\.\/src\/theme\/useTheme'/);
    expect(src).toContain("accessory={{ type: 'check', checked: on }}");
    expect(src).toContain('icon={<Swatch theme={th} />}');
    expect(src).toContain('variant="tinted"');
  });

  it('keeps live preview, instant apply, Try it, Reduce Motion and the v1 accessibility labels', () => {
    expect(src).toContain('<MiniRemote theme={shown} />');
    expect(src).toContain('previewThemeId(prefs.remoteTheme, { plus, trying })');
    expect(src).toContain('pickTheme(id, { plus })');
    expect(src).toContain('set({ remoteTheme: pick.id })');
    expect(src).toContain('tryTheme(pick.id)');
    expect(src).toContain('themeBadge(id)');
    expect(src).toContain("t('app.themes.tileLabel', { name, tier })");
    expect(src).toContain("accessibilityHint={locked ? t('app.themes.tryHint') : undefined}");
    expect(src).toContain("accessibilityLabel={t('app.themes.preview', { name: shownName })}");
    expect(src).toContain("accessibilityHint={t('app.themes.keepHint')}");
    expect(src).toContain('accessibilityLiveRegion="polite"');
    expect(src).toContain('<FreePromise');
  });
});

describe('Add TV on design v2 (T68 step 6)', () => {
  const src = read('app/add-tv.tsx');

  it('uses the v2 scaffold, inset-grouped found TVs, a notice card and v2 pills', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain('<Card');
    expect(src).toContain("from '../src/ui/v2'");
    expect(src).toMatch(/<Stack\.Screen options=\{\{ presentation: 'modal', headerShown: false \}\} \/>/);
    expect(src).not.toMatch(/from '\.\.\/src\/theme\/tokens'|<Screen\b|<Pressable\b|function Btn\b/);
    expect(src).toContain("label={t('app.addTv.cancel')}");
  });

  it('keeps scan first, pairing steps, the lost-remote sheet and the v1 accessibility labels', () => {
    for (const key of ['candidateLabel', 'candidateLabelBeta', 'irRowLabel', 'notListed', 'ipLabel', 'psk', 'pairingCode', 'pin', 'room', 'lostRemote']) {
      expect(src).toContain(`'app.addTv.${key}'`);
    }
    expect(src).toContain("dispatch({ type: 'pick', host: c.host })");
    expect(src).toContain("dispatch({ type: 'paired' })");
    expect(src).toContain('<Sheet visible={visible} scroll={false}');
    expect(src).toContain('<ScrollView');
    expect(src).toContain("router.push('/add-tv-ir')");
    expect(src).toContain('accessibilityLiveRegion="polite"');
  });
});

describe('Add TV infrared on design v2 (T68 step 6)', () => {
  const src = read('app/add-tv-ir.tsx');

  it('uses the v2 scaffold, inset-grouped brands, a code card and v2 pills', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<InsetGroupedList');
    expect(src).toContain('<Card');
    expect(src).toContain("from '../src/ui/v2'");
    expect(src).toMatch(/<Stack\.Screen options=\{\{ presentation: 'modal', headerShown: false \}\} \/>/);
    expect(src).not.toMatch(/from '\.\.\/src\/theme\/tokens'|<Screen\b|<Pressable\b|function Btn\b/);
    // The send-test button draws the volume icon, never a "+" text glyph.
    expect(src).toContain('<RemoteIcon name="volUp"');
  });

  it('keeps the code-test flow and the v1 accessibility labels', () => {
    expect(src).toContain('IR_BRAND_CHOICES.map(');
    expect(src).toContain('accessibilityLabel={b}');
    expect(src).toContain("accessibilityLabel={t('app.addTvIr.sendVolumeUp')}");
    expect(src).toContain('disabled={s.sending}');
    for (const call of ['setup.pickBrand(b)', 'setup.sendTest()', 'setup.no()', 'setup.yes()', 'setup.restart()', 'setup.setName(name)']) expect(src).toContain(call);
    expect(src).toContain("accessibilityLabel={t('app.common.name')}");
    expect(src).toContain("router.dismissTo('/remote')");
  });
});

describe('Apps on design v2 (T68 step 7)', () => {
  const src = read('app/(tabs)/apps.tsx');
  const tile = read('src/ui/apps/AppTile.tsx');
  const controls = read('src/ui/apps/FavouriteControls.tsx');

  it('uses the v2 scaffold, v2 tile cards and a card empty state with a tinted pill', () => {
    expect(src).toContain('<LargeTitleHeader');
    expect(src).toContain('<Card');
    expect(src).toContain('<PillButton');
    expect(src).toContain('variant="tinted"');
    expect(src).toContain("from '../../src/ui/v2'");
    expect(src).not.toMatch(/from '\.\.\/\.\.\/src\/theme\/tokens'|<Screen\b|useTheme|<EmptyState\b/);
    for (const f of [tile, controls]) {
      expect(f).toContain('useDesign()');
      expect(f).not.toMatch(/useTheme/);
    }
    expect(tile).toContain("boxShadow('low', p.scheme)");
  });

  it('keeps TV icons, the house tile, shimmer and the favourites editing', () => {
    expect(src).toContain('new AppIconCache()');
    expect(src).toContain('iconUri={icons[a.id]}');
    expect(src).toContain('<WithSkeleton loading={load === null}');
    expect(tile).toMatch(/fallbackTile\(app\.id\)/);
    expect(tile).toContain('<SkeletonBlock');
    expect(src).toContain('<FavouriteControls');
    for (const name of ['ACTION_EARLIER', 'ACTION_LATER', 'ACTION_TOGGLE', 'ACTION_EDIT']) expect(src).toContain(`name === ${name}`);
  });

  it('keeps the v1 accessibility labels and announcements', () => {
    expect(src).toContain("accessibilityHint={t(editing ? 'app.apps.fav.doneHint' : 'app.apps.fav.editHint')}");
    expect(src).toContain("t('ui.apps.fav.label'");
    expect(src).toContain('AccessibilityInfo.announceForAccessibility(msg)');
    expect(src).toContain('accessibilityLiveRegion="polite"');
    expect(src).toContain("accessibilityLiveRegion={emptyKind === 'error' ? 'polite' : 'none'}");
  });
});
