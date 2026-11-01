import { nativeWidgetSupported } from '../src/core/widgetDelivery';
// Widget Studio (T59, M4b-ui; docs/WIDGETS.md "Widget Studio"). Edit one widget of a theme's
// matching set: type and size, background (photo, colour, gradient or the theme's art), accent and
// text colours, text, font and text size. The live preview stays pinned on top.
//
// "Add widget" saves the design on this phone and, in a full iOS build with the widget bridge,
// writes it to the App Group (glaze.widgets.v2 + the v1 theme) through src/native/widgets.ts.
// In Expo Go / Android the bridge is absent and the screen says it is a preview only. It never
// claims the widget was tested or is on the Home Screen. Photos stay on the device.
//
// T78: the catalogue kinds (src/core/widgetKinds.ts: analog clock, month calendar, countdown,
// progress dots, photo album, habit trackers) are listed after the theme-set kinds and edited via
// applyCatalogueEdits (text, colours, countdown day, album interval). "Add widget" then writes the
// set plus the catalogue block (serialiseWidgetCatalogue). Widgets with buttons are labelled
// "Preview only": the in-app preview never pretends a habit tap works.
// T73: in a full iOS build the habit widget preview shows today's value read back from the App
// Group (taps made on the Home Screen widget, src/store/widgetHabits.ts) and says the real widget's
// buttons log on iOS 17+; the in-app buttons themselves stay a preview everywhere.
// T173 (premium UI, docs/PREMIUM_UI.md §3.4): the pinned preview sits on a soft raised surface (no
// dark-mode hairline) with a small "Live preview" eyebrow read as one heading with the widget's name
// and size; the controls stay inset groups; Dynamic Type caps (fontScaleCap) on every Text and
// TextInput; chrome radii from chromeRadiusV2. Presentation only: drafts, saving and the bridge are
// unchanged.
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import type { DisplayFont } from '../src/core/artwork';
import { studioSaveTicksWidgets } from '../src/core/applyChecklist';
import { useAnyTheme } from '../src/native/useAnyTheme';
import type { Theme } from '../src/core/themes';
import { catalogueKindKey, catalogueSizeKey, isCatalogueKind, type CatalogueKind, type CatalogueSize } from '../src/core/widgetKinds';
import { widgetLookKey, type WidgetLook } from '../src/core/widgetLook';
import { generateWidgetSet, generateWidgetSetFromTokens, widgetKindKey, widgetSizeKey, type WidgetKind, type WidgetSize } from '../src/core/widgetSets';
import { wallpaperTokensFor } from '../src/core/wallpaperPalette';
import {
  STUDIO_FONTS,
  backgroundOptions,
  clampScale,
  colourSwatches,
  currentDraft,
  currentStudioSpec,
  editableRegions,
  fractionOfScale,
  gradientSwatches,
  gradientValue,
  hasCountdown,
  initialStudioState,
  needsPhotoCopy,
  parseGradientValue,
  resetDraft,
  scaleFromFraction,
  selectWidget,
  setDraftText,
  stepScale,
  studioKinds,
  studioLooks,
  studioSizes,
  updateDraft,
  catalogueEditableRegions,
  catalogueHasButtons,
  catalogueStudioKinds,
  catalogueStudioLooks,
  catalogueStudioSizes,
  currentCatalogueDraft,
  currentCatalogueSpecId,
  currentCatalogueStudioSpec,
  resetCatalogueDraft,
  rotateOptions,
  selectCatalogueWidget,
  setCatalogueDraftText,
  studioCatalogue,
  studioCataloguePayload,
  updateCatalogueDraft,
  type CatalogueBackground,
  type StudioBackgroundKind,
  type StudioFont,
  type StudioState,
  type StudioSwatch,
} from '../src/core/widgetStudio';
import { useT } from '../src/i18n';
import { photoPieceId } from '../src/core/widgetArtLibrary';
import { widgets } from '../src/native/widgets';
import { PlusLockSheet } from '../src/plus/PlusLockSheet';
import { useLocked } from '../src/plus/useLocked';
import { openAppSettings } from '../src/render/saveWallpaper';
import { tickStoredChecklist } from '../src/store/applyChecklist';
import { applyWidgetTheme } from '../src/store/widgetTheme';
import { useWidgetHabits, widgetHabitGoal, widgetHabitValue } from '../src/store/widgetHabits';
import { loadStudio, saveStudio } from '../src/store/widgetStudio';
import { chromeRadiusV2, circleRadius, continuous, eyebrowCaseFor, fontScaleCap, sizeV2, spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import type { FeatherName } from '../src/ui/featherName';
import { haptic } from '../src/ui/haptics';
import { textStyleFor } from '../src/ui/i18nLayout';
import { pickBackgroundPhoto } from '../src/ui/pickBackgroundPhoto';
import { Swatches, type Swatch } from '../src/ui/Swatches';
import { displayFontStyle } from '../src/ui/ThemeCard';
import { InsetGroup, PillButton, SquircleCard } from '../src/ui/v2';
import { CatalogueWidgetPreview } from '../src/ui/CatalogueWidgetPreview';
import { WidgetPreview } from '../src/ui/WidgetPreview';
import { useWallpaperPalette } from '../src/ui/useWallpaperPalette';

/** Untyped lookup for catalogue keys carried in data (kind/size/issue keys). */
type LooseT = (key: string, params?: Record<string, string | number>) => string;

type AddResult = 'saved' | 'preview' | 'failed' | 'photoFailed' | 'unsupported' | 'updateRequired' | null;
type PhotoProblem = 'denied' | 'error' | null;

const BG_ICONS: Record<StudioBackgroundKind, FeatherName> = {
  photo: 'image',
  colour: 'droplet',
  gradient: 'sunset',
  theme: 'star',
};

const THEME_VALUE = 'theme';

/** Edits shared by theme-set and catalogue drafts (catalogue backgrounds never hold a photo). */
type SharedPatch = { background?: CatalogueBackground; accent?: string | null; textColour?: string | null; countdownTo?: string | null };

function swatchesFor(list: readonly StudioSwatch[], tl: LooseT, gradient: boolean): Swatch[] {
  return list.map((s) => ({
    hex: s.hex,
    hex2: s.hex2,
    name: tl(s.nameKey, s.index !== undefined ? { number: s.index } : undefined),
    value: gradient && s.hex2 ? gradientValue(s.hex, s.hex2) : s.hex,
  }));
}

function fontLabelKey(f: StudioFont): string {
  return `themeUi.widgetStudio.font.${f}`;
}

export default function WidgetStudioScreen() {
  const params = useLocalSearchParams<{ theme?: string; kind?: string; size?: string }>();
  // T179: remote catalogue themes resolve too (bundled ids win), so the Apply widgets step never dead-ends.
  const theme = useAnyTheme(typeof params.theme === 'string' ? params.theme : undefined);
  const { c } = useColorsV2();
  const { t, script } = useT();
  const router = useRouter();
  if (!theme) {
    return (
      <View style={[styles.missing, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: t('themeUi.widgetStudio.title') }} />
        <Text maxFontSizeMultiplier={fontScaleCap('title3')} style={[textV2.title3, textStyleFor(script, textV2.title3), { color: c.ink }]}>{t('theme.notFound')}</Text>
        <PillButton label={t('theme.backToThemes')} onPress={() => router.back()} />
      </View>
    );
  }
  return (
    <WidgetStudio
      theme={theme}
      kind={typeof params.kind === 'string' ? params.kind : null}
      size={typeof params.size === 'string' ? params.size : null}
    />
  );
}

function WidgetStudio({ theme, kind, size }: { theme: Theme; kind: string | null; size: string | null }) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tl = t as unknown as LooseT;
  const { width: screenW } = useWindowDimensions();
  const set = useMemo(() => generateWidgetSet(theme), [theme]);
  // T85: drafts are keyed by `set`; specs and the payload are solved with the wallpaper the user
  // actually has (their photo's sampled colours when the background is their photo).
  const wallpaper = useWallpaperPalette(theme);
  const lookSet = useMemo(
    () => (wallpaper.usesPhoto ? generateWidgetSetFromTokens(wallpaperTokensFor(set.tokens, { usesPhoto: true, sampled: wallpaper.sampled })) : set),
    [set, wallpaper.usesPhoto, wallpaper.sampled],
  );
  const cat = useMemo(() => studioCatalogue(lookSet), [lookSet]);
  const [state, setState] = useState<StudioState>(() => initialStudioState(set, kind, size));
  const loaded = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AddResult>(null);
  const [photoProblem, setPhotoProblem] = useState<PhotoProblem>(null);
  const [countdownText, setCountdownText] = useState('');
  const locked = useLocked(theme.plus);
  const [lockOpen, setLockOpen] = useState(false);
  // T73: values logged with the interactive habit widgets (full iOS build only; Expo Go: none).
  const widgetHabits = useWidgetHabits();

  // Load the saved drafts once; the widget asked for in the route wins over the saved selection.
  useEffect(() => {
    let alive = true;
    loadStudio(set).then((saved) => {
      if (!alive) return;
      loaded.current = true;
      if (isCatalogueKind(kind)) {
        const cs = size && (catalogueStudioSizes(kind) as string[]).includes(size) ? (size as CatalogueSize) : undefined;
        setState(selectCatalogueWidget(saved, kind, cs));
        return;
      }
      const k = kind && (studioKinds(set) as string[]).includes(kind) ? (kind as WidgetKind) : null;
      const s = size && k && (studioSizes(set, k) as string[]).includes(size) ? (size as WidgetSize) : undefined;
      setState(k ? selectWidget(set, saved, k, s) : saved);
    });
    return () => {
      alive = false;
    };
  }, [set, kind, size]);

  // Save drafts shortly after each change (on this phone only).
  useEffect(() => {
    if (!loaded.current) return;
    const id = setTimeout(() => void saveStudio(state), 400);
    return () => clearTimeout(id);
  }, [state]);

  const draft = currentDraft(set, state);
  const edited = currentStudioSpec(lookSet, state);
  const spec = edited?.spec ?? lookSet.specs[0];
  // Catalogue widget open (T78): its own spec, draft and issues; else the theme-set widget above.
  const catOpen = state.catalogue ?? null;
  const catEdited = currentCatalogueStudioSpec(cat, state);
  const catSpec = catOpen && catEdited ? catEdited.spec : null;
  const catDraft = currentCatalogueDraft(state);
  const issueList: { messageKey: string }[] = catSpec ? catEdited?.issues ?? [] : edited?.issues ?? [];
  const issueKeys: string[] = issueList.map((i) => i.messageKey);
  const kinds = studioKinds(set);
  const sizes = studioSizes(set, state.kind);
  const bgOptions: StudioBackgroundKind[] = catSpec ? (catSpec.editable.colours ? ['colour', 'gradient', 'theme'] : []) : backgroundOptions(spec);
  const regions = catSpec ? catalogueEditableRegions(catSpec) : editableRegions(spec);
  const photoUri = !catSpec && draft.background.kind === 'photo' ? draft.background.uri : null;
  const showCountdown = catSpec ? catSpec.editable.countdown : hasCountdown(spec);
  const showTextGroup = regions.length !== 0 || showCountdown;
  const showColours = catSpec ? catSpec.editable.colours : true;
  const bgNow = catSpec ? catDraft.background : draft.background;
  const accentNow = catSpec ? catDraft.accent : draft.accent;
  const textColourNow = catSpec ? catDraft.textColour : draft.textColour;
  const textNow: Record<string, string> = catSpec ? catDraft.text : draft.text;
  const countdownNow = catSpec ? catDraft.countdownTo : draft.countdownTo;
  const hasDraft = catSpec ? !!state.catalogueDrafts?.[currentCatalogueSpecId(state) ?? ''] : !!state.drafts[spec.id];

  useEffect(() => {
    setCountdownText(countdownNow ?? '');
    setResult(null);
    // Only when the open widget changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, state.size, catOpen?.kind, catOpen?.size]);

  const change = useCallback((fn: (s: StudioState) => StudioState) => {
    setResult(null);
    setState((s) => fn(s));
  }, []);

  const kindName = catOpen ? tl(catalogueKindKey(catOpen.kind)) : tl(widgetKindKey(state.kind));
  const sizeName = catOpen ? tl(catalogueSizeKey(catOpen.size)) : tl(widgetSizeKey(state.size));
  const narrow = catOpen
    ? catOpen.size === 'small' || catOpen.size === 'standby' || catOpen.size === 'accessoryCircular'
    : state.size === 'small';
  const previewW = Math.min(screenW - spaceV2.lg * 4, narrow ? 180 : 340);
  const issueLines = [...new Set(issueKeys)].map((k) => tl(k));
  const catNotes: string[] = [];
  if (catSpec) {
    // T73: habit buttons are real App Intents on iOS 17+ in a full build; in Expo Go, on Android
    // and in older builds they stay a preview. Album "next" is not interactive yet.
    if (catalogueHasButtons(catSpec)) {
      catNotes.push(catSpec.binding.habit && widgetHabits.available ? t('tabs.widgetsTab.studio.habitButtons') : t('tabs.widgetsTab.buttonsNote'));
    }
    if (catSpec.family === 'accessory') catNotes.push(t('tabs.widgetsTab.studio.lockColours'));
    if (catSpec.family === 'standby') catNotes.push(t('tabs.widgetsTab.studio.standbyNote'));
    if (catSpec.kind === 'photoAlbum') catNotes.push(t('tabs.widgetsTab.studio.albumPhotos'));
  }

  // T85: looks for whichever widget is open, and what the footer explains.
  const lookOptions: WidgetLook[] = catSpec ? catalogueStudioLooks(catSpec) : studioLooks(set.tokens);
  const lookNow: WidgetLook = (catSpec ? catDraft.look : draft.look) ?? 'theme';
  const lookFooter =
    catSpec?.family === 'standby'
      ? t('themeUi.widgetStudio.look.standbyNote')
      : wallpaper.usesPhoto
        ? t('themeUi.widgetStudio.look.photoNote')
        : t('themeUi.widgetStudio.look.note');

  /** Colour / countdown edits for whichever widget is open (theme-set or catalogue). */
  const patchOpen = (p: SharedPatch) => change((s) => (s.catalogue ? updateCatalogueDraft(s, p) : updateDraft(set, s, p)));
  const setOpenText = (regionId: string, v: string) =>
    change((s) => (s.catalogue ? setCatalogueDraftText(s, regionId, v) : setDraftText(set, s, regionId, v)));
  const resetOpenText = () => change((s) => (s.catalogue ? updateCatalogueDraft(s, { text: {} }) : updateDraft(set, s, { text: {} })));

  const onBackground = async (k: StudioBackgroundKind) => {
    setPhotoProblem(null);
    if (k === 'theme') return patchOpen({ background: { kind: 'theme' } });
    if (k === 'colour') {
      const first = colourSwatches(set.tokens)[0];
      return patchOpen({ background: { kind: 'colour', colour: first.hex } });
    }
    if (k === 'gradient') {
      const first = gradientSwatches(set.tokens)[0];
      return patchOpen({ background: { kind: 'gradient', from: first.hex, to: first.hex2 ?? first.hex } });
    }
    if (catSpec) return;
    await onPickPhoto();
  };

  const onPickPhoto = async () => {
    setPhotoProblem(null);
    const r = await pickBackgroundPhoto(theme.id);
    if (r.kind === 'picked') {
      haptic('success');
      change((s) => updateDraft(set, s, { background: { kind: 'photo', uri: r.uri } }));
    } else if (r.kind === 'denied') {
      setPhotoProblem('denied');
    } else if (r.kind !== 'cancelled') {
      setPhotoProblem('error');
    }
  };

  const onAdd = async () => {
    if (busy) return;
    if (locked) {
      setLockOpen(true);
      return;
    }
    setBusy(true);
    setResult(null);
    let next: AddResult = 'failed';
    try {
      await saveStudio(state);
      const status = await widgets.isAvailable();
      if (!status.available) {
        next = 'preview';
      } else if (!nativeWidgetSupported(catSpec?.kind ?? spec.kind, catSpec?.size ?? spec.size)) {
        next = 'unsupported';
      } else if (await widgets.designVersion() < 2) {
        next = 'updateRequired';
      } else {
        const photo = state.catalogue ? null : needsPhotoCopy(set, state);
        const photoOk = photo ? (await widgets.setPhoto(photo)).ok : true;
        // T221: the copied photo (widget-photo.jpg) also joins "My widget art", so a Seamless widget
        // can show it via Edit Widget. Reuses the file setPhoto just wrote; a failure here is ignored.
        if (photo && photoOk) {
          await widgets.addToArtLibrary(
            { id: photoPieceId(photo), name: t('ui.seamless.library.photoName'), themeName: '', themeId: null, source: 'photo', created: Date.now(), aspect: 0, size: null },
            'widget-photo.jpg',
          );
        }
        if (!photoOk) {
          next = 'photoFailed';
        } else {
          if (!(await applyWidgetTheme(theme))) throw new Error('Widget theme could not reach the shared container');
          // The set plus the catalogue block, so a set-widget add never drops catalogue edits.
          const r = await widgets.setWidgetSet(studioCataloguePayload(lookSet, cat, state, { translate: (k) => tl(k) }));
          next = r.ok ? 'saved' : r.available ? 'failed' : 'preview';
        }
      }
    } catch {
      next = 'failed';
    } finally {
      setBusy(false);
    }
    setResult(next);
    // T81: the theme's apply checklist ticks its widgets step only when the studio saves.
    if (studioSaveTicksWidgets(next)) void tickStoredChecklist(theme.id, 'widgets');
    haptic(next === 'saved' ? 'success' : next === 'preview' ? 'select' : 'warning');
    const announce =
      next === 'saved'
        ? t('themeUi.widgetStudio.result.savedTitle')
        : next === 'preview'
          ? t('themeUi.widgetStudio.result.previewTitle')
          : next === 'photoFailed'
            ? t('themeUi.widgetStudio.result.photoFailed')
            : next === 'unsupported'
              ? t('themeUi.widgetStudio.result.unsupported')
              : next === 'updateRequired'
                ? t('themeUi.widgetStudio.result.updateRequired')
                : t('themeUi.widgetStudio.result.failed');
    AccessibilityInfo.announceForAccessibility(announce);
  };

  const body = (k: TextStyle) => [k, textStyleFor(script, k)];
  const eyebrow = eyebrowCaseFor(script);
  // T173: the preview's eyebrow line ("LIVE PREVIEW  Clock · Small"), read as one heading.
  const previewSubject = [kindName, sizeName].join(' · ');
  const previewHeading = [t('tabs.widgetsTab.studioPreview'), kindName, sizeName].join(', ');

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: t('themeUi.widgetStudio.title') }} />
      <ScrollView bounces={false} overScrollMode="never" stickyHeaderIndices={[0]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Live preview, pinned on top. */}
        <View style={[styles.previewWrap, { backgroundColor: c.bg }]}>
          <SquircleCard size="large" elevation="raised" tone="raised" outline={false} style={styles.previewCard}>
            {/* T173: a small eyebrow over the stage; VoiceOver hears "Live preview, Clock, Small" once. */}
            <View accessible accessibilityRole="header" accessibilityLabel={previewHeading} style={styles.previewHead}>
              <Text
                maxFontSizeMultiplier={fontScaleCap('eyebrow')}
                style={[...body(textV2.eyebrow), { letterSpacing: eyebrow.letterSpacing, color: c.tint }, eyebrow.upper ? styles.upper : null]}
              >
                {t('tabs.widgetsTab.studioPreview')}
              </Text>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...body(textV2.footnote), styles.flex, { color: c.inkSecondary }]}>
                {previewSubject}
              </Text>
            </View>
            <View style={[styles.previewStage, { backgroundColor: c.fill }]}>
              {catSpec ? (
                <CatalogueWidgetPreview
                  spec={catSpec}
                  width={previewW}
                  wallpaperUri={wallpaper.photoUri}
                  habitValue={widgetHabitValue(widgetHabits, catSpec.binding.habit)}
                  habitGoal={widgetHabitGoal(widgetHabits, catSpec.binding.habit)}
                  accessibilityLabel={t('themeUi.widgetStudio.previewA11y', { kind: kindName, size: sizeName })}
                />
              ) : (
                <WidgetPreview
                  spec={spec}
                  width={previewW}
                  photoUri={photoUri}
                  wallpaperUri={wallpaper.photoUri}
                  accessibilityLabel={t('themeUi.widgetStudio.previewA11y', { kind: kindName, size: sizeName })}
                />
              )}
            </View>
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...body(textV2.footnote), { color: c.inkSecondary }]}>{t('themeUi.widgetStudio.previewNote')}</Text>
            {catNotes.map((line) => (
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} key={line} style={[...body(textV2.footnote), styles.catNote, { color: c.inkSecondary }]}>
                {line}
              </Text>
            ))}
          </SquircleCard>
        </View>

        <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...body(textV2.callout), styles.intro, { color: c.inkSecondary }]}>{t('themeUi.widgetStudio.intro')}</Text>

        <InsetGroup header={t('themeUi.widgetStudio.kindLabel')}>
          <ChipRow
            label={t('themeUi.widgetStudio.kindLabel')}
            options={[
              ...kinds.map((k): ChipOption => ({ value: k, label: tl(widgetKindKey(k)) })),
              ...catalogueStudioKinds().map((k): ChipOption => ({ value: k, label: tl(catalogueKindKey(k)) })),
            ]}
            value={catOpen ? catOpen.kind : state.kind}
            onChange={(k) => change((s) => (isCatalogueKind(k) ? selectCatalogueWidget(s, k) : selectWidget(set, s, k as WidgetKind)))}
          />
          {catOpen ? (
            <ChipRow
              label={t('themeUi.widgetStudio.sizeLabel')}
              options={catalogueStudioSizes(catOpen.kind).map((z): ChipOption => ({ value: z, label: tl(catalogueSizeKey(z)) }))}
              value={catOpen.size}
              onChange={(z) => change((s) => (s.catalogue ? selectCatalogueWidget(s, s.catalogue.kind, z as CatalogueSize) : s))}
            />
          ) : (
            <ChipRow
              label={t('themeUi.widgetStudio.sizeLabel')}
              options={sizes.map((z): ChipOption => ({ value: z, label: tl(widgetSizeKey(z)) }))}
              value={state.size}
              onChange={(z) => change((s) => selectWidget(set, s, s.kind, z as WidgetSize))}
            />
          )}
        </InsetGroup>

        {bgOptions.length ? (
        <InsetGroup header={t('themeUi.widgetStudio.background.header')} footer={bgOptions.includes('photo') ? t('themeUi.widgetStudio.photo.private') : undefined}>
          <ChipRow
            label={t('themeUi.widgetStudio.background.label')}
            options={bgOptions.map((k) => ({ value: k, label: t(`themeUi.widgetStudio.background.${k}`), icon: BG_ICONS[k] }))}
            value={bgNow.kind === 'photo' && (catSpec || !spec.editable.photo) ? THEME_VALUE : bgNow.kind}
            onChange={(k) => void onBackground(k as StudioBackgroundKind)}
          />
          {bgNow.kind === 'colour' ? (
            <View style={styles.pad}>
              <Swatches
                label={t('themeUi.widgetStudio.colours.background')}
                swatches={swatchesFor(colourSwatches(set.tokens), tl, false)}
                value={bgNow.colour}
                onChange={(v) => patchOpen({ background: { kind: 'colour', colour: v } })}
              />
            </View>
          ) : null}
          {bgNow.kind === 'gradient' ? (
            <View style={styles.pad}>
              <Swatches
                label={t('themeUi.widgetStudio.colours.gradient')}
                swatches={swatchesFor(gradientSwatches(set.tokens), tl, true)}
                value={gradientValue(bgNow.from, bgNow.to)}
                onChange={(v) => {
                  const g = parseGradientValue(v);
                  if (g) patchOpen({ background: { kind: 'gradient', from: g.from, to: g.to } });
                }}
              />
            </View>
          ) : null}
          {!catSpec && spec.editable.photo && draft.background.kind === 'photo' ? (
            <View style={styles.pad}>
              <PillButton
                label={t('themeUi.widgetStudio.photo.change')}
                icon="image"
                variant="tinted"
                size="small"
                onPress={() => void onPickPhoto()}
              />
            </View>
          ) : null}
          {photoProblem ? (
            <View style={[styles.pad, styles.gap]}>
              <Text maxFontSizeMultiplier={fontScaleCap('subhead')} accessibilityLiveRegion="polite" style={[...body(textV2.subhead), { color: c.warn }]}>
                {photoProblem === 'denied' ? t('themeUi.widgetStudio.photo.denied') : t('themeUi.widgetStudio.photo.error')}
              </Text>
              {photoProblem === 'denied' ? (
                <PillButton label={t('themeUi.widgetStudio.photo.openSettings')} icon="settings" variant="tinted" size="small" onPress={openAppSettings} />
              ) : null}
            </View>
          ) : null}
        </InsetGroup>
        ) : null}

        {/* T65 / T85: theme / clear glass / tinted glass / glow, for every widget kind. Lock Screen
            sizes are tinted by iOS (no looks); StandBy is on black (theme or glow). */}
        {lookOptions.length > 1 ? (
          <InsetGroup header={t('themeUi.widgetStudio.look.header')} footer={lookFooter}>
            <ChipRow
              label={t('themeUi.widgetStudio.look.header')}
              options={lookOptions.map((l): ChipOption => ({ value: l, label: tl(widgetLookKey(l)) }))}
              value={lookNow}
              onChange={(l) =>
                change((s) => (s.catalogue ? updateCatalogueDraft(s, { look: l as WidgetLook }) : updateDraft(set, s, { look: l as WidgetLook })))
              }
            />
          </InsetGroup>
        ) : null}

        {showColours ? (
        <InsetGroup header={t('themeUi.widgetStudio.colours.header')}>
          <View style={[styles.pad, styles.gap]}>
            <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...body(textV2.subhead), { color: c.ink }]}>{t('themeUi.widgetStudio.colours.accent')}</Text>
            <Swatches
              label={t('themeUi.widgetStudio.colours.accent')}
              swatches={[
                { hex: set.tokens.accent, name: t('themeUi.widgetStudio.colours.themeDefault'), icon: 'star', value: THEME_VALUE },
                ...swatchesFor(colourSwatches(set.tokens), tl, false),
              ]}
              value={accentNow ?? THEME_VALUE}
              onChange={(v) => patchOpen({ accent: v === THEME_VALUE ? null : v })}
            />
            <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...body(textV2.subhead), { color: c.ink }]}>{t('themeUi.widgetStudio.colours.text')}</Text>
            <Swatches
              label={t('themeUi.widgetStudio.colours.text')}
              swatches={[
                { hex: set.tokens.ink, name: t('themeUi.widgetStudio.colours.themeDefault'), icon: 'star', value: THEME_VALUE },
                ...swatchesFor(colourSwatches(set.tokens), tl, false),
              ]}
              value={textColourNow ?? THEME_VALUE}
              onChange={(v) => patchOpen({ textColour: v === THEME_VALUE ? null : v })}
            />
          </View>
        </InsetGroup>
        ) : null}

        {showTextGroup ? (
          <InsetGroup header={t('themeUi.widgetStudio.text.header')}>
            <View style={[styles.pad, styles.gap]}>
              {regions.map((r, i) => {
                const label = t('themeUi.widgetStudio.text.field', { number: i + 1 });
                return (
                  <View key={r.id} style={styles.fieldGap}>
                    <TextInput
                      maxFontSizeMultiplier={fontScaleCap('body')}
                      value={textNow[r.id] ?? ''}
                      onChangeText={(v) => setOpenText(r.id, v)}
                      placeholder={r.key ? tl(r.key) : undefined}
                      placeholderTextColor={c.inkTertiary}
                      maxLength={r.maxLength > 0 ? r.maxLength : undefined}
                      accessibilityLabel={label}
                      accessibilityHint={t('themeUi.widgetStudio.text.limit', { max: r.maxLength })}
                      style={[...body(textV2.body), styles.input, continuous, { color: c.ink, backgroundColor: c.fill }]}
                    />
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...body(textV2.footnote), { color: c.inkSecondary }]}>{t('themeUi.widgetStudio.text.limit', { max: r.maxLength })}</Text>
                  </View>
                );
              })}
              {regions.some((r) => textNow[r.id]) ? (
                <PillButton
                  label={t('themeUi.widgetStudio.text.reset')}
                  variant="plain"
                  size="small"
                  icon="rotate-ccw"
                  onPress={resetOpenText}
                />
              ) : null}
              {showCountdown ? (
                <View style={styles.fieldGap}>
                  <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...body(textV2.subhead), { color: c.ink }]}>{t('themeUi.widgetStudio.countdown.header')}</Text>
                  <TextInput
                    maxFontSizeMultiplier={fontScaleCap('body')}
                    value={countdownText}
                    onChangeText={(v) => {
                      setCountdownText(v);
                      const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
                      if (ok || v === '') patchOpen({ countdownTo: v === '' ? null : v });
                    }}
                    placeholder={t('themeUi.widgetStudio.countdown.placeholder')}
                    placeholderTextColor={c.inkTertiary}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    accessibilityLabel={t('themeUi.widgetStudio.countdown.header')}
                    accessibilityHint={t('themeUi.widgetStudio.countdown.hint')}
                    style={[...body(textV2.body), styles.input, continuous, { color: c.ink, backgroundColor: c.fill }]}
                  />
                  <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...body(textV2.footnote), { color: c.inkSecondary }]}>
                    {countdownText !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(countdownText)
                      ? t('themeUi.widgetStudio.countdown.invalid')
                      : t('themeUi.widgetStudio.countdown.hint')}
                  </Text>
                </View>
              ) : null}
            </View>
          </InsetGroup>
        ) : null}

        {catSpec?.kind === 'photoAlbum' ? (
          <InsetGroup header={t('tabs.widgetsTab.studio.rotate')}>
            <ChipRow
              label={t('tabs.widgetsTab.studio.rotate')}
              options={rotateOptions().map((m): ChipOption => ({
                value: String(m),
                label: m % 60 === 0 ? t('tabs.widgetsTab.studio.hours', { n: formatNumber(m / 60) }) : t('tabs.widgetsTab.studio.minutes', { n: formatNumber(m) }),
              }))}
              value={String(catSpec.rotateMinutes)}
              onChange={(v) => change((s) => updateCatalogueDraft(s, { rotateMinutes: Number(v) }))}
            />
          </InsetGroup>
        ) : null}

        {catSpec ? null : (
        <InsetGroup header={t('themeUi.widgetStudio.font.header')}>
          <ChipRow
            label={t('themeUi.widgetStudio.font.header')}
            options={STUDIO_FONTS.map((f) => ({
              value: f,
              label: tl(fontLabelKey(f)),
              fontStyle: displayFontStyle((f === 'theme' ? spec.tokens.typeface : f) as DisplayFont) ?? undefined,
            }))}
            value={draft.font}
            onChange={(f) => change((s) => updateDraft(set, s, { font: f as StudioFont }))}
          />
        </InsetGroup>
        )}

        {catSpec ? null : (
        <InsetGroup header={t('themeUi.widgetStudio.size.header')}>
          <View style={styles.pad}>
            <ScaleSlider value={draft.scalePct} onChange={(v) => change((s) => updateDraft(set, s, { scalePct: v }))} />
          </View>
        </InsetGroup>
        )}

        {issueLines.length ? (
          <View style={[styles.note, continuous, { backgroundColor: c.pastels.butter.fill }]} accessibilityLiveRegion="polite">
            <Feather name="info" size={18} color={c.pastels.butter.ink} />
            <View style={[styles.flex, styles.gap]}>
              {issueLines.map((line) => (
                <Text maxFontSizeMultiplier={fontScaleCap('subhead')} key={line} style={[...body(textV2.subhead), { color: c.pastels.butter.ink }]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {result ? <ResultCard result={result} /> : null}

        {!nativeWidgetSupported(catSpec?.kind ?? spec.kind, catSpec?.size ?? spec.size) ? (
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...body(textV2.footnote), styles.intro, { color: c.inkSecondary }]}>
            {t('themeUi.widgetStudio.result.unsupported')}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <PillButton
            label={busy ? t('themeUi.widgetStudio.add.busy') : t('themeUi.widgetStudio.add.cta')}
            icon={locked ? 'lock' : 'plus-circle'}
            block
            busy={busy}
            onPress={() => void onAdd()}
            accessibilityHint={t('themeUi.widgetStudio.add.hint')}
          />
          {hasDraft ? (
            <PillButton
              label={t('themeUi.widgetStudio.reset')}
              variant="plain"
              icon="rotate-ccw"
              onPress={() => {
                setCountdownText('');
                change((s) => (s.catalogue ? resetCatalogueDraft(s) : resetDraft(set, s)));
              }}
            />
          ) : null}
        </View>
      </ScrollView>
      {wallpaper.probe}
      <PlusLockSheet
        visible={lockOpen}
        onClose={() => setLockOpen(false)}
        subject={theme.name}
        onUnlocked={() => setLockOpen(false)}
      />
    </View>
  );
}

function ResultCard({ result }: { result: Exclude<AddResult, null> }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const title =
    result === 'saved'
      ? t('themeUi.widgetStudio.result.savedTitle')
      : result === 'preview'
        ? t('themeUi.widgetStudio.result.previewTitle')
        : null;
  const text =
    result === 'saved'
      ? t('themeUi.widgetStudio.result.savedBody')
      : result === 'preview'
        ? t('themeUi.widgetStudio.result.previewBody')
        : result === 'unsupported'
        ? t('themeUi.widgetStudio.result.unsupported')
        : result === 'updateRequired'
          ? t('themeUi.widgetStudio.result.updateRequired')
      : result === 'photoFailed'
          ? t('themeUi.widgetStudio.result.photoFailed')
          : t('themeUi.widgetStudio.result.failed');
  const tone = result === 'saved' ? c.pastels.mint : result === 'preview' ? c.pastels.sky : c.pastels.peach;
  const icon: FeatherName = result === 'saved' ? 'check-circle' : result === 'preview' ? 'eye' : 'alert-circle';
  return (
    <View style={[styles.note, continuous, { backgroundColor: tone.fill }]} accessibilityLiveRegion="polite">
      <Feather name={icon} size={20} color={tone.ink} />
      <View style={[styles.flex, styles.gap]}>
        {title ? <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[textV2.headline, textStyleFor(script, textV2.headline), { color: tone.ink }]}>{title}</Text> : null}
        <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[textV2.subhead, textStyleFor(script, textV2.subhead), { color: tone.ink }]}>{text}</Text>
      </View>
    </View>
  );
}

type ChipOption = { value: string; label: string; icon?: FeatherName; fontStyle?: TextStyle };

/** Wrapping row of pill chips acting as one radio group (≥ 48 pt targets). */
function ChipRow({ label, options, value, onChange }: { label: string; options: ChipOption[]; value: string; onChange: (v: string) => void }) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.chips, styles.pad]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => {
              haptic('select');
              onChange(o.value);
            }}
            style={({ pressed }) => [
              styles.chip,
              continuous,
              { backgroundColor: selected ? c.tint : c.fill, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {o.icon ? <Feather name={o.icon} size={16} color={selected ? c.onTint : c.ink} /> : null}
            <Text
              maxFontSizeMultiplier={fontScaleCap('subhead')}
              style={[
                textV2.subhead,
                textStyleFor(script, textV2.subhead),
                o.fontStyle && script === 'latin' ? o.fontStyle : null,
                { color: selected ? c.onTint : c.ink },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Stepped text-size slider (70–130 %, 5 % steps): −/+ pills and a tappable track. */
function ScaleSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const [trackW, setTrackW] = useState(0);
  const pct = clampScale(value);
  const label = t('themeUi.widgetStudio.size.value', { percent: formatNumber(pct) });
  const set = (v: number) => {
    const next = clampScale(v);
    if (next !== pct) {
      haptic('select');
      onChange(next);
    }
  };
  const onTrack = (e: GestureResponderEvent) => {
    if (trackW > 0) set(scaleFromFraction(e.nativeEvent.locationX / trackW));
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') set(stepScale(pct, 1));
    if (e.nativeEvent.actionName === 'decrement') set(stepScale(pct, -1));
  };
  const f = fractionOfScale(pct);
  return (
    <View style={styles.sliderRow}>
      <PillButton label={t('themeUi.widgetStudio.size.smaller')} icon="minus" variant="tinted" size="small" onPress={() => set(stepScale(pct, -1))} />
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={t('themeUi.widgetStudio.size.header')}
        accessibilityValue={{ min: 70, max: 130, now: pct, text: label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        onPress={onTrack}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        style={[styles.track, { direction: 'ltr' }]}
      >
        <View style={[styles.trackLine, { backgroundColor: c.fill }]}>
          <View style={{ flex: f, backgroundColor: c.tint, borderRadius: chromeRadiusV2.pill }} />
          <View style={{ flex: 1 - f }} />
        </View>
        <View pointerEvents="none" style={[styles.thumb, { start: Math.max(0, f * trackW - 12), backgroundColor: c.surface, borderColor: c.tint }]} />
      </Pressable>
      <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[textV2.headline, textStyleFor(script, textV2.headline), styles.sliderValue, { color: c.ink }]}>{label}</Text>
      <PillButton label={t('themeUi.widgetStudio.size.larger')} icon="plus" variant="tinted" size="small" onPress={() => set(stepScale(pct, 1))} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { flex: 1, padding: spaceV2.lg, gap: spaceV2.md, justifyContent: 'center' },
  content: { paddingBottom: spaceV2.xxxl, gap: spaceV2.lg },
  previewWrap: { paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.md, paddingBottom: spaceV2.sm },
  previewCard: { alignSelf: 'stretch' },
  previewHead: { flexDirection: 'row', alignItems: 'baseline', gap: spaceV2.sm, marginBottom: spaceV2.sm },
  upper: { textTransform: 'uppercase' },
  previewStage: { alignItems: 'center', justifyContent: 'center', borderRadius: chromeRadiusV2.card, paddingVertical: spaceV2.lg, marginBottom: spaceV2.sm },
  intro: { paddingHorizontal: spaceV2.inset },
  pad: { paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md },
  gap: { gap: spaceV2.sm },
  fieldGap: { gap: spaceV2.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  chip: {
    minHeight: sizeV2.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    paddingHorizontal: spaceV2.lg,
    borderRadius: chromeRadiusV2.pill,
  },
  input: { minHeight: sizeV2.touch, borderRadius: chromeRadiusV2.control, paddingHorizontal: spaceV2.md, paddingVertical: spaceV2.sm },
  note: { flexDirection: 'row', gap: spaceV2.sm, padding: spaceV2.lg, borderRadius: chromeRadiusV2.card, marginHorizontal: spaceV2.lg, alignItems: 'flex-start' },
  actions: { paddingHorizontal: spaceV2.lg, gap: spaceV2.sm },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, flexWrap: 'wrap' },
  track: { flex: 1, minWidth: 120, minHeight: sizeV2.touch, justifyContent: 'center' },
  trackLine: { height: 6, borderRadius: chromeRadiusV2.pill, flexDirection: 'row', overflow: 'hidden' },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: circleRadius(24), borderWidth: 2 },
  sliderValue: { minWidth: 56, textAlign: 'center' },
  catNote: { marginTop: spaceV2.xs },
});
