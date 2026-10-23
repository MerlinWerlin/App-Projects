// Prepare (PLAN §3 /prepare, DESIGN_V2 §7, MARKET "Design reference 18 Oct" §2–3; T76 on v2 glass): large title,
// the Pick image → Outline → Trace step indicator, the preview in a white bubble card, Original / Outline as a pill
// segmented control, and the outline controls on a soft pastel panel (style as pill chips, sliders + invert in a
// white inset card, background and photo kind). Rotate is a secondary pill; "Start tracing" is the one big primary
// pill on a glass bottom bar. Behaviour, params and the outline pipeline calls are unchanged from v1.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useThemeV2 } from '../src/theme/useTheme';
import { dark, light, tabular } from '../src/theme/tokens';
import { elevationV2, gutterFor, maxFontScaleV2, radiusV2, spaceV2 } from '../src/theme/tokensV2';
import { select, success, tap } from '../src/native/haptics';
import { isAbortError, type OutlineResult } from '../src/native/outlinePipeline';
import { getOutlinePipeline, rotateImage } from '../src/native/outlineDeps';
import { LabeledSlider } from '../src/ui/LabeledSlider';
import {
  BAR_HEIGHT,
  BubbleCard,
  GlassBar,
  InsetGroup,
  InsetRow,
  LargeTitle,
  LargeTitleHeader,
  PillButton,
  ScreenV2,
  StepIndicator,
  useLargeTitleScroll,
} from '../src/ui/v2';
import { PillSegmented } from '../src/ui/v2/PillSegmented';
import { PillChip } from '../src/ui/v2/PillChip';
import { squircle } from '../src/ui/v2/shared';
import { Skeleton } from '../src/ui/Skeleton';
import { ImageErrorBoundary, ImageErrorMessage } from '../src/ui/ImageErrorBoundary';
import { classifyImageError, type ImageErrorKind } from '../src/core/imageErrors';
import { pickPhotoFromLibrary } from '../src/native/photoPick';
import { FadeIn, RevealImage, type RevealMode } from '../src/ui/RevealImage';
import {
  BACKGROUNDS,
  KINDS,
  PRESETS,
  kindLabel,
  matchesPreset,
  presetSettings,
  roundThickness,
  thicknessName,
  usesKindAndBackground,
  type OutlineSettings,
  type PresetId,
  type ThicknessName,
} from '../src/core/outlinePresets';
import { presetForStyle } from '../src/core/outlineStyleParam';
import { loadSettings } from '../src/native/settings';

import { t as tNow, useT, type I18n } from '../src/i18n';
import { backArrow } from '../src/i18n/direction';
import type { MessageKey } from '../src/i18n/en/index';
import { THICKNESS_MAX, THICKNESS_MIN, type BackgroundMode, type PhotoKind } from '../src/core/outline';
import { PREVIEW_PX, makeLatestJobs } from '../src/core/preview';
import { usePlus } from '../src/plus/usePlus';
import { outlineLocked } from '../src/plus/access';

type Mode = 'original' | 'outline';
type Shown = { uri: string; w?: string; h?: string };
type Rotated = Shown & { turns: number };

const DEBOUNCE_MS = 250;
// Waits shorter than this show no skeleton (avoids a flash) (docs/POLISH.md rule 5).
const SKELETON_DELAY_MS = 300;
/** Padding between the preview card's edge and the image frame. */
const CARD_PAD = spaceV2.x2;
/** Inner padding of the pastel controls panel. */
const PANEL = spaceV2.x4;
function modes(t: I18n['t']) {
  return [
    { value: 'original', label: t('prepare.mode.original'), accessibilityHint: t('prepare.mode.originalHint') },
    { value: 'outline', label: t('prepare.mode.outline'), accessibilityHint: t('prepare.mode.outlineHint') },
  ] as const;
}

