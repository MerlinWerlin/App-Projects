// Settings (PLAN §3 /settings, DESIGN_V2 §7): iOS inset-grouped sections on the v2 components — Tracing (starting
// opacity, keep awake, focus lock, setup guide replay, grid at start, outline style at start), Look & feel
// (haptics), Language (phone language or any shipped language) and About (free tools, Linework Plus + tip jar,
// privacy, version). Defaults are persisted locally.
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { useThemeV2 } from '../../src/theme/useTheme';
import { maxFontScaleV2, spaceV2 } from '../../src/theme/tokensV2';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GridDefault, type Settings } from '../../src/native/settings';
import { select, setHapticsEnabled } from '../../src/native/haptics';
import { LabeledSlider } from '../../src/ui/LabeledSlider';
import { STYLE_OPTIONS } from '../../src/core/outlineStyleParam';
import { PRESETS } from '../../src/core/outlinePresets';
import { SetupGuide } from '../../src/ui/SetupGuide';
import { InsetGroup, InsetRow, ScreenV2 } from '../../src/ui/v2';
import { setLanguage, useT, type LanguageSetting } from '../../src/i18n';
import { LOCALES, localeInfo } from '../../src/i18n/core';
import { applyLayoutDirection } from '../../src/i18n/direction';
import type { MessageKey } from '../../src/i18n/en';

const GRID_OPTIONS: { value: GridDefault; label: MessageKey }[] = [
  { value: 'off', label: 'settings.tracing.grid.off' },
  { value: '3x3', label: 'settings.tracing.grid.3x3' },
  { value: '4x4', label: 'settings.tracing.grid.4x4' },
];

export default function SettingsScreen() {
  const { c } = useThemeV2();
  const { t, tDynamic, percent } = useT();
  const router = useRouter();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [opacityDraft, setOpacityDraft] = useState(DEFAULT_SETTINGS.defaultOpacity);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings().then((v) => {
      if (!alive) return;
      setS(v);
      setOpacityDraft(v.defaultOpacity);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = (patch: Partial<Settings>) => {
    setS((prev) => ({ ...prev, ...patch }));
    saveSettings(patch).then(setS).catch(() => {});
  };

  const version = Constants.expoConfig?.version ?? '0.1.0';

  // InsetRow fires the selection tick for switches and check rows (it follows the Haptics setting).
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* T81: a tab root, so no back chevron; the tab bar moves between sections. */}
      <ScreenV2 title={t('common.nav.settings')} inTabs>
        {/* Tracing */}
        <InsetGroup header={t('settings.tracing.title')}>
          <SliderCell>
            <LabeledSlider
              label={t('settings.tracing.startingOpacity')}
              value={opacityDraft}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setOpacityDraft}
              onComplete={(v) => update({ defaultOpacity: v })}
              formatValue={(v) => percent(Math.round(v * 100) / 100)}
              accessibilityHint={t('settings.tracing.startingOpacityHint')}
            />
          </SliderCell>
          <InsetRow
            title={t('settings.tracing.keepAwake')}
            icon="sun"
            iconFill={c.pastels[2]}
            value={s.keepAwake}
            onValueChange={(v) => update({ keepAwake: v })}
            accessibilityLabel={t('settings.tracing.keepAwake')}
          />
          <InsetRow
            title={t('settings.focusLock.label')}
            subtitle={t('settings.focusLock.hint')}
            icon="crosshair"
            iconFill={c.pastels[3]}
            value={s.focusLock}
            onValueChange={(v) => update({ focusLock: v })}
            accessibilityLabel={t('settings.focusLock.label')}
            accessibilityHint={t('settings.focusLock.hint')}
          />
          {/* T66: replay the first-run setup guide (does not touch the stored "seen" flag). */}
          <InsetRow
            title={t('settings.guide.row')}
            subtitle={t('settings.guide.hint')}
            icon="compass"
            iconFill={c.pastels[4]}
            onPress={() => setShowGuide(true)}
            accessibilityLabel={t('settings.guide.row')}
            accessibilityHint={t('settings.guide.hint')}
          />
        </InsetGroup>

        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.tracing.gridAtStart')}>
          <InsetGroup header={t('settings.tracing.gridAtStart')}>
            {GRID_OPTIONS.map((o) => {
              const label = t(o.label);
              return (
                <InsetRow
                  key={o.value}
                  title={label}
                  accessory="check"
                  checked={s.gridDefault === o.value}
                  onPress={() => update({ gridDefault: o.value })}
                  accessibilityLabel={t('settings.tracing.gridOption', { name: label })}
                />
              );
            })}
          </InsetGroup>
        </View>

        {/* T54 / D72-1: the outline style Prepare starts with. */}
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.tracing.outlineStyle')}>
          <InsetGroup header={t('settings.tracing.outlineStyle')} footer={t('settings.tracing.outlineStyleHint')}>
            {STYLE_OPTIONS.map((o) => {
              const label = tDynamic(`prepare.preset.${o.preset}.name`, PRESETS.find((p) => p.id === o.preset)?.label ?? o.preset);
              return (
                <InsetRow
                  key={o.style}
                  title={label}
                  accessory="check"
                  checked={s.outlineStyle === o.style}
                  onPress={() => update({ outlineStyle: o.style })}
                  accessibilityLabel={t('settings.tracing.outlineStyleOption', { name: label })}
                  accessibilityHint={t('settings.tracing.outlineStyleHint')}
                />
              );
            })}
          </InsetGroup>
        </View>

        {/* Look & feel */}
        <InsetGroup header={t('settings.look.title')} footer={t('settings.look.footer')}>
          <InsetRow
            title={t('settings.tracing.haptics')}
            icon="smartphone"
            iconFill={c.pastels[1]}
            value={s.haptics}
            switchHaptic={false}
            onValueChange={(v) => {
              // Apply first, then tick: turning haptics on confirms with a tick, turning them off stays silent.
              setHapticsEnabled(v);
              select();
              update({ haptics: v });
            }}
            accessibilityLabel={t('settings.tracing.haptics')}
          />
        </InsetGroup>

        <LanguageSection />

        {/* About: free tools, Plus + tip jar, privacy, version */}
        <InsetGroup header={t('settings.about.title')} footer={t('settings.about.body', { version })}>
          <InsetRow title={t('settings.free.title')} subtitle={t('settings.free.body')} icon="heart" iconFill={c.pastels[1]} />
          <InsetRow
            title={t('settings.free.plusLink')}
            subtitle={t('settings.free.plusHint')}
            icon="gift"
            iconFill={c.pastels[4]}
            onPress={() => router.push('/plus')}
            accessibilityLabel={t('settings.free.plusLink')}
            accessibilityHint={t('settings.free.plusHint')}
          />
          <InsetRow
            title={t('feedback.row')}
            subtitle={t('feedback.rowHint')}
            icon="mail"
            iconFill={c.pastels[5]}
            onPress={() => router.push('/feedback')}
            accessibilityLabel={t('feedback.row')}
            accessibilityHint={t('feedback.rowHint')}
          />
          <InsetRow title={t('settings.privacy.title')} subtitle={t('settings.privacy.body')} icon="shield" iconFill={c.pastels[3]} />
        </InsetGroup>
      </ScreenV2>
      <SetupGuide visible={showGuide} onDone={() => setShowGuide(false)} />
    </>
  );
}

