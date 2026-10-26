// Theme detail, design v2 (docs/DESIGN_V2.md §9, docs/MARKET.md L2, T55): a large phone-shaped
// preview with a Home / Lock toggle and ONE primary button ("Apply this look") in a sticky glass
// bar at the bottom. A theme is one bundle (wallpaper + icons + matching widgets); the button
// starts the existing apply steps in place. Everything else (photo, wallpaper editing, shape,
// palette, matching widgets) sits below as quieter cards and inset rows.
import { Feather } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  CHECKLIST_ROWS,
  celebrationDue,
  checklistFor,
  checklistProgress,
  defaultOpenRow,
  freshChecklist,
  isComplete,
  markCelebrated,
  mergeTicks,
  resetChecklist,
  rowDone,
  rowParts,
  tickTask,
  widgetsStepMode,
  type ChecklistRow,
  type ChecklistState,
  type ChecklistTask,
  type WidgetsStepMode,
} from '../../src/core/applyChecklist';
import { contrastRatio, mix } from '../../src/core/colour';
import { DEFAULT_OVERLAY, defaultBackground, usesPhoto, type ThemeBackground } from '../../src/core/background';
import { photoCreditParams, wallpaperSourceFor, type WallpaperSource } from '../../src/core/photoPack';
import type { IconStyle } from '../../src/core/iconspec';
import { DEFAULT_TRANSFORM } from '../../src/core/photoCrop';
import { canApplyFromDetail, packDetailView, showsPackCard, wantsPackArtwork, type PackDetailView } from '../../src/core/packDetail';
import { getAnyTheme, packOf } from '../../src/core/plusThemes';
import { previewSpecs, type Theme } from '../../src/core/themes';
import { averageColour, sizeForScreen } from '../../src/core/wallpaper';
import { generateWidgetSet, widgetKindKey, widgetSizeKey, widgetSpecOf } from '../../src/core/widgetSets';
import { studioKinds, studioSizes } from '../../src/core/widgetStudio';
import { useT, type Script, type TFunction } from '../../src/i18n';
import { widgets } from '../../src/native/widgets';
import { PlusBadge } from '../../src/plus/PlusBadge';
import { PlusLockSheet } from '../../src/plus/PlusLockSheet';
import { useLocked } from '../../src/plus/useLocked';
import { usePackAccess } from '../../src/plus/usePackAccess';
import {
  OffscreenPhotoWallpaper,
  PhotoWallpaperView,
  type PhotoWallpaperData,
} from '../../src/render/PhotoWallpaperView';
import { offersOpenSettings, saveFailureKey, type SaveFailure } from '../../src/core/photoSave';
import { openAppSettings, useOffscreenCapture, useWallpaperSaver } from '../../src/render/saveWallpaper';
import { OffscreenWallpaper, WallpaperView } from '../../src/render/WallpaperView';
import { usePackTheme } from '../../src/render/usePackTheme';
import { loadChecklist, saveChecklist } from '../../src/store/applyChecklist';
import { applyWidgetTheme } from '../../src/store/widgetTheme';
import { loadBackground } from '../../src/store/background';
import { setThemeShape, themeShapeFor } from '../../src/core/studio';
import { setStudioStyle, useStudio } from '../../src/store/studio';
import { durations, easeOutCurve, useMotionReduced } from '../../src/theme/motion';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { HOME_ASPECT, HomeMock } from '../../src/ui/HomeMock';
import { LockMock } from '../../src/ui/LockMock';
import { bezelFor } from '../../src/ui/PhoneFrame';
import { ProgressBar } from '../../src/ui/ProgressBar';
import { PreviewModeLabel, ShapePicker } from '../../src/ui/ShapePicker';
import { Segmented } from '../../src/ui/Segmented';
import { SheenButton } from '../../src/ui/SheenButton';
import { PHONE_ASPECT } from '../../src/ui/ThemeCard';
import { ThemeOverrideRow } from '../../src/ui/ThemeOverrideRow';
import { ContextTip } from '../../src/ui/ContextTip';
import { PhotoCredit, PhotoDownloadControl } from '../../src/ui/PhotoCredit';
import { usePhotoTheme } from '../../src/ui/usePhotoTheme';
import { ArtPackCredit } from '../../src/ui/ArtPackCredit';
import { artPackHero, artPackWallpaper, artPackWallpaperUri } from '../../src/ui/artPackSources';
import { ART_WALLPAPER_SIZE, HERO_REFERENCE_SIZES } from '../../src/core/artPack';
import { seamlessCrop, type Nudge, type SeamlessSize, type SeamlessSlot } from '../../src/core/seamlessWidget';
import { SeamlessWidgetPreview } from '../../src/ui/SeamlessWidgetPreview';
import { SeamlessWidgetControls, type SeamlessControlsStrings } from '../../src/ui/SeamlessWidgetControls';
import { localAssetUri, seamlessDeviceHere } from '../../src/ui/seamlessSetup';
import { artPackOf } from '../../src/core/artPackThemes';
import { FIRST_RUN_TIP_IDS, type TipId as AnyTipId } from '../../src/core/tips';
import { tipsForInstallMode } from '../../src/core/installMethods';
import { PROFILE_INSTALL_ENABLED } from '../../src/config/install';
import { haptic } from '../../src/ui/haptics';
import { noMirror, textStyleFor } from '../../src/ui/i18nLayout';
import { GlassBar, InsetGroup, InsetRow, PillButton, SquircleCard } from '../../src/ui/v2';
import { WidgetPreview } from '../../src/ui/WidgetPreview';

/** Outer width of the phone preview for a window width: large, but leaves the toggle and bar room. */
function previewWidthFor(windowW: number): number {
  return Math.max(200, Math.min(280, Math.round(windowW * 0.64)));
}

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

type PreviewMode = 'home' | 'lock';
/** fb-1022 G1: "pick a theme" first, then the first-run hints, one at a time (profile tips only when that install is on). */
const DETAIL_TIPS: readonly AnyTipId[] = ['theme-pick', ...tipsForInstallMode(FIRST_RUN_TIP_IDS, PROFILE_INSTALL_ENABLED)];

const previewModes = (t: TFunction) =>
  [
    { value: 'home', label: t('theme.mode.home') },
    { value: 'lock', label: t('theme.mode.lock') },
  ] as const;

/**
 * G6 header tint: the strongest mix of the theme's accent into the page background that still
 * keeps both header text colours (ink and secondary) at WCAG AA (4.5:1). Falls back to no tint.
 */
function headerTint(page: string, accent: string, ink: string, muted: string): string {
  for (const t of [0.32, 0.24, 0.16, 0.1, 0.05]) {
    let tint: string;
    try {
      tint = mix(page, accent, t);
    } catch {
      return page;
    }
    if (contrastRatio(ink, tint) >= 4.5 && contrastRatio(muted, tint) >= 4.5) return tint;
  }
  return page;
}

function styleSummary(t: TFunction, s: IconStyle): string {
  const background =
    s.background.kind === 'solid'
      ? t('theme.summary.solid')
      : s.background.kind === 'gradient'
        ? t('theme.summary.gradient')
        : t('theme.summary.glass');
  return t('theme.summary.line', {
    shape: t(`themeUi.shape.names.${s.shape}`),
    background,
    glyphs: s.glyphSet === 'glaze' ? t('theme.summary.glazeGlyphs') : t('theme.summary.lineGlyphs'),
    labels: s.showLabel ? t('theme.summary.labelsOn') : t('theme.summary.labelsOff'),
  });
}

type SaveState = 'idle' | 'saved' | 'denied' | 'error';