const THICKNESS_KEYS: Record<ThicknessName, MessageKey> = {
  hairline: 'prepare.thickness.hairline',
  fine: 'prepare.thickness.fine',
  medium: 'prepare.thickness.medium',
  bold: 'prepare.thickness.bold',
  extraBold: 'prepare.thickness.extraBold',
};

/** Translated photo-kind name (core ids, English label as fallback). */
function kindName(tDynamic: I18n['tDynamic'], k: PhotoKind): string {
  return tDynamic(`prepare.kind.${k}`, kindLabel(k));
}

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s !== 'undefined' ? s : undefined;
}

/** Translated error message, with the technical detail from the pipeline in brackets when there is one. */
function messageOf(e: unknown, message: string): string {
  return e instanceof Error && e.message ? tNow('prepare.error.withDetail', { message, detail: e.message }) : message;
}

// T48: a render error anywhere on the screen shows the friendly image message, never a red error screen.
export default function PrepareRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string }>();
  return (
    <ImageErrorBoundary fullScreen resetKey={str(params.uri)} onGoBack={() => router.back()}>
      <PrepareScreen />
    </ImageErrorBoundary>
  );
}

function PrepareScreen() {
  const { c, isDark, text } = useThemeV2();
  const { t, tDynamic, num, percent } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const gutter = gutterFor(width);
  const { scrollY, onScroll } = useLargeTitleScroll();
  const params = useLocalSearchParams<{ uri?: string; w?: string; h?: string; template?: string }>();
  const srcUri = str(params.uri) ?? '';
  const srcW = str(params.w);
  const srcH = str(params.h);
  const isTemplate = str(params.template) === '1';
  const canRotate = !/\.svg($|[?#])/i.test(srcUri);

  const [mode, setMode] = useState<Mode>('original');
  const { access } = usePlus();
  const [turns, setTurns] = useState(0);

  // Original (possibly rotated).
  const [original, setOriginal] = useState<Rotated | null>(srcUri ? { uri: srcUri, w: srcW, h: srcH, turns: 0 } : null);
  const [rotating, setRotating] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [originalNonce, setOriginalNonce] = useState(0);
  // T48: what kind of image problem the current error is (friendly message), and a failed "Try another photo".
  const [originalKind, setOriginalKind] = useState<ImageErrorKind>('unknown');
  const [outlineKind, setOutlineKind] = useState<ImageErrorKind>('unknown');
  const [pickKind, setPickKind] = useState<ImageErrorKind | null>(null);
  const picking = useRef(false);

  // Outline settings: a preset fills all of them; slider values follow the finger and are
  // committed on release. `settings` (committed) drives the pipeline.
  const [preset, setPreset] = useState<PresetId | 'custom'>('best');
  const [settings, setSettings] = useState<OutlineSettings>(() => presetSettings('best'));
  const [detail, setDetail] = useState(settings.detail);
  const [thickness, setThickness] = useState(settings.thickness);
  const [invert, setInvert] = useState(false);
  // What 'auto' found in this photo (from the first outline run).
  const [detected, setDetected] = useState<{ kind: Exclude<PhotoKind, 'auto'>; faces: number } | null>(null);

  const [outlineResult, setOutlineResult] = useState<OutlineResult | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [outlineNonce, setOutlineNonce] = useState(0);
  // Quick-preview stage (D7-1): 'preview' = small render in progress, 'full' = refining.
  const [phase, setPhase] = useState<'idle' | 'preview' | 'full'>('idle');
  const [previewResult, setPreviewResult] = useState<OutlineResult | null>(null);
  const jobs = useRef(makeLatestJobs());
  // Last 25 % step announced to VoiceOver for the current outline run (iOS has no live regions).
  const announcedStep = useRef(0);
  // T32: set by a user change in Outline mode; the next full-quality result plays one success haptic.
  const userChanged = useRef(false);

  // Rotate the original whenever the turn count changes. Outline mode applies the turns in the
  // pipeline itself, so skip the work there; switching back to Original re-runs this (mode is a dep).
  const skipRotate = mode === 'outline' && !isTemplate;
  useEffect(() => {
    if (!srcUri) return;
    if (skipRotate) {
      setRotating(false);
      return;
    }
    let alive = true;
    setOriginalError(null);
    if (turns === 0) {
      setRotating(false);
      setOriginal({ uri: srcUri, w: srcW, h: srcH, turns: 0 });
      return;
    }
    setRotating(true);
    rotateImage(srcUri, turns)
      .then((r) => {
        if (alive) setOriginal({ uri: r.uri, w: String(r.width), h: String(r.height), turns });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setOriginalKind(classifyImageError(e));
        setOriginalError(messageOf(e, tNow('prepare.error.rotate')));
      })
      .finally(() => {
        if (alive) setRotating(false);
      });
    return () => {
      alive = false;
    };
  }, [srcUri, srcW, srcH, turns, originalNonce, skipRotate, mode]);

  // D7-1: 250 ms after settings settle, render a quick small preview (same engine, ~1/10 of the
  // pixels), show it with a "Refining…" badge, then swap in the full-size result. A newer change
  // aborts both stages of the older job (latest request wins).
  useEffect(() => {
    if (mode !== 'outline' || !srcUri) {
      setProgress(null);
      setPhase('idle');
      setPreviewResult(null);
      return;
    }
    const token = jobs.current.start();
    setOutlineError(null);
    setProgress(0);
    setPhase('preview');
    setPreviewResult(null);
    announcedStep.current = 0;
    let lastPct = 0;
    const onProgress = (p: number) => {
      const pct = Math.floor(p * 100);
      if (pct !== lastPct && jobs.current.isCurrent(token)) {
        lastPct = pct;
        setProgress(p);
        const step = Math.floor(pct / 25) * 25;
        if (Platform.OS === 'ios' && step > announcedStep.current) {
          announcedStep.current = step;
          AccessibilityInfo.announceForAccessibility(tNow('prepare.progress.announce', { percent: percent(step / 100) }));
        }
      }
    };
    const opts = { ...settings, invert, rotateTurns: turns };
    const timer = setTimeout(() => {
      const pipe = getOutlinePipeline();
      pipe
        .run(srcUri, { ...opts, previewPx: PREVIEW_PX }, onProgress, token)
        .then((pv) => {
          if (!jobs.current.isCurrent(token)) return null;
          if (pv.info) setDetected({ kind: pv.info.autoKind, faces: pv.info.faces });
          if (pv.preview) {
            setPreviewResult(pv);
            setPhase('full');
            lastPct = 0;
            announcedStep.current = 0;
            setProgress(0);
            return pipe.run(srcUri, opts, onProgress, token);
          }
          return pv; // small photo: the preview already is the full result
        })
        .then((r) => {
          if (!r || !jobs.current.isCurrent(token)) return;
          setOutlineResult(r);
          if (userChanged.current) {
            userChanged.current = false;
            success();
          }
          setPreviewResult(null);
          setPhase('idle');
          setProgress(null);
        })
        .catch((e: unknown) => {
          if (token.aborted || isAbortError(e)) return;
          setOutlineKind(classifyImageError(e));
          setOutlineError(messageOf(e, tNow('prepare.error.outline')));
          setPreviewResult(null);
          setPhase('idle');
          setProgress(null);
        });
    }, DEBOUNCE_MS);
    return () => {
      token.aborted = true;
      clearTimeout(timer);
    };
  }, [mode, srcUri, settings, invert, turns, outlineNonce]);

  // D72-1: start with the outline style chosen in Settings (default "Best match"), unless the user
  // has already picked something on this screen.
  useEffect(() => {
    let alive = true;
    loadSettings()
      .then((s) => {
        if (!alive || userChanged.current) return;
        const id = presetForStyle(s.outlineStyle);
        if (id === 'best') return;
        const next = presetSettings(id);
        setPreset(id);
        setSettings(next);
        setDetail(next.detail);
        setThickness(next.thickness);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // "Best match" follows what the photo turned out to be (e.g. a portrait gets the portrait setup).
  useEffect(() => {
    if (!detected || preset !== 'best') return;
    const best = presetSettings('best', detected.kind);
    if (!matchesPreset(settings, 'best', detected.kind)) {
      setSettings(best);
      setDetail(best.detail);
      setThickness(best.thickness);
    }
  }, [detected, preset, settings]);

  const applyPreset = useCallback(
    (id: PresetId) => {
      select();
      userChanged.current = true;
      const next = presetSettings(id, detected?.kind);
      setPreset(id);
      setSettings(next);
      setDetail(next.detail);
      setThickness(next.thickness);
    },
    [detected],
  );

  // Any manual change keeps the other settings and shows "Custom" unless it equals the preset.
  const change = useCallback(
    (patch: Partial<OutlineSettings>) => {
      userChanged.current = true;
      setSettings((cur) => {
        const next = { ...cur, ...patch };
        setPreset((p) => (p !== 'custom' && matchesPreset(next, p, detected?.kind) ? p : 'custom'));
        return next;
      });
    },
    [detected],
  );

  // Free the decoded source when leaving the screen.
  useEffect(
    () => () => {
      jobs.current.cancel();
      getOutlinePipeline().clear();
    },
    [],
  );

  const rotate = useCallback(() => {
    select();
    if (mode === 'outline') userChanged.current = true;
    setTurns((t) => (t + 1) % 4);
  }, [mode]);

  const outlineMode = mode === 'outline' && !isTemplate;
  const busy = outlineMode ? progress !== null : rotating;
  const error = outlineMode ? outlineError : originalError;
  const chosen: Shown | null = outlineMode
    ? outlineResult
      ? { uri: outlineResult.uri, w: String(outlineResult.width), h: String(outlineResult.height) }
      : null
    : original;
  const ready = !!chosen && !busy && !error;

  const startTracing = useCallback(() => {
    if (!chosen) return;
    tap();
    const p: Record<string, string> = { uri: chosen.uri };
    if (chosen.w) p.w = chosen.w;
    if (chosen.h) p.h = chosen.h;
    // Sketch steps on /trace re-outline the original photo the same way (T10).
    if (outlineMode) {
      p.src = srcUri;
      p.turns = String(turns);
      if (invert) p.invert = '1';
      p.kind = settings.kind;
      p.bg = settings.background;
      // T54: the steps use the same line engine (Sketch / Line art / Bold) as this outline.
      p.style = settings.style ?? 'classic';
    }
    router.push({ pathname: '/trace', params: p });
  }, [chosen, router, outlineMode, srcUri, turns, invert, settings]);

  const retry = useCallback(() => {
    tap();
    if (outlineMode) {
      userChanged.current = true;
      setOutlineNonce((n) => n + 1);
    } else setOriginalNonce((n) => n + 1);
  }, [outlineMode]);

  // T48: "Try another photo" re-opens the library and replaces this screen with the new photo.
  const tryAnother = useCallback(() => {
    if (picking.current) return;
    picking.current = true;
    tap();
    setPickKind(null);
    pickPhotoFromLibrary()
      .then((p) => {
        if (p) router.replace({ pathname: '/prepare', params: { uri: p.uri } });
      })
      .catch((e: unknown) => setPickKind(classifyImageError(e)))
      .finally(() => {
        picking.current = false;
      });
  }, [router]);
  const goBack = useCallback(() => router.back(), [router]);

  // T32: with no outline to show yet, a wait over SKELETON_DELAY_MS shows the shimmer in the frame. The
  // skeleton (and the faded original) stay underneath until the first result has finished its wipe reveal.
  const waiting = outlineMode && !(previewResult ?? outlineResult) && !error;
  const [skeleton, setSkeleton] = useState(false);
  const [holdUnder, setHoldUnder] = useState(false);
  useEffect(() => {
    if (waiting) {
      setHoldUnder(true);
      const t = setTimeout(() => setSkeleton(true), SKELETON_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (!outlineMode || error) {
      setHoldUnder(false);
      setSkeleton(false);
    }
  }, [waiting, outlineMode, error]);
  const onRevealEnd = useCallback(() => {
    setHoldUnder(false);
    setSkeleton(false);
  }, []);

  // T76: the glass bottom bar floats over the scroll content; its measured height pads the content.
  const [barH, setBarH] = useState(0);
  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setBarH((cur) => (cur === h ? cur : h));
  }, []);

  if (!srcUri) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenV2 title={t('common.nav.prepare')} onBack={goBack}>
          <BubbleCard padding={spaceV2.x5}>
            <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('body'), { color: c.graphite }]}>
              {t('prepare.noImage')}
            </Text>
            <PillButton
              title={t('prepare.goBack')}
              variant="secondary"
              icon={backArrow()}
              block
              onPress={goBack}
              style={{ marginTop: spaceV2.x5 }}
            />
          </BubbleCard>
        </ScreenV2>
      </>
    );
  }

  // Light lines need dark paper behind them to be visible; everything else previews on light paper.
  const darkPaper = outlineMode && invert;
  const paperA = darkPaper ? dark.card : light.card;
  const paperB = darkPaper ? dark.line : light.paper;
  // While the first outline renders, show the original underneath only if it matches the current rotation.
  const placeholderUri = original && original.turns === turns ? original.uri : undefined;
  const pct = progress === null ? 0 : Math.round(progress * 100);
  // Newest outline to show: the quick preview while refining, else the last full result.
  const shownOutline = previewResult ?? outlineResult;
  const previewUri = outlineMode ? shownOutline?.uri : original?.uri;
  // Under the first outline: the faded original, covered by the shimmer once the wait passes 300 ms.
  const underlay = outlineMode && (!shownOutline || holdUnder);
  // T32 reveal: the full result (and the first quick preview over the skeleton) wipes in like a pencil
  // sketch; a quick preview replacing an outline already on screen cross-fades.
  const reveal: RevealMode = !outlineMode ? 'fade' : previewResult ? (holdUnder ? 'wipe' : 'fade') : 'wipe';
  // With an outline already on screen, progress is a small corner badge instead of a cover.
  const badge = outlineMode && busy && !!shownOutline;
  const pctText = percent(pct / 100);
  const badgeText = phase === 'full' ? t('prepare.progress.refining', { percent: pctText }) : t('prepare.progress.updating');
  const presetDescription =
    preset === 'custom'
      ? t('prepare.preset.customDescription')
      : tDynamic(`prepare.preset.${preset}.description`, PRESETS.find((p) => p.id === preset)?.description ?? '');
  const found = detected
    ? detected.faces
      ? t('prepare.foundFaces', { kind: kindName(tDynamic, detected.kind), count: detected.faces })
      : t('prepare.found', { kind: kindName(tDynamic, detected.kind) })
    : null;
  const backgroundName = (id: BackgroundMode) =>
    tDynamic(`prepare.background.${id}.name`, BACKGROUNDS.find((b) => b.id === id)?.label ?? id);
  const backgroundHint = (id: BackgroundMode) =>
    tDynamic(`prepare.background.${id}.hint`, BACKGROUNDS.find((b) => b.id === id)?.hint ?? '');
  const previewH = Math.round(Math.min(width - gutter * 2 - CARD_PAD * 2, height * 0.46));
  // Section labels on the pastel panel (iOS group-header style).
  const sectionLabel = [text('footnote'), { color: c.muted, fontWeight: '600' as const, textTransform: 'uppercase' as const }];
  // A pill surface (badge / progress cover) over the preview.
  const pillSurface = [
    squircle,
    elevationV2('e1', isDark),
    { flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: radiusV2.pill, backgroundColor: c.card },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: insets.top + BAR_HEIGHT,
          paddingHorizontal: gutter,
          paddingBottom: barH + spaceV2.x6,
        }}
      >
        <LargeTitle title={t('common.nav.prepare')} scrollY={scrollY} />
        {/* T83: where we are in the photo flow (Pick image done → Outline current → Trace). */}
        <StepIndicator
          labels={[t('common.steps.pick'), t('common.steps.outline'), t('common.steps.trace')]}
          current={1}
          style={{ marginTop: spaceV2.x2, marginBottom: spaceV2.x5 }}
        />
        {/* Preview, in a white bubble card */}
        <ImageErrorBoundary
          resetKey={`${srcUri}|${mode}|${turns}`}
          onTryAnother={isTemplate ? undefined : tryAnother}
          onGoBack={goBack}
        >
          <BubbleCard padding={CARD_PAD} radius="lg">
            <View
              style={[
                squircle,
                {
                  height: previewH,
                  borderRadius: radiusV2.lg - CARD_PAD,
                  overflow: 'hidden',
                  backgroundColor: paperA,
                },
              ]}
            >
              {/* The image, its reveal wipe and the paper pattern are never mirrored in right-to-left languages. */}
              <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={StyleSheet.absoluteFill}
                >
                  <Svg width="100%" height="100%">
                    <Defs>
                      <Pattern id="paper" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                        <Rect x="0" y="0" width="24" height="24" fill={paperA} />
                        <Rect x="0" y="0" width="12" height="12" fill={paperB} />
                        <Rect x="12" y="12" width="12" height="12" fill={paperB} />
                      </Pattern>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#paper)" />
                  </Svg>
                </View>
                {underlay && placeholderUri ? (
                  <Image
                    source={{ uri: placeholderUri }}
                    resizeMode="contain"
                    accessible={!shownOutline}
                    accessibilityRole="image"
                    accessibilityLabel={t('prepare.preview.outline')}
                    style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: 0.35 }]}
                  />
                ) : null}
                {underlay && skeleton ? (
                  <FadeIn style={StyleSheet.absoluteFill}>
                    <Skeleton radius={0} style={StyleSheet.absoluteFill} />
                  </FadeIn>
                ) : null}
                <RevealImage
                  uri={previewUri}
                  reveal={reveal}
                  accessibilityLabel={t(outlineMode ? 'prepare.preview.outline' : 'prepare.preview.image')}
                  edgeColor={darkPaper ? dark.graphite : light.graphite}
                  onRevealEnd={onRevealEnd}
                />
              </View>
              {badge ? (
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={t(phase === 'full' ? 'prepare.progress.refiningLabel' : 'prepare.progress.updatingLabel')}
                  accessibilityValue={phase === 'full' ? { min: 0, max: 100, now: pct } : undefined}
                  style={[
                    pillSurface,
                    { position: 'absolute', top: spaceV2.x2, end: spaceV2.x2, paddingHorizontal: spaceV2.x3, paddingVertical: spaceV2.x1 + 2 },
                  ]}
                >
                  <ActivityIndicator size="small" color={c.ink} />
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={[text('footnote'), tabular, { fontWeight: '600', color: c.graphite, marginStart: spaceV2.x2 }]}
                  >
                    {badgeText}
                  </Text>
                </View>
              ) : busy && (!outlineMode || skeleton) ? (
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={t(outlineMode ? 'prepare.progress.makingLabel' : 'prepare.progress.rotatingLabel')}
                  accessibilityValue={outlineMode ? { min: 0, max: 100, now: pct } : undefined}
                  accessibilityLiveRegion="polite"
                  style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
                >
                  <View style={[pillSurface, { paddingHorizontal: spaceV2.x5, paddingVertical: spaceV2.x3 }]}>
                    <ActivityIndicator color={c.ink} />
                    <Text
                      maxFontSizeMultiplier={maxFontScaleV2}
                      style={[text('subhead'), tabular, { fontWeight: '600', color: c.graphite, marginStart: spaceV2.x2, flexShrink: 1 }]}
                    >
                      {outlineMode ? t('prepare.progress.making', { percent: pctText }) : t('prepare.progress.rotating')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </BubbleCard>
        </ImageErrorBoundary>

        {/* Error (T48: friendly message for what went wrong and what to try) */}
        {error || pickKind ? (
          <ImageErrorMessage
            kind={pickKind ?? (outlineMode ? outlineKind : originalKind)}
            onRetry={pickKind ? undefined : retry}
            onTryAnother={isTemplate ? undefined : tryAnother}
            onGoBack={goBack}
            style={{ marginTop: spaceV2.x4 }}
          />
        ) : null}

        {/* Mode: Original / Outline (the segment plays the selection tick) */}
        {isTemplate ? null : (
          <PillSegmented<Mode>
            options={modes(t)}
            value={mode}
            onChange={(m) => {
              // Outline mode is part of Linework Plus after the 14-day trial (owner decision 22 Oct 2026).
              if (m === 'outline' && outlineLocked(access)) {
                router.push('/plus');
                return;
              }
              setMode(m);
            }}
            accessibilityLabel={t('prepare.mode.label')}
            style={{ marginTop: spaceV2.x5 }}
          />
        )}

        {/* Outline controls on a soft pastel panel behind white cards */}
        {outlineMode ? (
          <View style={[squircle, { marginTop: spaceV2.x5, padding: PANEL, borderRadius: radiusV2.lg, backgroundColor: c.pastels[0] }]}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={sectionLabel}>
              {t('prepare.style')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityRole="tablist"
              style={{ marginHorizontal: -PANEL, marginTop: spaceV2.x2 }}
              contentContainerStyle={{ paddingHorizontal: PANEL, gap: spaceV2.x2, paddingVertical: spaceV2.x1 }}
            >
              {PRESETS.map((p) => (
                <PillChip
                  key={p.id}
                  role="tab"
                  label={tDynamic(`prepare.preset.${p.id}.name`, p.label)}
                  active={preset === p.id}
                  onPress={() => applyPreset(p.id)}
                  accessibilityHint={tDynamic(`prepare.preset.${p.id}.description`, p.description)}
                />
              ))}
              {preset === 'custom' ? (
                <PillChip
                  role="tab"
                  label={t('prepare.preset.custom')}
                  active
                  onPress={() => undefined}
                  accessibilityHint={t('prepare.preset.customHint')}
                />
              ) : null}
            </ScrollView>
            <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.muted, marginTop: spaceV2.x2 }]}>
              {found ? t('prepare.descriptionFound', { description: presetDescription, found }) : presetDescription}
            </Text>

            {/* Sliders (LabeledSlider with its pop-up value bubble) and invert, in one white inset card */}
            <InsetGroup style={{ marginTop: spaceV2.x4, marginBottom: 0 }}>
              <SliderCell>
                <LabeledSlider
                  label={t('prepare.detail')}
                  value={detail}
                  min={0}
                  max={1}
                  onChange={setDetail}
                  onComplete={(v) => change({ detail: v })}
                  formatValue={(v) => percent(v)}
                  accessibilityHint={t('prepare.detailHint')}
                />
              </SliderCell>
              <SliderCell>
                <LabeledSlider
                  label={t('prepare.thickness')}
                  value={thickness}
                  min={THICKNESS_MIN}
                  max={THICKNESS_MAX}
                  step={0.25}
                  onChange={setThickness}
                  onComplete={(v) => change({ thickness: v })}
                  formatValue={(v) =>
                    t('prepare.thickness.value', {
                      px: num(roundThickness(v), { maximumFractionDigits: 2 }),
                      name: t(THICKNESS_KEYS[thicknessName(v)]),
                    })
                  }
                  accessibilityHint={t('prepare.thicknessHint')}
                />
              </SliderCell>
              {/* The row is the accessible switch and plays the selection tick. */}
              <InsetRow
                title={t('prepare.invert')}
                subtitle={t('prepare.invertSub')}
                icon="moon"
                iconFill={c.pastels[4]}
                value={invert}
                onValueChange={(v) => {
                  userChanged.current = true;
                  setInvert(v);
                }}
                accessibilityLabel={t('prepare.invertLabel')}
              />
            </InsetGroup>

            {/* T49: Sketch / Line art / Bold lines trace the whole picture, so photo kind and background don't apply. */}
            {usesKindAndBackground(settings) ? (
              <View>
                <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[sectionLabel, { marginTop: spaceV2.x5 }]}>
                  {t('prepare.background')}
                </Text>
                {/* The segment plays the selection tick. */}
                <PillSegmented<BackgroundMode>
                  options={BACKGROUNDS.map((b) => ({
                    value: b.id,
                    label: backgroundName(b.id),
                    accessibilityLabel: t('prepare.background.option', { name: backgroundName(b.id), hint: backgroundHint(b.id) }),
                  }))}
                  value={settings.background}
                  onChange={(v) => change({ background: v })}
                  accessibilityLabel={t('prepare.background')}
                  style={{ marginTop: spaceV2.x2, backgroundColor: c.card }}
                />
                <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.muted, marginTop: spaceV2.x2 }]}>
                  {backgroundHint(settings.background)}
                </Text>

                <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[sectionLabel, { marginTop: spaceV2.x5 }]}>
                  {t('prepare.kind')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  accessibilityRole="tablist"
                  style={{ marginHorizontal: -PANEL, marginTop: spaceV2.x2 }}
                  contentContainerStyle={{ paddingHorizontal: PANEL, gap: spaceV2.x2, paddingVertical: spaceV2.x1 }}
                >
                  {KINDS.map((k) => (
                    <PillChip
                      key={k.id}
                      role="tab"
                      label={
                        k.id === 'auto' && detected
                          ? t('prepare.kind.autoDetected', { kind: kindName(tDynamic, detected.kind) })
                          : kindName(tDynamic, k.id)
                      }
                      active={settings.kind === k.id}
                      onPress={() => {
                        select();
                        change({ kind: k.id });
                      }}
                      accessibilityHint={tDynamic(`prepare.kind.${k.id}.hint`, k.label)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}

        {canRotate ? (
          <PillButton
            title={t('prepare.rotate')}
            variant="secondary"
            icon="rotate-cw"
            block
            haptic="none"
            onPress={rotate}
            accessibilityLabel={t('prepare.rotateLabel')}
            style={{ marginTop: spaceV2.x5 }}
          />
        ) : null}
      </Animated.ScrollView>

      {/* Start tracing: one big primary pill on a glass bar (startTracing plays the tap haptic). */}
      <View onLayout={onBarLayout} style={{ position: 'absolute', start: 0, end: 0, bottom: 0 }}>
        <GlassBar edge="top" style={{ paddingHorizontal: gutter, paddingTop: spaceV2.x3, paddingBottom: Math.max(insets.bottom, spaceV2.x3) }}>
          <PillButton
            title={t('prepare.start')}
            icon="edit-3"
            haptic="none"
            onPress={startTracing}
            disabled={!ready}
            accessibilityHint={t(ready ? 'prepare.startHint' : 'prepare.startWait')}
          />
        </GlassBar>
      </View>

      <LargeTitleHeader title={t('common.nav.prepare')} scrollY={scrollY} onBack={goBack} />
    </View>
  );
}

// A non-row cell inside an InsetGroup (the sliders): same padding and inset hairline as the rows.
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
