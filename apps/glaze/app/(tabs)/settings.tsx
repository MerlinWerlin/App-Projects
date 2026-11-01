// Settings (design v2, docs/DESIGN_V2.md §9, T56): collapsing large title, every section an inset
// group with pastel icon tiles, switch rows as inset rows with a trailing switch, Plus as a tinted
// squircle card. T70: no tab button (opened from the gear on Themes), so the bar offers "Done".
// T173 premium pass (docs/PREMIUM_UI.md §3.7): inset groups only (Plus and the tip jar too), editorial
// group titles (SectionHeader via InsetGroup `title`), row icons in pastel circles, values in
// inkSecondary, Storage sizes as skeletons while measuring, a Dynamic Type cap on every Text.
// T210 (owner-1101d screens): Help has a Clean up old icons row; the How icons work sheet says
// Install all at once is the main way (T202) and shows the removal steps as a numbered sequence.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { IconShape } from '../../src/core/iconspec';
import { PROBE_APPS } from '../../src/core/installedProbe';
import { GLYPH_SIZES, setStyle, type StudioState } from '../../src/core/studio';
import type { ReduceMotion } from '../../src/core/settings';
import { PlusLockSheet } from '../../src/plus/PlusLockSheet';
import { RestorePurchases } from '../../src/plus/RestorePurchases';
import { TipJar } from '../../src/plus/TipJar';
import { useSettings } from '../../src/store/settings';
import { useStudio } from '../../src/store/studio';
import { resetTips } from '../../src/store/tips';
import { circleRadius, continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { haptic } from '../../src/ui/haptics';
import { LanguageSection } from '../../src/ui/LanguageSection';
import { PackStorageSection } from '../../src/ui/PackStorageSection';
import { Segmented, type SegmentedOption } from '../../src/ui/Segmented';
import { Sheet } from '../../src/ui/Sheet';
import { ContextTip } from '../../src/ui/ContextTip';
import { useToast } from '../../src/ui/Toast';
import type { UpdateCheckOutcome } from '../../src/core/updates';
import { useT, type MessageKey, type Script } from '../../src/i18n';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { BarIconButton, InsetGroup, InsetRow, LargeTitleScrollView, Skeleton, SwitchInsetRow } from '../../src/ui/v2';
import { checkForUpdate, reloadApp } from '../../src/native/updates';

const PLUS_NAME = 'Glaze Plus'; // i18n-ignore (product name)

const SHAPE_LABEL = {
  squircle: 'settings.shapes.squircle',
  circle: 'settings.shapes.circle',
  rounded: 'settings.shapes.rounded',
  square: 'settings.shapes.square',
  blob: 'settings.shapes.blob',
} as const satisfies Record<IconShape, MessageKey>;
const SHAPES = Object.keys(SHAPE_LABEL) as IconShape[];

type SizeKey = (typeof GLYPH_SIZES)[number]['key'];
const SIZE_LABEL = { S: 'settings.sizes.small', M: 'settings.sizes.medium', L: 'settings.sizes.large' } as const;

const UPDATE_MESSAGE = {
  none: 'settings.updates.none',
  downloaded: 'settings.updates.downloaded',
  unavailable: 'settings.updates.unavailable',
  error: 'settings.updates.error',
} as const satisfies Record<UpdateCheckOutcome, MessageKey>;

// Same steps as removeGuide() in src/core/mobileconfig.ts, translated.
const REMOVE_STEPS = [
  'settings.explainer.step1',
  'settings.explainer.step2',
  'settings.explainer.step3',
  'settings.explainer.step4',
] as const;

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

function nearestSize(scale: number): SizeKey {
  let best = GLYPH_SIZES[0];
  for (const g of GLYPH_SIZES) if (Math.abs(g.scale - scale) < Math.abs(best.scale - scale)) best = g;
  return best.key;
}

export default function SettingsScreen() {
  const { c } = useColorsV2();
  const toast = useToast();
  const { state, update } = useStudio();
  const { settings, update: updateSettings } = useSettings();
  const [explainer, setExplainer] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const { t, script, formatNumber } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const version = Constants.expoConfig?.version ?? 'dev'; // i18n-ignore (version string)

  const shapeOptions: SegmentedOption<IconShape>[] = SHAPES.map((value) => {
    const label = t(SHAPE_LABEL[value]);
    return { value, label, accessibilityLabel: t('settings.style.shapeOptionA11y', { shape: label }) };
  });
  const sizeOptions: SegmentedOption<SizeKey>[] = GLYPH_SIZES.map((g) => {
    const label = t(SIZE_LABEL[g.key]);
    return { value: g.key, label, accessibilityLabel: t('settings.style.sizeOptionA11y', { size: label }) };
  });
  const motionOptions: SegmentedOption<ReduceMotion>[] = [
    { value: 'system', label: t('settings.feel.motionSystem'), accessibilityLabel: t('settings.feel.motionSystemA11y') },
    { value: 'on', label: t('settings.feel.motionOn'), accessibilityLabel: t('settings.feel.motionOnA11y') },
    { value: 'off', label: t('settings.feel.motionOff'), accessibilityLabel: t('settings.feel.motionOffA11y') },
  ];

  // Same rule as Icon Studio: editing the style by hand detaches it from a theme.
  const styleChange = (fn: (s: StudioState) => StudioState) => update((s) => ({ ...fn(s), themeId: null }));

  const onTipsReset = async () => {
    await resetTips();
    haptic('success');
    toast.show(t('settings.help.tipsResetDone'), 'success');
  };

  return (
    <LargeTitleScrollView
      title={t('tabs.settings')}
      subtitle={t('settings.subtitle')}
      // T70: Settings has no tab button any more (opened from the gear on Themes), so it offers a way back.
      trailing={<BarIconButton icon="x" accessibilityLabel={t('common.done')} onPress={() => router.navigate('/themes')} />}
    >
      <InsetGroup title={t('settings.style.title')} footer={t('settings.style.note')}>
        {state ? (
          <View key="shape" style={styles.block}>
            <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: c.ink }]}>
              {t('settings.style.shape')}
            </Text>
            <ContextTip id="icon-shapes" />
            <Segmented
              vertical
              label={t('settings.style.shapeGroup')}
              options={shapeOptions}
              value={state.style.shape}
              onChange={(shape) => styleChange((s) => setStyle(s, { shape }))}
            />
          </View>
        ) : null}
        {state ? (
          <View key="size" style={styles.block}>
            <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: c.ink }]}>
              {t('settings.style.size')}
            </Text>
            <Segmented
              label={t('settings.style.size')}
              options={sizeOptions}
              value={nearestSize(state.style.glyphScale)}
              onChange={(key) => {
                const g = GLYPH_SIZES.find((x) => x.key === key);
                if (g) styleChange((s) => setStyle(s, { glyphScale: g.scale }));
              }}
            />
          </View>
        ) : null}
        {state ? (
          <SwitchInsetRow
            key="labels"
            icon="type"
            iconTone="lilac"
            label={t('settings.style.showLabels')}
            description={t('settings.style.showLabelsDescription')}
            accessibilityLabel={t('settings.style.showLabelsA11y')}
            value={state.style.showLabel}
            onChange={(v) => {
              haptic('select');
              styleChange((s) => setStyle(s, { showLabel: v }));
            }}
          />
        ) : (
          // A short wait while the saved style loads: a skeleton in the row's shape, never a spinner.
          <View key="loading" style={styles.skeletonRow} accessible accessibilityLabel={t('common.loading')}>
            <Skeleton width={sizeV2.rowIcon} height={sizeV2.rowIcon} radius={circleRadius(sizeV2.rowIcon)} />
            <Skeleton width="50%" height={textV2.body.lineHeight ?? spaceV2.xl} />
          </View>
        )}
      </InsetGroup>

      <InsetGroup title={t('settings.feel.title')}>
        <SwitchInsetRow
          icon="smartphone"
          iconTone="mint"
          label={t('settings.feel.haptics')}
          description={t('settings.feel.hapticsDescription')}
          value={settings.haptics}
          onChange={(v) => {
            updateSettings({ haptics: v });
            // Confirm turning on with a tap (the cached setting updates synchronously once loaded).
            if (v) haptic('select');
          }}
        />
        <View style={styles.block}>
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: c.ink }]}>
            {t('settings.feel.motion')}
          </Text>
          <Segmented
            label={t('settings.feel.motionGroup')}
            options={motionOptions}
            value={settings.reduceMotion}
            onChange={(reduceMotion) => updateSettings({ reduceMotion })}
          />
        </View>
      </InsetGroup>

      <LanguageSection />

      {/* T46: Settings › Storage (downloaded theme packs). */}
      <PackStorageSection />

      <InsetGroup title={t('settings.help.title')}>
        <InsetRow
          icon="help-circle"
          iconTone="sky"
          title={t('settings.help.howIcons')}
          accessibilityLabel={t('settings.help.howIcons')}
          accessibilityHint={t('settings.help.howIconsHint')}
          onPress={() => setExplainer(true)}
        />
        {/* T210: the owner-1101d "Clean up old icons" steps are one tap from Help as well. */}
        <InsetRow
          icon="trash-2"
          iconTone="mint"
          title={t('install.cleanup.title')}
          subtitle={t('install.cleanup.rowSubtitle')}
          accessibilityLabel={t('install.cleanup.title')}
          accessibilityHint={t('install.cleanup.openHint')}
          onPress={() => router.push('/icons-cleanup')}
        />
        <InsetRow
          icon="info"
          iconTone="lilac"
          title={t('settings.help.tips')}
          accessibilityLabel={t('settings.help.tips')}
          accessibilityHint={t('settings.help.tipsHint')}
          onPress={() => router.push('/tips')}
        />
        <InsetRow
          icon="rotate-ccw"
          iconTone="butter"
          title={t('settings.help.tipsReset')}
          accessibilityLabel={t('settings.help.tipsReset')}
          accessibilityHint={t('settings.help.tipsResetHint')}
          onPress={() => void onTipsReset()}
          accessory="none"
          haptic={false}
        />
        <InsetRow
          icon="mail"
          iconTone="peach"
          title={t('settings.help.feedback')}
          accessibilityLabel={t('settings.help.feedback')}
          accessibilityHint={t('settings.help.feedbackHint')}
          onPress={() => router.push('/feedback')}
        />
      </InsetGroup>

      {/* Plus as an inset group (T173): one row opens the sheet, Restore purchases is always a row under it. */}
      <InsetGroup eyebrow={t('plus.lock.eyebrow')} title={PLUS_NAME} footer={t('settings.plus.body')}>
        <InsetRow
          icon="star"
          iconTone="berry"
          title={t('settings.plus.more')}
          accessibilityLabel={t('settings.plus.more')}
          accessibilityHint={t('settings.plus.moreHint')}
          onPress={() => setPlusOpen(true)}
        />
        <RestorePurchases variant="row" icon="refresh-cw" />
      </InsetGroup>
      {/* Release standard §2: the tip jar only says "Coming with the store release" until tips are on sale, so
          release builds leave it out (development keeps it for layout work). Show it again once tips are live. */}
      {__DEV__ ? <TipJar /> : null}

      <InsetGroup title={t('settings.privacy.title')}>
        <InsetRow icon="shield" iconTone="mint" title={t('settings.privacy.heading')} subtitle={t('settings.privacy.body')} />
        {/* T229: the installed-apps check (LSApplicationQueriesSchemes), explained in plain words. */}
        <InsetRow
          icon="smartphone"
          iconTone="mint"
          title={t('settings.privacy.installedTitle')}
          subtitle={t('settings.privacy.installedBody', { count: PROBE_APPS.length })}
        />
      </InsetGroup>

      <InsetGroup title={t('settings.about.title')} footer={t('settings.about.credits')}>
        <InsetRow
          icon="tag"
          iconTone="sky"
          title={t('settings.about.versionRow')}
          value={version}
          accessibilityLabel={t('settings.about.version', { version })}
        />
        <UpdateRow />
      </InsetGroup>

      <PlusLockSheet visible={plusOpen} onClose={() => setPlusOpen(false)} />

      <Sheet visible={explainer} onClose={() => setExplainer(false)} title={t('settings.help.howIcons')}>
        <Para title={t('settings.explainer.addedTitle')}>{t('settings.explainer.addedBody')}</Para>
        <Para title={t('settings.explainer.waysTitle')}>{t('settings.explainer.waysBody')}</Para>
        <Para title={t('settings.explainer.originalsTitle')}>{t('settings.explainer.originalsBody')}</Para>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: c.ink }]}>
          {t('settings.explainer.removeTitle')}
        </Text>
        {/* T210: the removal steps as one numbered sequence on a soft well (surface, no lines),
            each number in a tint circle; each step is read as one line by VoiceOver. */}
        <View style={[styles.stepsWell, continuous, { backgroundColor: c.fill }]}>
          {REMOVE_STEPS.map((step, i) => (
            <View
              key={step}
              style={styles.step}
              accessible
              accessibilityLabel={[t('settings.explainer.stepNumber', { number: i + 1 }), t(step)].join(' ')}
            >
              <View style={[styles.stepDot, { backgroundColor: c.tint }]}>
                <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...ts('subhead'), styles.stepDigit, { color: c.onTint }]}>
                  {formatNumber(i + 1)}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), styles.flex, { color: c.ink }]}>
                {t(step)}
              </Text>
            </View>
          ))}
        </View>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>
          {t('settings.explainer.shortcutsNote')}
        </Text>
      </Sheet>
    </LargeTitleScrollView>
  );
}