export default function ThemeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = getAnyTheme(typeof id === 'string' ? id : undefined);
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();

  if (!theme) {
    return (
      <View style={[styles.missing, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: t('theme.title') }} />
        <Text style={[...typeFor(script, 'title2'), { color: c.ink }]}>{t('theme.notFound')}</Text>
        <PillButton label={t('theme.backToThemes')} onPress={() => router.back()} />
      </View>
    );
  }
  return <ThemeDetail theme={theme} />;
}

function ThemeDetail({ theme: base }: { theme: Theme }) {
  const { c, scheme } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  // T47: pack themes download their artwork. The detail shows Download / progress / error / ready,
  // and uses the downloaded copy (with any pack-only motifs) once it is on the phone.
  const pack = usePackAccess(base);
  const packView = packDetailView(base, pack);
  const theme = usePackTheme(base, wantsPackArtwork(packView));
  const canApply = canApplyFromDetail(packView);
  const packName = base.packId ? (packOf(base.id)?.name ?? base.packId) : '';
  const saver = useWallpaperSaver();
  // T26: the user's chosen icon shape for this theme (kept per theme, used when applying).
  const studio = useStudio();
  const [iosMask, setIosMask] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);
  const shapeKey = studio.state?.themeId && getAnyTheme(studio.state.themeId)?.id === theme.id ? studio.state.themeId : theme.id;
  const shape = studio.state ? themeShapeFor(studio.state, shapeKey, theme.iconStyle.shape) : theme.iconStyle.shape;
  const iconBackdrop = useMemo(() => averageColour(theme.wallpaper), [theme]);
  const specs = useMemo(() => previewSpecs(theme, undefined, shape), [theme, shape]);
  const size = useMemo(() => {
    const s = Dimensions.get('screen');
    return sizeForScreen(s.width, s.height);
  }, []);
  // T61: the 3-in-1 apply checklist (Wallpaper > Icons > Widgets, Loop optional), kept per theme.
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [openRow, setOpenRow] = useState<ChecklistRow | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>(() => freshChecklist(theme.id));
  const checklistRef = useRef<ChecklistState>(checklist);
  const [widgetsMode, setWidgetsMode] = useState<WidgetsStepMode>('preview');
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** fb-1024 C: the real reason a save failed, in plain words, plus the technical detail. */
  const [saveWhy, setSaveWhy] = useState<{ why: SaveFailure; detail?: string } | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleError, setStyleError] = useState(false);
  const locked = useLocked(theme.plus);
  const [lockOpen, setLockOpen] = useState(false);
  /** Why the Plus sheet is open: unlocking from Download shouldn't start the apply steps. */
  const lockFor = useRef<'apply' | 'download'>('apply');
  const reduced = useMotionReduced();

  // T55: the phone preview is sized from the window (large), with a real phone outline: a bezel
  // around a screen that clips the Home / Lock mock to rounded corners.
  const phoneW = previewWidthFor(window.width);
  const bezel = bezelFor(phoneW);
  const screenW = phoneW - bezel * 2;
  const screenH = Math.round(screenW * PHONE_ASPECT);
  /** The cross-fade frame fits whichever mock is taller. */
  const frameH = Math.max(screenH, Math.round(screenW * HOME_ASPECT));
  const screenRadius = Math.round(screenW * 0.12);
  const bezelColour = scheme === 'dark' ? c.surfaceRaised : c.ink;

  // G6: Home / Lock mocks share one frame and cross-fade (both stay mounted).
  const [mode, setMode] = useState<PreviewMode>('home');
  const homeShown = useSharedValue(1);
  useEffect(() => {
    homeShown.value = withTiming(mode === 'home' ? 1 : 0, {
      duration: reduced ? durations.fast : durations.base,
      easing: easeOutCurve,
    });
  }, [mode, reduced, homeShown]);
  const homeStyle = useAnimatedStyle(() => ({ opacity: homeShown.value }));
  const lockStyle = useAnimatedStyle(() => ({ opacity: 1 - homeShown.value }));

  // G6: the top band fades from transparent to a soft tint of the theme's palette.
  const tint = useMemo(
    () => headerTint(c.bg, theme.palette.accent, c.ink, c.inkSecondary),
    [c.bg, c.ink, c.inkSecondary, theme.palette.accent],
  );
  const tintIn = useSharedValue(0);
  useEffect(() => {
    tintIn.value = withTiming(1, { duration: reduced ? durations.fast : durations.slow, easing: easeOutCurve });
  }, [theme.id, reduced, tintIn]);
  const tintStyle = useAnimatedStyle(() => ({ opacity: tintIn.value }));

  // G3: applying the look ripples the icons into the Home mock, then a success haptic and a
  // single sheen across "Install icons". Reduced motion: HomeMock skips the ripple and settles
  // at once, SheenButton swaps the sweep for a short fade.
  const [rippleKey, setRippleKey] = useState(0);
  const [sheenKey, setSheenKey] = useState(0);
  const pendingSettle = useRef(false);
  const playApply = () => {
    pendingSettle.current = true;
    setMode('home');
    setRippleKey((k) => k + 1);
  };
  const onIconsSettled = () => {
    if (!pendingSettle.current) return;
    pendingSettle.current = false;
    haptic('success');
    setSheenKey((k) => k + 1);
  };

  // T55: the steps open just under the preview; once they have laid out, scroll so their bottom is
  // in view (no animation with Reduce Motion). The sticky Apply bar hides while they are open.
  const scrollRef = useRef<ScrollView>(null);
  const viewportH = useRef(0);
  const revealSteps = useRef(false);
  const [barH, setBarH] = useState(0);
  const onStepsLayout = (e: LayoutChangeEvent) => {
    if (!revealSteps.current) return;
    revealSteps.current = false;
    const { y, height } = e.nativeEvent.layout;
    const target = Math.max(0, y + height + spaceV2.lg - viewportH.current);
    scrollRef.current?.scrollTo({ y: target, animated: !reduced });
  };
  const openSteps = () => {
    revealSteps.current = true;
    setChecklistOpen(true);
    setOpenRow(defaultOpenRow(checklistRef.current));
    playApply();
    // T125: starting to apply a theme points the widgets at it straight away.
    void applyWidgetTheme(theme);
  };

  // T61: load this theme's checklist (a different theme starts fresh) and learn whether widgets
  // can really be added (full build with the widget bridge) or only previewed (Expo Go, Android).
  // T81: reloaded on every focus, so ticks made by the wallpaper maker's Lock + Home pair and by
  // Widget Studio's save show up when the person comes back here.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const fresh = checklistFor(checklistRef.current, theme.id);
      checklistRef.current = fresh;
      setChecklist(fresh);
      loadChecklist(theme.id).then((saved: ChecklistState) => {
        if (!alive || checklistRef.current.themeId !== theme.id) return;
        // Keep any tick made while loading.
        const merged = mergeTicks(saved, checklistRef.current, Date.now());
        checklistRef.current = merged;
        setChecklist(merged);
      });
      return () => {
        alive = false;
      };
    }, [theme.id]),
  );
  useEffect(() => {
    let alive = true;
    widgets
      .isAvailable()
      .then((r: { available: boolean }) => {
        if (alive) setWidgetsMode(widgetsStepMode(r.available));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const commitChecklist = (next: ChecklistState) => {
    if (next === checklistRef.current) return;
    checklistRef.current = next;
    setChecklist(next);
    void saveChecklist(next);
  };
  const tick = (task: ChecklistTask) => {
    const before = checklistRef.current;
    const next = tickTask(before, task, Date.now());
    if (next === before) return;
    haptic('success');
    commitChecklist(next);
  };
  // The success moment: once, when the third step is ticked with the checklist on screen.
  useEffect(() => {
    if (!checklistOpen || !celebrationDue(checklist)) return;
    setCelebrateKey((k) => k + 1);
    haptic('success');
    AccessibilityInfo.announceForAccessibility(t('theme.checklist.success.a11y'));
    commitChecklist(markCelebrated(checklist, Date.now()));
  }, [checklist, checklistOpen]);

  // Own photo background (T25): reload whenever we come back from /wallpaper.
  const photoSaver = useOffscreenCapture<PhotoWallpaperData>({ waitForReady: true });
  const [bg, setBg] = useState<ThemeBackground>(() => defaultBackground());
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadBackground(theme.id).then((b) => {
        if (alive) setBg(b);
      });
      return () => {
        alive = false;
      };
    }, [theme.id]),
  );
  const photo: PhotoWallpaperData | null = usesPhoto(bg)
    ? {
        uri: bg.photoUri,
        imageW: bg.imageW,
        imageH: bg.imageH,
        transform: bg.transform ?? DEFAULT_TRANSFORM,
        overlay: bg.overlay,
        palette: theme.palette,
      }
    : null;
  const openPhotoEditor = () => {
    router.push({ pathname: '/wallpaper', params: { theme: theme.id, source: 'photo' } });
  };
  // T103: a Space (Webb) theme uses its downloaded photo; the person's own photo still wins.
  const spacePhoto = usePhotoTheme(theme);
  const spaceBackground = spacePhoto.uri ? (
    <Image source={{ uri: spacePhoto.uri }} resizeMode="cover" style={{ width: screenW, height: screenH }} accessibilityIgnoresInvertColors /> // i18n-ignore (code after a JSX element)
  ) : null;
  // T105: what Apply's Wallpaper step saves (own photo > downloaded Webb photo > drawn wallpaper);
  // a Space theme whose photo isn't on the phone yet offers the download first.
  const wallSource: WallpaperSource = wallpaperSourceFor({ ownPhoto: !!photo, isSpace: !!spacePhoto.photo, spaceReady: !!spacePhoto.uri });
  const spaceCredit = spacePhoto.photo ? photoCreditParams(spacePhoto.photo.photo) : null;
  const [savedFrom, setSavedFrom] = useState<WallpaperSource | null>(null);
  // T130: an art-pack theme shows (and saves) its bundled wallpaper image; the own photo still wins.
  const artPack = artPackOf(theme);
  const artImage = artPack ? artPackWallpaper(artPack.artPack.id) : null;
  const artBackground =
    artImage != null ? (
      <Image source={artImage} resizeMode="cover" style={{ width: screenW, height: screenH }} accessibilityIgnoresInvertColors /> // i18n-ignore (code after a JSX element)
    ) : null;
  const previewBackground = photo ? (
    <PhotoWallpaperView photo={photo} width={screenW} height={screenH} maxGrain={300} /> // i18n-ignore (code after a JSX element)
  ) : spaceBackground ? (
    spaceBackground
  ) : artBackground ? (
    artBackground
  ) : (
    <WallpaperView params={theme.wallpaper} width={screenW} height={screenH} maxGrain={300} />
  );

  const start = () => {
    if (locked) {
      lockFor.current = 'apply';
      setLockOpen(true);
      return;
    }
    openSteps();
  };

  const onDownloadPack = async () => {
    if (pack.state === 'downloading') return;
    haptic('select');
    const r = await pack.download();
    if (r === 'locked') {
      lockFor.current = 'download';
      setLockOpen(true);
    } else if (r === 'ok') {
      haptic('success');
      AccessibilityInfo.announceForAccessibility(t('theme.pack.readyA11y', { pack: packName }));
    } else if (r === 'error') {
      haptic('warning');
    }
  };

  /** T105: the downloaded Webb photo, cropped to the screen (cover, no overlay), saved to Photos. */
  const saveSpacePhoto = async (uri: string): Promise<{ ok: boolean; reason?: string }> => {
    let dims: { width: number; height: number };
    try {
      dims = await Image.getSize(uri);
    } catch {
      return { ok: false, reason: 'error' };
    }
    if (!(dims.width > 0 && dims.height > 0)) return { ok: false, reason: 'error' };
    return photoSaver.save(
      {
        uri,
        imageW: dims.width,
        imageH: dims.height,
        transform: DEFAULT_TRANSFORM,
        overlay: { ...DEFAULT_OVERLAY },
        palette: theme.palette,
      },
      size,
    );
  };

  const onSaveWallpaper = async () => {
    const from = wallSource;
    const artPackUri = artPack ? artPackWallpaperUri(artPack.artPack.id) : null;
    const res: { ok: boolean; reason?: string; why?: SaveFailure; message?: string } = photo
      ? await photoSaver.save(photo, size)
      : from === 'space-photo' && spacePhoto.uri
        ? await saveSpacePhoto(spacePhoto.uri)
        : artPackUri
          ? await saveSpacePhoto(artPackUri) // T130: the art pack's own wallpaper image, cropped to the screen
          : await saver.save(theme.wallpaper, size);
    if (res.ok) {
      setSavedFrom(from);
      setSaveWhy(null);
      setSaveState('saved');
      tick('wallpaper');
      // T125: saving a theme's wallpaper applies it, so the widgets follow it too.
      void applyWidgetTheme(theme); // no-op in Expo Go; never throws
    } else {
      const why: SaveFailure = res.why ?? (res.reason === 'denied' ? 'denied' : res.reason === 'unreadable' ? 'unreadable' : 'unknown');
      setSaveWhy({ why, detail: res.message });
      setSaveState(why === 'denied' ? 'denied' : 'error');
      haptic('warning');
    }
  };

  const onUseStyle = async (destination: '/icons' | '/install' = '/icons') => {
    if (styleBusy) return;
    setStyleBusy(true);
    setStyleError(false);
    try {
      // The store applies the user's chosen shape for this theme, so it is baked into the exports.
      await setStudioStyle(theme.iconStyle, theme.id, averageColour(theme.wallpaper));
      await studio.reload();
      void applyWidgetTheme(theme); // T125: also remembered for the launch re-write; never throws
      tick('iconStyle');
      // navigate, not push: push would stack a second copy of the tab navigator.
      router.navigate(destination);
    } catch {
      setStyleError(true);
    } finally {
      setStyleBusy(false);
    }
  };

  const toggleRow = (row: ChecklistRow) => {
    haptic('select');
    const next = openRow === row ? null : row;
    setOpenRow(next);
    if (next === 'icons') playApply();
    // T125: opening the widgets step points the widgets at this theme.
    if (next === 'widgets') void applyWidgetTheme(theme);
  };
  // T81: opening the studio doesn't tick the widgets step; the studio ticks it when it saves.
  const openWidgetStudio = () => {
    router.push({ pathname: '/widget-studio', params: { theme: theme.id } });
  };
  const progress = checklistProgress(checklist);
  const complete = isComplete(checklist);
  const rowTitle = (row: ChecklistRow): string =>
    row === 'wallpaper'
      ? t('theme.checklist.wallpaper.title')
      : row === 'icons'
        ? t('theme.checklist.icons.title')
        : row === 'widgets'
          ? t('theme.checklist.widgets.title')
          : t('theme.checklist.loop.title');
  const rowSub = (row: ChecklistRow): string => {
    if (row === 'widgets' && rowDone(checklist, 'widgets')) {
      return widgetsMode === 'add' ? t('theme.checklist.widgets.doneAdd') : t('theme.checklist.widgets.donePreview');
    }
    if (row === 'wallpaper') return t('theme.checklist.wallpaper.sub');
    if (row === 'icons') return t('theme.checklist.icons.sub');
    if (row === 'widgets') return widgetsMode === 'add' ? t('theme.checklist.widgets.subAdd') : t('theme.checklist.widgets.subPreview');
    return t('theme.checklist.loop.sub');
  };

  const palette: [string, string][] = [
    [t('theme.palette.background'), theme.palette.bg],
    [t('theme.palette.surface'), theme.palette.surface],
    [t('theme.palette.accent'), theme.palette.accent],
    [t('theme.palette.text'), theme.palette.ink],
    [t('theme.palette.glyph'), theme.palette.glyph],
  ];
  const sizeParams = { name: theme.name, width: String(size.width), height: String(size.height) };
  const homeA11y = photo
    ? t(iosMask ? 'theme.a11y.homeIosPhoto' : 'theme.a11y.homeGlazePhoto', { name: theme.name })
    : t(iosMask ? 'theme.a11y.homeIos' : 'theme.a11y.homeGlaze', { name: theme.name });
  const showBar = canApply && !checklistOpen;
  const photoLabel = photo ? t('theme.photo.change') : t('theme.photo.use');
  const screenStyle = [
    styles.screen,
    continuous,
    noMirror,
    { width: screenW, borderRadius: screenRadius, backgroundColor: theme.palette.bg },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: theme.name, headerTintColor: c.tint }} />
      <ScrollView bounces={false} overScrollMode="never"
        ref={scrollRef}
        onLayout={(e: LayoutChangeEvent) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
        contentContainerStyle={[styles.content, { paddingBottom: (showBar ? barH : insets.bottom) + spaceV2.xxl }]}
      >
        <View style={styles.headWrap}>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[StyleSheet.absoluteFill, tintStyle]}
          >
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="themeHeadTint" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0" stopColor={tint} stopOpacity={1} />
                  <Stop offset="0.7" stopColor={tint} stopOpacity={1} />
                  <Stop offset="1" stopColor={tint} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width="100%" height="100%" fill="url(#themeHeadTint)" />
            </Svg>
          </Animated.View>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={[...ts('title1'), { color: c.ink }]}>
              {theme.name}
            </Text>
            <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{theme.tagline}</Text>
            {theme.plus ? <PlusBadge /> : null}
          </View>
        </View>
        {/* fb-1022 G1: the first-run hints moved here from the Themes screen. They appear after the
            first action (opening a theme), one line at a time, never stacked; "?" brings them back. */}
        <ContextTip ids={DETAIL_TIPS} />

        {showsPackCard(packView) ? <PackCard view={packView} packName={packName} onDownload={onDownloadPack} /> : null}

        {/* L2: one large phone-shaped preview with a Home / Lock toggle. */}
        <SquircleCard size="large" elevation="raised" style={styles.side}>
          <View style={styles.previewCol}>
            <Segmented<PreviewMode>
              label={t('theme.mode.label')}
              options={previewModes(t)}
              value={mode}
              onChange={setMode}
              style={styles.modeToggle}
            />
            <View
              style={[
                styles.phone,
                continuous,
                noMirror,
                { width: phoneW, padding: bezel, borderRadius: screenRadius + bezel, backgroundColor: bezelColour },
              ]}
            >
              <View style={[styles.frame, { width: screenW, height: frameH }]}>
                <Animated.View
                  pointerEvents={mode === 'home' ? 'auto' : 'none'}
                  accessibilityElementsHidden={mode !== 'home'}
                  importantForAccessibility={mode === 'home' ? 'auto' : 'no-hide-descendants'}
                  style={[styles.layer, homeStyle]}
                >
                  <View style={screenStyle} accessible accessibilityRole="image" accessibilityLabel={homeA11y}>
                    <HomeMock
                      specs={specs}
                      width={screenW}
                      maxIcons={12}
                      dockCount={4}
                      backgroundColour={theme.palette.bg}
                      background={previewBackground}
                      iosMask={iosMask}
                      iconBackdrop={iconBackdrop}
                      animateIcons={rippleKey > 0 ? 'ripple' : false}
                      animateKey={rippleKey}
                      onIconsSettled={onIconsSettled}
                    />
                  </View>
                </Animated.View>
                <Animated.View
                  pointerEvents={mode === 'lock' ? 'auto' : 'none'}
                  accessibilityElementsHidden={mode !== 'lock'}
                  importantForAccessibility={mode === 'lock' ? 'auto' : 'no-hide-descendants'}
                  style={[styles.layer, lockStyle]}
                >
                  <View
                    style={[screenStyle, { height: screenH }]}
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={photo ? t('theme.a11y.lockPhoto') : t('theme.a11y.lock', { name: theme.name })}
                  >
                    {previewBackground}
                    <LockMock width={screenW} height={screenH} showGuides={false} />
                  </View>
                </Animated.View>
              </View>
            </View>
            {mode === 'home' ? <PreviewModeLabel iosMask={iosMask} /> : null}
          </View>
        </SquircleCard>

        {/* T103 (fb-1022 G5a): credit + licence for a Webb photo, with Download / Remove (on a tap only). */}
        {spacePhoto.photo ? <PhotoCredit theme={theme} style={styles.side} /> : null}
        {/* T130: credit + licence for an art-pack theme (from its meta.json). */}
        {artPack ? <ArtPackCredit theme={artPack} style={styles.side} /> : null}
        {/* T133: the Seamless widget (wallpaper crop + floating art) for art-pack themes only. */}
        {artPack ? <SeamlessCard artPackId={artPack.artPack.id} /> : null}

        {/* T61 (L2): the 3-in-1 apply checklist. Wallpaper > Icons > Widgets with ticks and a
            progress indicator, Loop as an optional fourth row, a success moment at the end. */}
        {canApply && checklistOpen ? (
          <View onLayout={onStepsLayout} style={styles.side}>
            <SquircleCard size="large" elevation="raised">
              <View style={styles.stack}>
                <Text accessibilityRole="header" style={[...ts('title2'), { color: c.ink }]}>
                  {t('theme.checklist.title')}
                </Text>
                <View
                  style={styles.stack}
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={t('theme.checklist.progressA11y', { done: progress.done, total: progress.total })}
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }}
                >
                  <View style={styles.progressRow}>
                    {CHECKLIST_ROWS.filter((r: ChecklistRow) => r !== 'loop').map((r: ChecklistRow) => {
                      const parts = rowParts(checklist, r);
                      return (
                        <View
                          key={r}
                          style={[
                            styles.progressSeg,
                            {
                              backgroundColor:
                                parts.done === parts.total ? c.tint : parts.done > 0 ? c.tintSoft : c.fill,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>
                    {t('theme.checklist.progress', { done: progress.done, total: progress.total })}
                  </Text>
                </View>

                {complete ? (
                  <SuccessBloom
                    playKey={celebrateKey}
                    reduced={reduced}
                    title={t('theme.checklist.success.title')}
                    body={
                      widgetsMode === 'add'
                        ? t('theme.checklist.success.body', { name: theme.name })
                        : t('theme.checklist.success.bodyPreview', { name: theme.name })
                    }
                  />
                ) : null}

                {CHECKLIST_ROWS.map((row: ChecklistRow, i: number) => {
                  const expanded = openRow === row;
                  const parts = rowParts(checklist, row);
                  const isDone = parts.done === parts.total;
                  const optional = row === 'loop';
                  const state = isDone
                    ? t('theme.checklist.stateDone')
                    : parts.done > 0
                      ? t('theme.checklist.statePart', { done: parts.done, total: parts.total })
                      : optional
                        ? t('theme.checklist.optional')
                        : t('theme.checklist.stateTodo');
                  return (
                    <View key={row} style={[styles.checkItem, i > 0 ? { borderTopColor: c.separator } : styles.noBorder]}>
                      <ChecklistRowHeader
                        index={i + 1}
                        title={rowTitle(row)}
                        subtitle={rowSub(row)}
                        state={state}
                        done={isDone}
                        partial={!isDone && parts.done > 0}
                        optional={optional}
                        expanded={expanded}
                        onPress={() => toggleRow(row)}
                      />

                      {expanded && row === 'wallpaper' ? (
                        <View style={styles.rowBody}>
                          <Text style={[...ts('body'), { color: c.ink }]}>
                            {photo
                              ? t('theme.save.bodyPhoto', sizeParams)
                              : wallSource === 'space-photo'
                                ? t('ui.photoCredit.applyBody', sizeParams)
                                : t('theme.save.body', sizeParams)}
                          </Text>
                          {/* T105: a Space theme offers its Webb photo download first (Retry on failure, T108). */}
                          {wallSource === 'space-offer-download' ? (
                            <View style={styles.gap}>
                              <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('ui.photoCredit.applyOffer')}</Text>
                              <PhotoDownloadControl p={spacePhoto} allowRemove={false} />
                            </View>
                          ) : null}
                          {/* The credit stays with the Webb photo wherever it is saved (T108). */}
                          {wallSource === 'space-photo' && spaceCredit ? (
                            <Text style={[...ts('footnote'), { color: c.inkSecondary }]} selectable>
                              {t('ui.photoCredit.creditLine', spaceCredit)}
                            </Text>
                          ) : null}
                          {saveState === 'saved' ? (
                            <View style={[styles.note, continuous, { backgroundColor: c.pastels.mint.fill }]}>
                              <Feather name="check" size={18} color={c.pastels.mint.ink} />
                              <Text style={[...ts('body'), styles.flex, { color: c.pastels.mint.ink }]} selectable={savedFrom === 'space-photo'}>
                                {savedFrom === 'space-photo' && spaceCredit ? t('ui.photoCredit.savedCredit', spaceCredit) : t('theme.save.saved')}
                              </Text>
                            </View>
                          ) : null}
                          {saveState === 'denied' ? (
                            <View style={styles.gap}>
                              <Text style={[...ts('body'), { color: c.warn }]}>{t('theme.save.denied')}</Text>
                              <PillButton
                                label={t('theme.save.openSettings')}
                                icon="settings"
                                variant="tinted"
                                onPress={openAppSettings}
                              />
                            </View>
                          ) : null}
                          {saveState === 'error' ? (
                            <View style={styles.gap} accessibilityLiveRegion="polite">
                              <Text style={[...ts('body'), { color: c.warn }]}>
                                {saveWhy && saveFailureKey(saveWhy.why) ? t(`theme.save.why.${saveWhy.why}`) : t('theme.save.error')}
                              </Text>
                              {saveWhy?.detail ? (
                                <Text style={[...ts('footnote'), { color: c.inkSecondary }]} selectable>
                                  {saveWhy.detail}
                                </Text>
                              ) : null}
                              <View style={styles.navRow}>
                                <PillButton
                                  label={t('theme.save.tryAgain')}
                                  icon="refresh-cw"
                                  variant="tinted"
                                  size="small"
                                  busy={saver.saving || photoSaver.saving}
                                  onPress={onSaveWallpaper}
                                  style={styles.flex}
                                />
                                {saveWhy && offersOpenSettings(saveWhy.why) ? (
                                  <PillButton
                                    label={t('theme.save.openSettings')}
                                    icon="settings"
                                    variant="plain"
                                    size="small"
                                    onPress={openAppSettings}
                                    style={styles.flex}
                                  />
                                ) : null}
                              </View>
                            </View>
                          ) : null}
                          <PillButton
                            label={
                              saver.saving || photoSaver.saving
                                ? t('theme.save.saving')
                                : saveState === 'saved'
                                  ? t('theme.save.again')
                                  : t('theme.save.cta')
                            }
                            icon="download"
                            variant={saveState === 'saved' ? 'tinted' : 'filled'}
                            block
                            busy={saver.saving || photoSaver.saving}
                            onPress={onSaveWallpaper}
                          />
                          <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.checklist.wallpaper.pairBody')}</Text>
                          <View style={styles.navRow}>
                            <PillButton
                              label={t('theme.checklist.wallpaper.pairCta')}
                              icon="layers"
                              variant="tinted"
                              size="small"
                              onPress={() => router.push({ pathname: '/wallpaper', params: { theme: theme.id } })}
                              style={styles.flex}
                            />
                            {isDone ? null : (
                              <PillButton
                                label={t('theme.checklist.markDone')}
                                icon="check"
                                variant="plain"
                                size="small"
                                onPress={() => tick('wallpaper')}
                                style={styles.flex}
                              />
                            )}
                          </View>
                        </View>
                      ) : null}

                      {expanded && row === 'icons' ? (
                        <View style={styles.rowBody}>
                          <Text style={[...ts('headline'), { color: c.ink }]}>
                            {checklist.ticks.iconStyle ? '✓ ' : ''}
                            {t('theme.checklist.icons.style')}
                          </Text>
                          <Text style={[...ts('body'), { color: c.ink }]}>{t('theme.style.body')}</Text>
                          {styleError ? <Text style={[...ts('body'), { color: c.warn }]}>{t('theme.style.error')}</Text> : null}
                          <PillButton
                            label={styleBusy ? t('common.loading') : t('theme.style.cta')}
                            icon="grid"
                            variant={checklist.ticks.iconStyle ? 'tinted' : 'filled'}
                            block
                            busy={styleBusy}
                            onPress={() => void onUseStyle()}
                            accessibilityHint={t('theme.style.hint')}
                          />
                          <Text style={[...ts('headline'), { color: c.ink }]}>
                            {checklist.ticks.iconInstall ? '✓ ' : ''}
                            {t('theme.checklist.icons.install')}
                          </Text>
                          <Text style={[...ts('body'), { color: c.ink }]}>{t('theme.install.body')}</Text>
                          <SheenButton
                            label={t('theme.install.cta')}
                            icon="upload"
                            sheenKey={sheenKey}
                            onPress={() => {
                              void onUseStyle('/install');
                            }}
                          />
                        </View>
                      ) : null}

                      {expanded && row === 'widgets' ? (
                        <View style={styles.rowBody}>
                          <Text style={[...ts('body'), { color: c.ink }]}>
                            {widgetsMode === 'add' ? t('theme.checklist.widgets.bodyAdd') : t('theme.checklist.widgets.bodyPreview')}
                          </Text>
                          <PillButton
                            label={widgetsMode === 'add' ? t('theme.checklist.widgets.ctaAdd') : t('theme.checklist.widgets.ctaPreview')}
                            icon="grid"
                            variant={isDone ? 'tinted' : 'filled'}
                            block
                            onPress={openWidgetStudio}
                            accessibilityHint={t('theme.widgetPreviews.hint')}
                          />
                        </View>
                      ) : null}

                      {expanded && row === 'loop' ? (
                        <View style={styles.rowBody}>
                          <Text style={[...ts('body'), { color: c.ink }]}>{t('theme.loop.body')}</Text>
                          <PillButton
                            label={t('theme.loop.cta')}
                            icon="film"
                            variant="tinted"
                            block
                            onPress={() => {
                              tick('loop');
                              router.navigate('/live');
                            }}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <View style={styles.navRow}>
                  <PillButton
                    label={t('common.close')}
                    variant="plain"
                    onPress={() => {
                      setChecklistOpen(false);
                      setOpenRow(null);
                    }}
                    style={styles.flex}
                  />
                  {complete ? (
                    <PillButton
                      label={t('theme.checklist.again')}
                      icon="rotate-ccw"
                      variant="plain"
                      onPress={() => {
                        haptic('select');
                        setSaveState('idle');
                        commitChecklist(resetChecklist(checklistRef.current, Date.now()));
                        setOpenRow('wallpaper');
                      }}
                      style={styles.flex}
                    />
                  ) : null}
                </View>
              </View>
            </SquircleCard>
          </View>
        ) : null}

        {/* Make it yours: quiet rows, so "Apply" stays the one primary action. */}
        <InsetGroup
          header={t('theme.customise')}
          footer={photo ? t('theme.photo.yours', { name: theme.name }) : t('theme.photo.prompt')}
        >
          <InsetRow
            title={photoLabel}
            icon="image"
            iconTone="sky"
            onPress={openPhotoEditor}
            accessibilityLabel={photoLabel}
            accessibilityHint={t('theme.photo.hint')}
          />
          {locked || !canApply ? null : (
            <InsetRow
              title={t('theme.editWallpaper')}
              icon="sliders"
              iconTone="lilac"
              onPress={() => router.push({ pathname: '/wallpaper', params: { theme: theme.id } })}
              accessibilityLabel={t('theme.editWallpaper')}
            />
          )}
        </InsetGroup>

        {/* T26 + fb-1022 G2: the icon shape picker sits behind one collapsed "Shape" row here (the only
            place it appears), with the "How it looks on iPhone" switch inside. */}
        <InsetGroup>
          <InsetRow
            title={t('theme.shapeRow.title')}
            value={t(`themeUi.shape.names.${shape}`)}
            icon="square"
            iconTone="mint"
            accessory="none"
            trailing={<Feather name={shapeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.inkTertiary} />}
            onPress={() => setShapeOpen((o) => !o)}
            accessibilityLabel={t('theme.shapeRow.a11y', { shape: t(`themeUi.shape.names.${shape}`) })}
            accessibilityHint={shapeOpen ? t('theme.shapeRow.hideHint') : t('theme.shapeRow.showHint')}
          />
        </InsetGroup>
        {shapeOpen ? (
          <SquircleCard style={styles.side}>
            <ShapePicker
              theme={theme}
              value={shape}
              onChange={(next) => studio.update((s) => setThemeShape(s, shapeKey, next))}
              iosMask={iosMask}
              onIosMaskChange={setIosMask}
              backdrop={iconBackdrop}
            />
          </SquircleCard>
        ) : null}

        <SquircleCard style={styles.side}>
          <View style={styles.stack}>
            <Text accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
              {t('theme.palette.title')}
            </Text>
            <View style={styles.dots}>
              {palette.map(([name, hex]) => (
                <View key={name} style={styles.dotItem} accessible accessibilityLabel={t('theme.a11y.swatch', { name, hex })}>
                  <View style={[styles.dot, { backgroundColor: hex, borderColor: c.separator }]} />
                  <Text style={[...ts('caption1'), styles.dotLabel, { color: c.inkSecondary }]}>{name}</Text>
                </View>
              ))}
            </View>
            <Text accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
              {t('theme.iconStyle')}
            </Text>
            <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{styleSummary(t, { ...theme.iconStyle, shape })}</Text>
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>
              {t('theme.widgets.line', {
                style: t(`theme.widgets.${theme.widget.style}`),
                font: t(theme.widget.font === 'display' ? 'theme.widgets.display' : 'theme.widgets.body'),
              })}
            </Text>
          </View>
        </SquircleCard>

        <WidgetPreviews theme={theme} />

        {locked || !canApply ? null : (
          <View style={styles.side}>
            <ThemeOverrideRow theme={theme} />
          </View>
        )}

        <OffscreenWallpaper ref={saver.ref} job={saver.job} />
        <OffscreenPhotoWallpaper ref={photoSaver.ref} job={photoSaver.job} onReady={photoSaver.markReady} />
      </ScrollView>

      {/* The one primary action, sticky over the content on chrome glass: wallpaper + icons + widgets. */}
      {showBar ? (
        <GlassBar material="chrome" hairline="top" style={styles.bar}>
          <View
            onLayout={(e: LayoutChangeEvent) => setBarH(e.nativeEvent.layout.height)}
            style={[styles.barInner, { paddingBottom: insets.bottom + spaceV2.md }]}
          >
            <PillButton
              label={t('theme.apply')}
              icon={locked ? 'lock' : 'check-circle'}
              block
              onPress={start}
              accessibilityHint={locked ? t('theme.applyHintLocked') : t('theme.applyHint')}
            />
            {!locked ? <PillButton label={t('theme.style.cta')} icon="grid" variant="tinted" block busy={styleBusy} onPress={() => void onUseStyle()} /> : null}
            {styleError ? <Text style={{ color: c.warn }}>{t('theme.style.error')}</Text> : null}
            <Text style={[...ts('footnote'), styles.barNote, { color: c.inkSecondary }]}>{t('theme.applyBundle')}</Text>
          </View>
        </GlassBar>
      ) : null}

      <PlusLockSheet
        visible={lockOpen}
        onClose={() => setLockOpen(false)}
        subject={t('theme.lockSubject', { name: theme.name })}
        onUnlocked={() => {
          if (lockFor.current === 'download') {
            void onDownloadPack();
            return;
          }
          openSteps();
        }}
      />
    </View>
  );
}

type ChecklistRowHeaderProps = {
  index: number;
  title: string;
  subtitle: string;
  /** Spoken state: done / to do / 1 of 2 / optional. */
  state: string;
  done: boolean;
  partial: boolean;
  optional: boolean;
  expanded: boolean;
  onPress: () => void;
};

/** T61: one checklist row: a tick (or step number), title, status line and an expand chevron. */
function ChecklistRowHeader({ index, title, subtitle, state, done, partial, optional, expanded, onPress }: ChecklistRowHeaderProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const fill = done ? c.tint : partial ? c.tintSoft : 'transparent';
  const ring = done ? c.tint : optional ? c.inkTertiary : c.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('theme.checklist.rowA11y', { name: title, state })}
      accessibilityHint={t('theme.checklist.rowHint')}
      accessibilityState={{ expanded, checked: done }}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [styles.checkHead, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.tick, { backgroundColor: fill, borderColor: ring }]}>
        {done ? (
          <Feather name="check" size={18} color={c.onTint} />
        ) : (
          <Text style={[...typeFor(script, 'footnote'), { color: partial ? c.onTintSoft : c.inkSecondary }]}>
            {optional ? '+' : String(index)}
          </Text>
        )}
      </View>
      <View style={styles.flex}>
        <Text style={[...typeFor(script, 'headline'), { color: c.ink }]}>{title}</Text>
        <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>
          {subtitle}
          {' · '}
          {state}
        </Text>
      </View>
      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={c.inkTertiary} />
    </Pressable>
  );
}

type SuccessBloomProps = { playKey: number; reduced: boolean; title: string; body: string };

/**
 * T61: the success moment once all three steps are ticked. A check blooms out of a soft ring
 * (timed fade + fading halo, no spring); with Reduce Motion it simply fades in. The haptic and the VoiceOver
 * announcement fire from the screen when the moment is due. playKey 0 = shown without animation.
 */
function SuccessBloom({ playKey, reduced, title, body }: SuccessBloomProps) {
  const { c } = useColorsV2();
  const { script } = useT();
  const shown = useSharedValue(playKey > 0 ? 0 : 1);
  const scale = useSharedValue(playKey > 0 && !reduced ? 0.4 : 1);
  const halo = useSharedValue(0);
  useEffect(() => {
    if (playKey <= 0) return;
    shown.value = 0;
    shown.value = withTiming(1, { duration: reduced ? durations.fast : durations.base, easing: easeOutCurve });
    if (reduced) {
      scale.value = 1;
      halo.value = 0;
      return;
    }
    scale.value = 0.85;
    scale.value = withTiming(1, { duration: durations.base, easing: easeOutCurve });
    halo.value = 1;
    halo.value = withTiming(0, { duration: durations.slow, easing: easeOutCurve });
  }, [playKey, reduced, shown, scale, halo]);
  const cardStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value * 0.5, transform: [{ scale: 1 + (1 - halo.value) * 0.9 }] }));
  return (
    <Animated.View
      accessible
      accessibilityLiveRegion="polite"
      style={[styles.success, continuous, { backgroundColor: c.pastels.mint.fill }, cardStyle]}
    >
      <View style={styles.bloomWrap}>
        <Animated.View pointerEvents="none" style={[styles.bloomHalo, { backgroundColor: c.ok }, haloStyle]} />
        <Animated.View style={[styles.bloomCheck, { backgroundColor: c.ok }, checkStyle]}>
          <Feather name="check" size={26} color={c.surface} />
        </Animated.View>
      </View>
      <View style={styles.flex}>
        <Text style={[...typeFor(script, 'headline'), { color: c.pastels.mint.ink }]}>{title}</Text>
        <Text style={[...typeFor(script, 'footnote'), { color: c.pastels.mint.ink }]}>{body}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * T59: the theme's matching widgets (one per kind, small size when it has one), drawn in-app so
 * they work in Expo Go. Tapping one opens Widget Studio on that widget. Kinds come from the
 * generated set, so new widget kinds appear here automatically.
 */
function WidgetPreviews({ theme }: { theme: Theme }) {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const tl = t as unknown as (key: string) => string;
  const set = useMemo(() => generateWidgetSet(theme), [theme]);
  const items = studioKinds(set).flatMap((kind) => {
    const sizes = studioSizes(set, kind);
    const size = sizes.includes('small') ? 'small' : sizes[0];
    const spec = size ? widgetSpecOf(set, kind, size) : undefined;
    return spec ? [spec] : [];
  });
  const open = (kind?: string, size?: string) => {
    haptic('select');
    router.push({ pathname: '/widget-studio', params: { theme: theme.id, ...(kind ? { kind } : {}), ...(size ? { size } : {}) } });
  };
  return (
    <SquircleCard style={styles.side}>
      <View style={styles.stack}>
        <Text accessibilityRole="header" style={[...typeFor(script, 'title3'), { color: c.ink }]}>
          {t('theme.widgetPreviews.title')}
        </Text>
        <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>{t('theme.widgetPreviews.body')}</Text>
        <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.widgetRow}>
          {items.map((spec) => (
            <Pressable
              key={spec.id}
              accessibilityRole="button"
              accessibilityLabel={t('theme.widgetPreviews.itemA11y', { kind: tl(widgetKindKey(spec.kind)), size: tl(widgetSizeKey(spec.size)) })}
              accessibilityHint={t('theme.widgetPreviews.hint')}
              onPress={() => open(spec.kind, spec.size)}
              style={({ pressed }) => [styles.widgetItem, { opacity: pressed ? 0.75 : 1 }]}
            >
              <WidgetPreview spec={spec} width={WIDGET_PREVIEW_W} />
              <Text style={[...typeFor(script, 'caption1'), { color: c.ink }]} numberOfLines={2}>
                {tl(widgetKindKey(spec.kind))}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <PillButton label={t('theme.widgetPreviews.open')} icon="edit-3" variant="tinted" size="small" onPress={() => open()} />
      </View>
    </SquircleCard>
  );
}

const WIDGET_PREVIEW_W = 112;

type SeamlessStatus = 'idle' | 'busy' | 'saved' | 'unavailable' | 'failed';

/**
 * T133: the Seamless widget card on an art-pack theme. A mock Home Screen shows the widget cut from
 * the wallpaper with the art floating on top; size / spot / nudge pick where it sits, and "Use for
 * my Glaze widget" writes the image through the widget bridge. Expo Go: the button explains that
 * the TestFlight app is needed; nothing throws.
 */
function SeamlessCard({ artPackId }: { artPackId: string }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const window = useWindowDimensions();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const [size, setSize] = useState<SeamlessSize>('small');
  const [slot, setSlot] = useState<SeamlessSlot>('top-left');
  const [nudge, setNudge] = useState<Nudge>({ dx: 0, dy: 0 });
  const [status, setStatus] = useState<SeamlessStatus>('idle');
  const wallpaper = artPackWallpaper(artPackId);
  const hero = artPackHero(artPackId, size);
  const heroRef = HERO_REFERENCE_SIZES[size];
  const previewW = Math.max(160, Math.min(240, Math.round(window.width * 0.6)));

  const strings = useMemo<SeamlessControlsStrings>(() => {
    const moved = (axis: 'x' | 'y', v: number): string | null => {
      if (v === 0) return null;
      const n = Math.abs(v);
      if (axis === 'x') return v > 0 ? t('ui.seamless.moved.right', { n }) : t('ui.seamless.moved.left', { n });
      return v > 0 ? t('ui.seamless.moved.down', { n }) : t('ui.seamless.moved.up', { n });
    };
    return {
      sizeGroup: t('ui.seamless.sizeGroup'),
      sizes: { small: t('ui.seamless.sizes.small'), medium: t('ui.seamless.sizes.medium'), large: t('ui.seamless.sizes.large') },
      slotGroup: t('ui.seamless.slotGroup'),
      slots: {
        'top-left': t('ui.seamless.slots.top-left'),
        'top-right': t('ui.seamless.slots.top-right'),
        'middle-left': t('ui.seamless.slots.middle-left'),
        'middle-right': t('ui.seamless.slots.middle-right'),
        'bottom-left': t('ui.seamless.slots.bottom-left'),
        'bottom-right': t('ui.seamless.slots.bottom-right'),
        top: t('ui.seamless.slots.top'),
        middle: t('ui.seamless.slots.middle'),
        bottom: t('ui.seamless.slots.bottom'),
      },
      stepGroup: t('ui.seamless.stepGroup'),
      step1: t('ui.seamless.step1'),
      step5: t('ui.seamless.step5'),
      nudgeA11y: (dir, step) =>
        dir === 'up'
          ? t('ui.seamless.nudge.up', { n: step })
          : dir === 'down'
            ? t('ui.seamless.nudge.down', { n: step })
            : dir === 'left'
              ? t('ui.seamless.nudge.left', { n: step })
              : t('ui.seamless.nudge.right', { n: step }),
      reset: t('ui.seamless.reset'),
      readout: (n) => {
        const parts = [moved('x', n.dx), moved('y', n.dy)].filter((p): p is string => p !== null);
        if (parts.length === 0) return t('ui.seamless.readoutNone');
        if (parts.length === 1) return t('ui.seamless.readoutOne', { a: parts[0] });
        return t('ui.seamless.readoutTwo', { a: parts[0], b: parts[1] });
      },
    };
  }, [t]);

  if (wallpaper == null) return null;

  /** Resolve local files for the wallpaper and hero, crop for this phone, hand them to the bridge. */
  const onUse = async () => {
    if (status === 'busy') return;
    setStatus('busy');
    haptic('select');
    let next: SeamlessStatus = 'failed';
    try {
      const avail = await widgets.isAvailable();
      if (!avail.available) {
        next = 'unavailable';
      } else {
        const wallpaperUri = await localAssetUri(wallpaper, `${artPackId}-wallpaper.png`);
        const heroUri = await localAssetUri(hero, `${artPackId}-${size}.png`);
        if (wallpaperUri) {
          const crop = seamlessCrop({
            device: seamlessDeviceHere(),
            wallpaper: { w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height },
            size,
            slot,
            nudge,
          });
          const res = await widgets.setSeamless({ wallpaperUri, cropPx: crop.cropPx, heroUri, size });
          next = !res.available ? 'unavailable' : res.ok ? 'saved' : 'failed';
        }
      }
    } catch {
      next = 'failed';
    }
    setStatus(next);
    haptic(next === 'saved' ? 'success' : 'warning');
    const line =
      next === 'saved' ? t('ui.seamless.saved') : next === 'unavailable' ? t('ui.seamless.notAvailable') : t('ui.seamless.failed');
    AccessibilityInfo.announceForAccessibility(line);
  };

  const statusLine =
    status === 'saved'
      ? t('ui.seamless.saved')
      : status === 'unavailable'
        ? t('ui.seamless.notAvailable')
        : status === 'failed'
          ? t('ui.seamless.failed')
          : null;
  const how = [t('ui.seamless.how1'), t('ui.seamless.how2'), t('ui.seamless.how3')];

  return (
    <SquircleCard style={styles.side}>
      <View style={styles.stack}>
        <Text accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
          {t('ui.seamless.title')}
        </Text>
        <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{t('ui.seamless.body')}</Text>
        <SeamlessWidgetPreview
          wallpaper={wallpaper}
          wallpaperPx={{ w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height }}
          hero={hero}
          heroPx={{ w: heroRef.width, h: heroRef.height }}
          size={size}
          slot={slot}
          nudge={nudge}
          width={previewW}
          outline
          accessibilityLabel={t('ui.seamless.previewA11y', { size: strings.sizes[size], slot: strings.slots[slot] })}
          style={styles.seamlessPreview}
        />
        <SeamlessWidgetControls
          size={size}
          slot={slot}
          nudge={nudge}
          onSizeChange={(s) => {
            setSize(s);
            setStatus('idle');
          }}
          onSlotChange={(s) => {
            setSlot(s);
            setStatus('idle');
          }}
          onNudgeChange={(n) => {
            setNudge(n);
            setStatus('idle');
          }}
          strings={strings}
        />
        <PillButton
          label={status === 'busy' ? t('ui.seamless.saving') : t('ui.seamless.use')}
          icon="layers"
          block
          busy={status === 'busy'}
          onPress={onUse}
          accessibilityHint={t('ui.seamless.useHint')}
        />
        {statusLine ? (
          <Text accessibilityLiveRegion="polite" style={[...ts('footnote'), { color: status === 'saved' ? c.ok : status === 'failed' ? c.warn : c.inkSecondary }]}>
            {statusLine}
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={[...ts('headline'), { color: c.ink }]}>
          {t('ui.seamless.howTitle')}
        </Text>
        <View style={styles.gap}>
          {how.map((line, i) => (
            <View key={i} style={styles.howRow}>
              <Text style={[...ts('footnote'), styles.howNum, { color: c.inkSecondary }]}>{i + 1}.</Text>
              <Text style={[...ts('footnote'), styles.flex, { color: c.inkSecondary }]}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </SquircleCard>
  );
}

/** T47: the pack card on a pack theme's detail (Download, progress, error + Try again, downloaded). */
function PackCard({ view, packName, onDownload }: { view: PackDetailView; packName: string; onDownload: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const icon =
    view.kind === 'ready'
      ? 'check-circle'
      : view.kind === 'error'
        ? 'alert-circle'
        : view.kind === 'locked'
          ? 'lock'
          : view.kind === 'downloading'
            ? 'download-cloud'
            : 'package';
  const iconColour = view.kind === 'error' ? c.warn : view.kind === 'ready' ? c.ok : c.tint;
  const params = { pack: packName };
  return (
    <SquircleCard style={styles.side}>
      <View style={styles.stack}>
        <View style={styles.packHead}>
          <Feather name={icon} size={20} color={iconColour} />
          <Text accessibilityRole="header" style={[...ts('headline'), styles.flex, { color: c.ink }]}>
            {t('theme.pack.title', params)}
          </Text>
        </View>
        {view.kind === 'locked' ? <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{t('theme.pack.locked')}</Text> : null}
        {view.kind === 'bundled' ? <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.pack.bundled')}</Text> : null}
        {view.kind === 'download' ? (
          <>
            <Text style={[...ts('callout'), { color: c.ink }]}>{t('theme.pack.download', params)}</Text>
            <PillButton
              label={t('theme.pack.downloadCta')}
              icon="download"
              variant="tinted"
              onPress={onDownload}
              accessibilityHint={t('theme.pack.downloadHint')}
            />
          </>
        ) : null}
        {view.kind === 'downloading' ? (
          <>
            {/* percent is capped at 99 until the files are verified */}
            <ProgressBar progress={view.percent / 100} label={t('theme.pack.downloading', params)} />
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.pack.downloadingNote')}</Text>
          </>
        ) : null}
        {view.kind === 'error' ? (
          <>
            <Text accessibilityLiveRegion="polite" style={[...ts('callout'), { color: c.warn }]}>
              {view.message ?? t('theme.pack.error')}
            </Text>
            <PillButton
              label={t('theme.pack.retry')}
              icon="refresh-cw"
              variant="tinted"
              onPress={onDownload}
              accessibilityHint={t('theme.pack.retryHint')}
            />
          </>
        ) : null}
        {view.kind === 'ready' ? <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{t('theme.pack.ready')}</Text> : null}
      </View>
    </SquircleCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spaceV2.lg },
  missing: { flex: 1, padding: spaceV2.inset, gap: spaceV2.md, justifyContent: 'center' },
  side: { marginHorizontal: spaceV2.lg },
  headWrap: {
    paddingHorizontal: spaceV2.inset,
    paddingTop: spaceV2.lg,
    paddingBottom: spaceV2.xl,
    marginBottom: -spaceV2.md,
  },
  head: { gap: spaceV2.xs },
  stack: { gap: spaceV2.md },
  modeToggle: { alignSelf: 'stretch' },
  previewCol: { alignItems: 'center', gap: spaceV2.md },
  phone: { alignSelf: 'center' },
  frame: { position: 'relative' },
  layer: { position: 'absolute', top: 0, start: 0, end: 0, alignItems: 'center' },
  screen: { overflow: 'hidden' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.md },
  dotItem: { alignItems: 'center', gap: spaceV2.xs, minWidth: sizeV2.touch },
  dot: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  dotLabel: { textAlign: 'center' },
  progressRow: { flexDirection: 'row', gap: spaceV2.xs },
  progressSeg: { flex: 1, height: 6, borderRadius: 3 },
  note: { flexDirection: 'row', gap: spaceV2.sm, padding: spaceV2.md, borderRadius: radiusV2.control, alignItems: 'flex-start' },
  checkItem: { gap: spaceV2.md, paddingTop: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  noBorder: { borderTopWidth: 0, paddingTop: 0 },
  checkHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch },
  tick: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowBody: { gap: spaceV2.md, paddingBottom: spaceV2.sm },
  success: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, padding: spaceV2.md, borderRadius: radiusV2.control },
  bloomWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bloomHalo: { position: 'absolute', width: 48, height: 48, borderRadius: 24 },
  bloomCheck: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navRow: { flexDirection: 'row', gap: spaceV2.sm, minHeight: sizeV2.touch },
  flex: { flex: 1 },
  gap: { gap: spaceV2.sm },
  packHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  widgetRow: { gap: spaceV2.md, paddingVertical: spaceV2.xs },
  widgetItem: { width: WIDGET_PREVIEW_W, gap: spaceV2.xs, minHeight: sizeV2.touch },
  seamlessPreview: { alignSelf: 'center' },
  howRow: { flexDirection: 'row', gap: spaceV2.sm },
  howNum: { minWidth: 16 },
  bar: { position: 'absolute', start: 0, end: 0, bottom: 0 },
  barInner: { paddingHorizontal: spaceV2.inset, paddingTop: spaceV2.md, gap: spaceV2.xs },
  barNote: { textAlign: 'center' },
});