// Language picker: "Phone language (<its native name>)" plus every shipped language by its own name.
// Picking one applies it at once; switching between left-to-right and right-to-left may need a restart.
function LanguageSection() {
  const { c, text } = useThemeV2();
  const { t, setting, deviceLocale } = useT();
  const [busy, setBusy] = useState(false);

  // The check row fires the selection tick.
  const pick = async (value: LanguageSetting) => {
    if (busy || value === setting) return;
    setBusy(true);
    try {
      await setLanguage(value);
      const r = await applyLayoutDirection();
      if (r === 'restart-needed') {
        Alert.alert(t('settings.language.restartTitle'), t('settings.language.restartManual'), [{ text: t('common.ok') }]);
      }
    } catch {
      // the language still changed for this session
    } finally {
      setBusy(false);
    }
  };

  const options: { value: LanguageSetting; label: string; hint: string; subtitle?: string }[] = [
    {
      value: 'system',
      label: t('settings.language.system', { name: localeInfo(deviceLocale).nativeName }),
      hint: t('settings.language.systemHint'),
    },
    ...LOCALES.map((l) => ({
      value: l.code as LanguageSetting,
      label: l.nativeName,
      hint: l.englishName,
      subtitle: l.englishName !== l.nativeName ? l.englishName : undefined,
    })),
  ];

  return (
    <View style={{ marginBottom: spaceV2.section }}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.language.title')}>
        <InsetGroup header={t('settings.language.title')} footer={t('settings.language.hint')} style={{ marginBottom: 0 }}>
          {options.map((o) => (
            <InsetRow
              key={o.value}
              title={o.label}
              subtitle={o.subtitle}
              accessory="check"
              checked={setting === o.value}
              onPress={() => {
                pick(o.value).catch(() => {});
              }}
              accessibilityLabel={o.label}
              accessibilityHint={o.hint}
            />
          ))}
        </InsetGroup>
      </View>
      <Text
        maxFontSizeMultiplier={maxFontScaleV2}
        style={[text('footnote'), { color: c.muted, paddingHorizontal: spaceV2.x4, marginTop: spaceV2.x2 }]}
      >
        {t('settings.language.machineNote')}
      </Text>
    </View>
  );
}

// A non-row cell inside an InsetGroup (the opacity slider): same padding and inset hairline as the rows.
// InsetGroup passes isFirst so the first cell draws no separator.
function SliderCell({ children, isFirst = false }: { children: ReactNode; isFirst?: boolean }) {
  const { c } = useThemeV2();
  return (
    <View style={{ paddingHorizontal: spaceV2.x4, paddingVertical: spaceV2.x3, backgroundColor: c.card }}>
      {!isFirst ? (
        <View
          style={{ position: 'absolute', top: 0, start: spaceV2.x4, end: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.line }}
        />
      ) : null}
      {children}
    </View>
  );
}
