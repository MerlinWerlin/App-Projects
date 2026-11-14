// Settings (PLAN §3 /settings, DESIGN_V2 §7): iOS inset-grouped sections on the v2 components — Tracing (starting
// opacity, keep awake, focus lock, setup guide replay, grid at start, outline style at start), Look & feel
// (haptics), Language (a row that opens app/language.tsx) and About (free tools, Linework Plus + tip jar,
// privacy, version). Defaults are persisted locally.
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
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
import { InsetGroup, InsetRow, PillButton, ScreenV2 } from '../../src/ui/v2';
import { activateReviewAccess, reviewAccessAvailable, usePlus } from '../../src/plus/usePlus';
import { useT } from '../../src/i18n';
import { isLocaleCode, localeInfo } from '../../src/i18n/core';
import type { MessageKey } from '../../src/i18n/en';
import { STARTER_TEMPLATE_COUNT } from '../../src/plus/entitlement';

const PLAY_PRIVACY_URL = 'https://merlinwerlin.github.io/App-Projects/linework/play-privacy.html';

const GRID_OPTIONS: { value: GridDefault; label: MessageKey }[] = [
  { value: 'off', label: 'settings.tracing.grid.off' },
  { value: '3x3', label: 'settings.tracing.grid.3x3' },
  { value: '4x4', label: 'settings.tracing.grid.4x4' },
];

export default function SettingsScreen() {
  const { c } = useThemeV2();
  const { t, tDynamic, percent, setting: language, deviceLocale } = useT();
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
  const languageName =
    language === 'system' ? t('settings.language.system', { name: localeInfo(deviceLocale).nativeName }) : isLocaleCode(language) ? localeInfo(language).nativeName : language;

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

        {/* Language: one row with the current choice that opens the picker (app/language.tsx), as in iOS Settings. */}
        <InsetGroup>
          <InsetRow
            title={t('settings.language.title')}
            detail={languageName}
            icon="globe"
            iconFill={c.pastels[5]}
            onPress={() => router.push('/language')}
            accessibilityLabel={`${t('settings.language.title')}, ${languageName}`}
            accessibilityHint={t('settings.language.hint')}
          />
        </InsetGroup>

        {/* About: free tools, Plus + tip jar, privacy, version */}
        <InsetGroup header={t('settings.about.title')} footer={t('settings.about.body', { version })}>
          <InsetRow
            title={t('settings.free.title')}
            subtitle={t(Platform.OS === 'android' ? 'settings.free.playBody' : 'settings.free.body', { count: STARTER_TEMPLATE_COUNT })}
            icon="heart"
            iconFill={c.pastels[1]}
          />
          <InsetRow
            title={t(Platform.OS === 'android' ? 'settings.free.playPlusLink' : 'settings.free.plusLink')}
            subtitle={t(Platform.OS === 'android' ? 'settings.free.playPlusHint' : 'settings.free.plusHint')}
            icon="gift"
            iconFill={c.pastels[4]}
            onPress={() => router.push('/plus')}
            accessibilityLabel={t(Platform.OS === 'android' ? 'settings.free.playPlusLink' : 'settings.free.plusLink')}
            accessibilityHint={t(Platform.OS === 'android' ? 'settings.free.playPlusHint' : 'settings.free.plusHint')}
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
          <InsetRow
            title={t('settings.privacy.title')}
            subtitle={t(Platform.OS === 'android' ? 'settings.privacy.playBody' : 'settings.privacy.body')}
            icon="shield"
            iconFill={c.pastels[3]}
            onPress={Platform.OS === 'android' ? () => {
              void Linking.openURL(PLAY_PRIVACY_URL).catch(() => {
                Alert.alert(t('settings.privacy.title'), t('settings.privacy.openFailed', { url: PLAY_PRIVACY_URL }));
              });
            } : undefined}
            accessibilityHint={Platform.OS === 'android' ? t('settings.privacy.openHint') : undefined}
          />
        </InsetGroup>
        {reviewAccessAvailable ? <ReviewAccessSection /> : null}
      </ScreenV2>
      <SetupGuide visible={showGuide} onDone={() => setShowGuide(false)} />
    </>
  );
}

function ReviewAccessSection() {
  const { c, text } = useThemeV2();
  const { t } = useT();
  const { reviewActive } = usePlus();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    const accepted = await activateReviewAccess(code);
    setBusy(false);
    if (accepted) {
      setEditing(false);
      setCode('');
    } else {
      Alert.alert(t('settings.review.title'), t('settings.review.invalid'));
    }
  };

  return (
    <InsetGroup header={t('settings.review.title')}>
      <InsetRow
        title={t(reviewActive ? 'settings.review.active' : 'settings.review.enter')}
        icon={reviewActive ? 'check' : 'key'}
        onPress={reviewActive ? undefined : () => setEditing((shown) => !shown)}
      />
      {editing && !reviewActive ? (
        <View style={{ padding: spaceV2.x4, gap: spaceV2.x3 }}>
          <TextInput
            accessibilityLabel={t('settings.review.title')}
            placeholder={t('settings.review.title')}
            placeholderTextColor={c.muted}
            value={code}
            onChangeText={setCode}
            maxLength={64}
            autoCapitalize="characters"
            autoCorrect={false}
            secureTextEntry
            style={[text('body'), { color: c.ink, backgroundColor: c.inkSoft, padding: spaceV2.x3 }]}
          />
          <PillButton title={t('settings.review.apply')} disabled={busy || !code.trim()} onPress={() => { void activate(); }} />
        </View>
      ) : null}
    </InsetGroup>
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
