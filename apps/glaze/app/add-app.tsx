// "Missing an app?" (owner review §5): find or add the app, copy a prompt for an external image
// tool, save a theme sample to Photos to attach, upload the result, and keep it for that app in
// that theme. Glaze never generates images and never contacts any AI service: the user takes the
// prompt to a tool of their choice. Logic lives in src/core (catalogue, iconPrompt, studio).
// Design v2 (docs/DESIGN_V2.md §9, T56): numbered pastel step tiles over grouped cards, the app
// list and the custom-app form as inset groups, copy/save as tinted small pills, and the saved
// image previewed as an icon tile.

import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getById, support, type SupportStatus } from '../src/core/catalogue';
import { IDEAL_UPLOAD_SIZE, MIN_UPLOAD_SIZE, SAFE_AREA_PERCENT, buildIconPrompt } from '../src/core/iconPrompt';
import { MAX_APP_NAME } from '../src/core/feedback';
import { wantsMonogram } from '../src/core/iconspec';
import { getAnyTheme } from '../src/core/plusThemes';
import { addApps, addCustomApp, findApp, pickerResults, setThemeOverride, type PickerRow } from '../src/core/studio';
import { THEMES, type Theme } from '../src/core/themes';
import { IconCanvas } from '../src/render/IconCanvas';
import { openAppSettings, useOffscreenCapture } from '../src/render/saveWallpaper';
import { keepIconImage, useStudio } from '../src/store/studio';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { ThemeSampleCard } from '../src/ui/ThemeSampleCard';
import { useToast } from '../src/ui/Toast';
import { haptic } from '../src/ui/haptics';
import { categoryName, customAppError, supportLabel } from '../src/ui/IconOverrideSheet';
import { PressableScale } from '../src/ui/PressableScale';
import { Chevron, noMirror, textStyleFor } from '../src/ui/i18nLayout';
import { InsetGroup, PillButton } from '../src/ui/v2';
import { useT, type Script } from '../src/i18n';

type Step = 1 | 2 | 3 | 4;
const RESULT_LIMIT = 30;
const SAMPLE_PREVIEW = 168;
const SAVED_PREVIEW = 96;
const STEP_TILE = 32;

function supportOf(r: PickerRow): SupportStatus {
  const e = r.custom ? undefined : getById(r.id);
  return e ? support(e) : support({ urlScheme: r.urlScheme });
}

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