// "Check for updates" (T41): asks EAS Update for a newer JS bundle. In Expo Go it just says so.
function UpdateRow() {
  const toast = useToast();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const onCheck = async () => {
    if (busy) return;
    setBusy(true);
    haptic('select');
    const outcome = await checkForUpdate();
    setBusy(false);
    toast.show(t(UPDATE_MESSAGE[outcome]), outcome === 'error' ? 'warning' : outcome === 'downloaded' ? 'success' : 'info');
    if (outcome === 'downloaded') setTimeout(() => void reloadApp(), 1200);
  };
  const label = busy ? t('settings.updates.checking') : t('settings.updates.check');
  return (
    <InsetRow
      icon="refresh-cw"
      iconTone="mint"
      title={label}
      accessibilityLabel={label}
      accessibilityHint={t('settings.updates.hint')}
      onPress={() => void onCheck()}
      accessory="none"
      haptic={false}
    />
  );
}

function Para({ title, children }: { title: string; children?: ReactNode }) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <View style={styles.para}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...typeFor(script, 'headline'), { color: c.ink }]}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...typeFor(script, 'body'), { color: c.inkSecondary }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md, gap: spaceV2.sm },
  flex: { flex: 1, flexShrink: 1, gap: spaceV2.xxs },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md },
  para: { gap: spaceV2.xs },
  // T210: numbered removal steps on a soft well; numbers in tint circles (rowIcon size).
  stepsWell: { borderRadius: radiusV2.control, padding: spaceV2.md, gap: spaceV2.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.md },
  stepDot: { width: sizeV2.rowIcon, height: sizeV2.rowIcon, borderRadius: circleRadius(sizeV2.rowIcon), alignItems: 'center', justifyContent: 'center' },
  stepDigit: { fontWeight: '700' },
});