export default function AddAppScreen() {
  const { c } = useColorsV2();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { t, script, isRTL, formatNumber } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const params = useLocalSearchParams<{ q?: string; appId?: string }>();
  const { state, update } = useStudio();
  const [step, setStep] = useState<Step>(params.appId ? 2 : 1);
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [appId, setAppId] = useState<string | null>(typeof params.appId === 'string' ? params.appId : null);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scheme, setScheme] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const [photosDenied, setPhotosDenied] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const saver = useOffscreenCapture<Theme>();

  // Theme: the one picked here, else the applied theme, else the first starter theme.
  const theme: Theme = getAnyTheme(themeId) ?? getAnyTheme(state?.themeId) ?? THEMES[0];
  // Overrides are keyed by the stored theme id (which may be a legacy id for the applied theme).
  const themeKey = state?.themeId && getAnyTheme(state.themeId)?.id === theme.id ? state.themeId : theme.id;
  const isCurrentTheme = !!state && state.themeId === themeKey;
  const themeChoices: Theme[] = useMemo(() => {
    const applied = getAnyTheme(state?.themeId);
    return applied && !THEMES.some((x) => x.id === applied.id) ? [applied, ...THEMES] : [...THEMES];
  }, [state?.themeId]);

  const results = useMemo(() => (state ? pickerResults(state, query, null, RESULT_LIMIT) : []), [state, query]);
  const app = state && appId ? findApp(state, appId) : null;
  const prompt = useMemo(() => (app ? buildIconPrompt({ appName: app.name, theme }) : ''), [app, theme]);

  if (!state) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <Text style={[...ts('body'), styles.pad, { color: c.inkSecondary }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  const choose = (id: string) => {
    haptic('select');
    setAppId(id);
    setSavedUri(null);
    update((s) => addApps(s, [id]));
    setStep(2);
  };

  const onAddCustom = () => {
    const r = addCustomApp(state, { name, urlScheme: scheme });
    if (!r.ok) {
      setFormError(customAppError(t, name));
      haptic('warning');
      return;
    }
    const next = r.state;
    update(() => next);
    setName('');
    setScheme('');
    setFormError(null);
    setShowForm(false);
    haptic('success');
    setAppId(r.id);
    setSavedUri(null);
    setStep(2);
  };

  const copyPrompt = async () => {
    try {
      await Clipboard.setStringAsync(prompt);
      haptic('success');
      toast.show(t('addApp.copied'), 'success');
    } catch {
      toast.show(t('addApp.copyFailed'), 'warning');
    }
  };

  const saveSample = async () => {
    setSampleNote(null);
    setPhotosDenied(false);
    const res = await saver.save(theme, { width: IDEAL_UPLOAD_SIZE, height: IDEAL_UPLOAD_SIZE });
    if (res.ok) {
      haptic('success');
      setSampleNote(t('addApp.sampleSaved', { theme: theme.name }));
    } else if (res.reason === 'denied') {
      haptic('warning');
      setPhotosDenied(true);
    } else {
      haptic('warning');
      setSampleNote(t('addApp.sampleFailed'));
    }
  };

  // T66: "Request an icon" opens the existing feedback screen with Icon request preselected.
  const requestIcon = (appName: string) => {
    haptic('select');
    router.push({ pathname: '/feedback', params: { type: 'icon', app: appName.trim().slice(0, MAX_APP_NAME) } });
  };

  const requestLink = (appName: string) => (
    <PillButton
      label={t('addApp.requestIcon')}
      icon="message-circle"
      variant="plain"
      size="small"
      haptic={false}
      style={styles.side}
      accessibilityHint={t('addApp.requestIconHint')}
      onPress={() => requestIcon(appName)}
    />
  );

  // Upload: picker -> copy into the app's documents folder -> My images -> this app in this theme.
  const upload = async () => {
    if (!app || busy) return;
    setBusy(true);
    setUploadError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const small = Math.min(asset.width ?? 0, asset.height ?? 0);
      const kept = await keepIconImage(asset.uri, app.id);
      const id = app.id;
      const key = themeKey;
      update((s) => setThemeOverride(addApps(s, [id]), key, id, { ...(s.themeOverrides[key]?.[id] ?? {}), overrideImage: kept }));
      setSavedUri(kept);
      haptic('success');
      if (small > 0 && MIN_UPLOAD_SIZE > small) {
        toast.show(t('addApp.smallImage', { size: small, min: MIN_UPLOAD_SIZE }), 'warning');
      }
      setStep(4);
    } catch {
      setUploadError(t('iconsUi.openError'));
    } finally {
      setBusy(false);
    }
  };

  // Numbered pastel tile: tint once the step is reached, quiet fill before.
  const stepTitle = (n: Step, title: string) => (
    <View style={styles.stepHead}>
      <View
        style={[
          styles.stepTile,
          continuous,
          { backgroundColor: step >= n ? c.tint : c.fill },
        ]}
      >
        <Text style={[...ts('headline'), { color: step >= n ? c.onTint : c.inkSecondary }]}>{formatNumber(n)}</Text>
      </View>
      <Text accessibilityRole="header" style={[...ts('title3'), styles.flex, { color: c.ink }]}>
        {title}
      </Text>
    </View>
  );

  const badge = (s: SupportStatus) => {
    return (
      <View style={[styles.badge, continuous, { backgroundColor: s === 'shortcuts' ? c.tintSoft : c.fill }]}>
        <Text style={[...ts('caption1'), { color: s === 'shortcuts' ? c.onTintSoft : c.inkSecondary }]}>{supportLabel(t, s)}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spaceV2.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[...ts('callout'), styles.sidePad, { color: c.inkSecondary }]}>{t('addApp.intro')}</Text>

        {/* Step 1: find or add the app */}
        {stepTitle(1, app ? t('addApp.stepApp', { name: app.name }) : t('addApp.stepFind'))}
        {step === 1 ? (
          <>
            <View style={[styles.search, styles.side, continuous, { backgroundColor: c.fill }]}>
              <Feather name="search" size={18} color={c.inkSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('icons.searchPlaceholder')}
                placeholderTextColor={c.inkSecondary}
                selectionColor={c.tint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t('icons.searchPlaceholder')}
                style={[...ts('body'), styles.searchInput, { color: c.ink }]}
              />
            </View>
            <InsetGroup>
              {results.length === 0 ? (
                <Text key="none" style={[...ts('body'), styles.rowPad, { color: c.inkSecondary }]}>
                  {t('addApp.notInList')}
                </Text>
              ) : null}
              {results.map((r) => {
                const s = supportOf(r);
                return (
                  <PressableScale
                    key={r.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('icons.rowLabel', { name: r.name, status: supportLabel(t, s) })}
                    accessibilityHint={t('addApp.rowHint')}
                    onPress={() => choose(r.id)}
                    pressedScale={0.98}
                    style={styles.row}
                  >
                    <View style={styles.flex}>
                      <Text style={[...ts('body'), { color: c.ink }]} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{categoryName(t, r.category)}</Text>
                    </View>
                    {badge(s)}
                    <Feather name={Chevron.forward(isRTL)} size={18} color={c.inkTertiary} />
                  </PressableScale>
                );
              })}
            </InsetGroup>

            {results.length === 0 && query.trim() ? requestLink(query) : null}
            {showForm ? (
              <>
                <InsetGroup header={t('addApp.addYourApp')} footer={t('addApp.schemeNote', { example: 'appname://' })}>
                  <View style={styles.fieldRow}>
                    <TextInput
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        setFormError(null);
                      }}
                      placeholder={t('icons.appName')}
                      placeholderTextColor={c.inkSecondary}
                      selectionColor={c.tint}
                      accessibilityLabel={t('icons.appName')}
                      returnKeyType="next"
                      style={[...ts('body'), styles.input, { color: c.ink }]}
                    />
                  </View>
                  <View style={styles.fieldRow}>
                    <TextInput
                      value={scheme}
                      onChangeText={(v) => {
                        setScheme(v);
                        setFormError(null);
                      }}
                      placeholder={t('icons.schemePlaceholder', { example: 'appname://' })}
                      placeholderTextColor={c.inkSecondary}
                      selectionColor={c.tint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel={t('icons.schemeLabel')}
                      accessibilityHint={t('icons.schemeHint')}
                      returnKeyType="done"
                      onSubmitEditing={onAddCustom}
                      style={[...ts('body'), styles.input, { color: c.ink }]}
                    />
                  </View>
                </InsetGroup>
                <View style={[styles.side, styles.gapSm]}>
                  {formError ? (
                    <Text style={[...ts('footnote'), { color: c.warn }]} accessibilityRole="alert">
                      {formError}
                    </Text>
                  ) : null}
                  <PillButton label={t('icons.addApp')} icon="plus" block onPress={onAddCustom} disabled={!name.trim()} />
                </View>
              </>
            ) : (
              <PillButton
                label={t('addApp.notListed')}
                icon="plus"
                variant="tinted"
                haptic={false}
                style={styles.side}
                onPress={() => {
                  haptic('select');
                  setName(query.trim());
                  setShowForm(true);
                }}
              />
            )}
          </>
        ) : (
          <PillButton
            label={t('addApp.chooseAnother')}
            icon="search"
            variant="plain"
            haptic={false}
            style={styles.side}
            onPress={() => {
              haptic('select');
              setStep(1);
            }}
          />
        )}

        {/* Step 2: prompt + theme sample */}
        {app ? (
          <>
            {stepTitle(2, t('addApp.stepMake'))}
            {/* T66: no glyph ships for this app (custom or missing): it shows its monogram; offer a request. */}
            {wantsMonogram(app.glyph) ? (
              <>
                <Text style={[...ts('footnote'), styles.sidePad, { color: c.inkSecondary }]}>{t('addApp.monogramNote', { app: app.name })}</Text>
                {requestLink(app.name)}
              </>
            ) : null}
            {step >= 2 ? (
              <>
                <Text style={[...ts('footnote'), styles.groupLabel, { color: c.inkSecondary }]}>{t('addApp.themeToMatch')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {themeChoices.map((th) => {
                    const on = th.id === theme.id;
                    return (
                      <Pressable
                        key={th.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on, checked: on }}
                        accessibilityLabel={t('addApp.themeLabel', { name: th.name })}
                        onPress={() => {
                          haptic('select');
                          setThemeId(th.id);
                          setSampleNote(null);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          continuous,
                          { backgroundColor: on ? c.tint : c.surface, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={[...ts('subhead'), styles.semibold, { color: on ? c.onTint : c.ink }]}>{th.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <StepCard>
                  <Text style={[...ts('body'), { color: c.ink }]}>
                    {t('addApp.instructions', { app: app.name, theme: theme.name })}
                  </Text>
                  <View style={styles.center}>
                    <ThemeSampleCard theme={theme} size={SAMPLE_PREVIEW} accessibilityLabel={t('addApp.sampleLabel', { theme: theme.name })} />
                  </View>
                  <PillButton
                    label={saver.saving ? t('addApp.saving') : t('addApp.saveSample')}
                    icon="image"
                    variant="tinted"
                    size="small"
                    haptic={false}
                    onPress={saveSample}
                    disabled={saver.saving}
                    accessibilityHint={t('addApp.saveSampleHint', { size: IDEAL_UPLOAD_SIZE, theme: theme.name })}
                  />
                  {sampleNote ? <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{sampleNote}</Text> : null}
                  {photosDenied ? (
                    <View style={[styles.notice, continuous, { backgroundColor: c.pastels.peach.fill }]}>
                      <Text style={[...ts('body'), { color: c.pastels.peach.ink }]}>{t('addApp.photosDenied')}</Text>
                      <Text style={[...ts('footnote'), { color: c.pastels.peach.ink }]}>{t('addApp.photosDeniedSteps')}</Text>
                      <PillButton label={t('iconsUi.openSettings')} icon="settings" size="small" onPress={openAppSettings} />
                    </View>
                  ) : null}

                  <Text style={[...ts('headline'), { color: c.ink }]} accessibilityRole="header">
                    {t('addApp.prompt')}
                  </Text>
                  <View style={[styles.promptBox, continuous, { backgroundColor: c.fill }]}>
                    <Text selectable style={[...ts('footnote'), { color: c.ink }]}>
                      {prompt}
                    </Text>
                  </View>
                  <PillButton label={t('addApp.copyPrompt')} icon="copy" variant="tinted" size="small" onPress={copyPrompt} />
                  <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>
                    {t('addApp.promptNote', { min: MIN_UPLOAD_SIZE, percent: SAFE_AREA_PERCENT })}
                  </Text>
                  {step === 2 ? (
                    <PillButton
                      label={t('addApp.haveImage')}
                      icon={Chevron.arrowForward(isRTL)}
                      iconAfter
                      variant="tinted"
                      block
                      haptic={false}
                      onPress={() => {
                        haptic('select');
                        setStep(3);
                      }}
                    />
                  ) : null}
                </StepCard>
              </>
            ) : null}
          </>
        ) : null}

        {/* Step 3: upload */}
        {app && step >= 3 ? (
          <>
            {stepTitle(3, t('addApp.stepUpload'))}
            <StepCard>
              <Text style={[...ts('body'), { color: c.ink }]}>{t('addApp.uploadBody', { app: app.name, theme: theme.name })}</Text>
              <PillButton
                label={busy ? t('iconsUi.opening') : t('iconsUi.upload')}
                icon="upload"
                block
                onPress={upload}
                disabled={busy}
                accessibilityHint={t('addApp.uploadHint')}
              />
              {uploadError ? (
                <Text style={[...ts('footnote'), { color: c.warn }]} accessibilityRole="alert">
                  {uploadError}
                </Text>
              ) : null}
            </StepCard>
          </>
        ) : null}

        {/* Step 4: done */}
        {app && step === 4 && savedUri ? (
          <>
            {stepTitle(4, t('addApp.stepSaved'))}
            <StepCard centred>
              {/* The saved image as an icon tile on a soft squircle. */}
              <View style={[styles.savedTile, continuous, { backgroundColor: c.fill }]}>
                <IconCanvas
                  spec={{
                    appId: app.id,
                    shape: theme.iconStyle.shape,
                    background: theme.iconStyle.background,
                    glyph: app.glyph,
                    glyphColour: theme.iconStyle.glyphColour,
                    glyphScale: theme.iconStyle.glyphScale,
                    overrideImage: savedUri,
                  }}
                  size={SAVED_PREVIEW}
                  style={noMirror}
                  accessibilityLabel={t('addApp.savedLabel', { app: app.name, theme: theme.name })}
                />
              </View>
              <Text style={[...ts('body'), styles.centerText, { color: c.ink }]}>
                {t('addApp.savedBody', { app: app.name, theme: theme.name })}
              </Text>
              {!isCurrentTheme ? (
                <Text style={[...ts('footnote'), styles.centerText, { color: c.inkSecondary }]}>
                  {t('addApp.notCurrent', { theme: theme.name })}
                </Text>
              ) : null}
              <PillButton
                label={t('icons.install')}
                icon="download"
                block
                onPress={() => {
                  haptic('select');
                  router.push('/install');
                }}
                accessibilityHint={t('addApp.installHint')}
              />
              {!isCurrentTheme ? (
                <PillButton
                  label={t('addApp.openTheme', { theme: theme.name })}
                  icon="droplet"
                  variant="tinted"
                  block
                  haptic={false}
                  onPress={() => router.push(`/theme/${theme.id}`)}
                />
              ) : null}
              <PillButton
                label={t('addApp.makeAnother')}
                icon="plus"
                variant="plain"
                block
                haptic={false}
                onPress={() => {
                  haptic('select');
                  setAppId(null);
                  setSavedUri(null);
                  setQuery('');
                  setStep(1);
                }}
              />
            </StepCard>
          </>
        ) : null}
      </ScrollView>

      {/* Full-size sample, parked off screen while saving to Photos. */}
      {saver.job ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: -10000, top: 0 }}
        >
          <ThemeSampleCard ref={saver.ref} theme={saver.job.data} size={saver.job.layout.width} />
        </View>
      ) : null}
    </View>
  );
}

/** Grouped card for a step's content: the inset-group surface (22 pt continuous corners on `bg`). */
function StepCard({ children, centred = false }: { children?: ReactNode; centred?: boolean }) {
  const { c } = useColorsV2();
  return (
    <View style={[styles.stepCard, continuous, centred ? styles.center : null, { backgroundColor: c.surface }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: spaceV2.lg, gap: spaceV2.lg },
  pad: { padding: spaceV2.lg },
  side: { marginHorizontal: spaceV2.lg },
  sidePad: { paddingHorizontal: spaceV2.inset },
  groupLabel: { paddingHorizontal: spaceV2.inset, fontWeight: '600' },
  flex: { flex: 1, flexShrink: 1 },
  gapSm: { gap: spaceV2.sm },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  semibold: { fontWeight: '600' },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, paddingHorizontal: spaceV2.inset, marginTop: spaceV2.sm },
  stepTile: {
    width: STEP_TILE,
    height: STEP_TILE,
    borderRadius: iconTileRadius(STEP_TILE),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCard: { marginHorizontal: spaceV2.lg, borderRadius: radiusV2.group, padding: spaceV2.lg, gap: spaceV2.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.lg,
    minHeight: sizeV2.touch,
    gap: spaceV2.sm,
  },
  searchInput: { flex: 1, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm },
  rowPad: { paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.rowMin,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm,
  },
  badge: { borderRadius: radiusV2.pill, paddingHorizontal: spaceV2.sm, paddingVertical: spaceV2.xxs },
  fieldRow: { minHeight: sizeV2.rowMin, paddingHorizontal: spaceV2.lg, justifyContent: 'center' },
  input: { minHeight: sizeV2.touch, paddingVertical: spaceV2.sm },
  chipRow: { gap: spaceV2.sm, paddingVertical: spaceV2.xs, paddingHorizontal: spaceV2.lg },
  chip: {
    minHeight: sizeV2.touch,
    justifyContent: 'center',
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
  },
  notice: { borderRadius: radiusV2.control, padding: spaceV2.md, gap: spaceV2.sm },
  promptBox: { borderRadius: radiusV2.control, padding: spaceV2.md },
  savedTile: {
    padding: spaceV2.md,
    borderRadius: iconTileRadius(SAVED_PREVIEW + spaceV2.md * 2),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
