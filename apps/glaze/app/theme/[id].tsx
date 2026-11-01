// Theme detail, design v2 (docs/DESIGN_V2.md §9, docs/MARKET.md L2, T55): a large phone-shaped
// preview with a Home / Lock toggle and ONE primary button in a sticky glass bar at the bottom.
// T185 (owner-1101 item 3): the button is "Use this theme" (the base for every tab; "In use ✓"
// when it already is), and Wallpaper, Icons and Widgets are three separate entry points, each its
// own clean screen: /theme/[id]?step=wallpaper, /theme/[id]?step=icons and (T201)
// /theme/[id]?step=widgets (practical pieces, then art, then the standard set → Widget Studio).
// The old one-run Apply checklist is gone.
// T173 premium slice (docs/PREMIUM_UI.md §3.3): the hero phone sits large and centred on a soft
// surface with a quiet Home / Lock pill under it; the rest reads as editorial blocks (eyebrow +
// title via SectionHeader: Icons, Widgets, Wallpaper, Credits); the glass bar holds
// one primary pill; every Text has a Dynamic Type cap; motion stays timed ease-out (no spring).
// T200 (owner-1101d #3): "Set it up" is a bold section header (title1 + one-line subtitle) above
// the three entry cards; the old "What's inside" block (palette + style) is gone, and the palette
// sits in the matching-widgets block ("These widgets are made from this palette").
// T210 (premium pass): the three Set it up entry points are lifted cards (PartCard: surface, not a
// ruled inset group), each led by a small piece of the theme itself: a phone in its wallpaper
// colours, four of its icons, a widget in its palette.
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { isThemeInUse, themeStepOf, wallpaperSaveView, type ThemeStep } from '../../src/core/activeTheme';
import { contrastRatio, mix } from '../../src/core/colour';
import { DEFAULT_OVERLAY, defaultBackground, usesPhoto, type ThemeBackground } from '../../src/core/background';
import { photoCreditParams, wallpaperSourceFor, type WallpaperSource } from '../../src/core/photoPack';
import { DEFAULT_TRANSFORM } from '../../src/core/photoCrop';
import { canApplyFromDetail, packDetailView, showsPackCard, wantsPackArtwork, type PackDetailView } from '../../src/core/packDetail';
import { getAnyTheme, packOf } from '../../src/core/plusThemes';
import { previewSpecs, type Theme } from '../../src/core/themes';
import { averageColour, sizeForScreen } from '../../src/core/wallpaper';
import { generateWidgetSet, widgetKindKey, widgetSizeKey } from '../../src/core/widgetSets';
import { studioPreviews, type StudioState } from '../../src/core/widgetStudio';
import { loadStudio } from '../../src/store/widgetStudio';
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
import { IconCanvas } from '../../src/render/IconCanvas';
import { usePackTheme } from '../../src/render/usePackTheme';
import { tickStoredChecklist } from '../../src/store/applyChecklist';
import { applyThemeEverywhere, rememberWallpaperSaved, useActiveThemeId, wasWallpaperSaved } from '../../src/store/activeTheme';
import { runInstalledProbe } from '../../src/store/installedProbe';
import { applyWidgetTheme } from '../../src/store/widgetTheme';
import { loadBackground } from '../../src/store/background';
import { setThemeShape, themeShapeFor } from '../../src/core/studio';
import { setStudioStyle, useStudio } from '../../src/store/studio';
import { durations, easeOutCurve, useMotionReduced } from '../../src/theme/motion';
import {
  circleRadius,
  continuous,
  editorialV2,
  fontScaleCap,
  iconTileRadius,
  radiusV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { HOME_ASPECT, HomeMock } from '../../src/ui/HomeMock';
import { LockMock } from '../../src/ui/LockMock';
import { bezelFor } from '../../src/ui/PhoneFrame';
import { ProgressBar } from '../../src/ui/ProgressBar';
import { PackUpdateNote } from '../../src/ui/PackUpdateNote';
import { IconGridSkeleton, Skeleton } from '../../src/ui/Skeleton';
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
import { ART_WALLPAPER_SIZE, HERO_REFERENCE_SIZES, type HeroSize } from '../../src/core/artPack';
import { seamlessCardSources, seamlessImageSource, seamlessSourceKey } from '../../src/core/seamlessSource';
import { seamlessCrop, type Nudge, type SeamlessSize, type SeamlessSlot } from '../../src/core/seamlessWidget';
import { SeamlessWidgetPreview } from '../../src/ui/SeamlessWidgetPreview';
import { SeamlessWidgetControls, type SeamlessControlsStrings } from '../../src/ui/SeamlessWidgetControls';
import { existingLocalFile, localAssetUri, seamlessDeviceHere } from '../../src/ui/seamlessSetup';
import { artPackOf } from '../../src/core/artPackThemes';
import { isRemoteArtTheme, remoteArtDetailView } from '../../src/core/remoteCatalog';
import { formatBytes } from '../../src/core/themePack';
import { useRemoteArtTheme } from '../../src/native/useRemoteCatalog';
import { PACKS_ENABLED } from '../../src/native/packs';
import { downloadedRemoteWallpaper, useCatalogSettled } from '../../src/native/useAnyTheme';
import { remoteHeroArt, remotePrimary, themePageState, type RemotePrimary } from '../../src/core/remoteThemePage';
import { RemoteArtImage } from '../../src/ui/RemoteArtImage';
import { FIRST_RUN_TIP_IDS, type TipId as AnyTipId } from '../../src/core/tips';
import { tipsForInstallMode } from '../../src/core/installMethods';
import { PROFILE_INSTALL_ENABLED } from '../../src/config/install';
import { haptic } from '../../src/ui/haptics';
import { Chevron, noMirror, textStyleFor } from '../../src/ui/i18nLayout';
import { GlassBar, InsetGroup, InsetRow, PillButton, SectionHeader, SquircleCard } from '../../src/ui/v2';
import { WidgetPreview } from '../../src/ui/WidgetPreview';
import { ThemeWidgetArt } from '../../src/ui/ThemeWidgetArt';
import { widgetTabSizeKey } from '../../src/core/tabNav';
import type { HomeOptionSize } from '../../src/core/widgetOptions';

/** Outer width of the phone preview for a window width: large, but leaves the toggle and bar room. */
function previewWidthFor(windowW: number): number {
  return Math.max(200, Math.min(280, Math.round(windowW * 0.64)));
}

/** T173: the quiet Home / Lock pill under the hero phone: a little narrower than the phone, never cramped. */
function modePillWidthFor(phoneW: number): number {
  return Math.max(200, Math.round(phoneW * 0.9));
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

type SaveState = 'idle' | 'saved' | 'denied' | 'error';

export default function ThemeDetailScreen() {
  const { id, step: stepParam } = useLocalSearchParams<{ id: string; step?: string }>();
  // T160: a remote art pack from the remote catalogue resolves too (bundled themes win).
  const remote = useRemoteArtTheme(typeof id === 'string' ? id : undefined);
  const theme = getAnyTheme(typeof id === 'string' ? id : undefined) ?? remote.theme;
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  // T179: a remote id opened before the cached catalogue is read waits on a skeleton, not "not found".
  const settled = useCatalogSettled();
  const pageState = themePageState({ found: !!theme, packsEnabled: PACKS_ENABLED, catalogSettled: settled });

  if (pageState === 'wait') return <ThemePageSkeleton />;
  if (!theme) {
    return (
      <View style={[styles.missing, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: t('theme.title') }} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('title2')} style={[...typeFor(script, 'title2'), { color: c.ink }]}>
          {t('theme.notFound')}
        </Text>
        <PillButton label={t('theme.backToThemes')} onPress={() => router.back()} />
      </View>
    );
  }
  const own = remote.theme === theme;
  return (
    <ThemeDetail
      theme={theme}
      step={themeStepOf(stepParam)}
      remoteWallpaperUri={own ? remote.wallpaperUri : null}
      remoteHeroUris={own ? remote.heroUris : null}
      remoteHeroSizes={own ? remote.heroPx : null}
    />
  );
}

function ThemeDetail({
  theme: base,
  step,
  remoteWallpaperUri,
  remoteHeroUris,
  remoteHeroSizes,
}: {
  theme: Theme;
  /** T185: the overview (preview + "Use this theme" + three entry points), or its Wallpaper / Icons screen. */
  step: ThemeStep;
  remoteWallpaperUri: string | null;
  /** T168: downloaded hero art of a remote art pack (seamless widget card). */
  remoteHeroUris: Partial<Record<HeroSize, string>> | null;
  /** T208: pixel size of each downloaded hero piece (manifest), so the preview fits the real piece. */
  remoteHeroSizes: Partial<Record<HeroSize, { w: number; h: number }>> | null;
}) {
  const { c, scheme } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  // T47: pack themes download their artwork. The detail shows Download / progress / error / ready,
  // and uses the downloaded copy (with any pack-only motifs) once it is on the phone.
  const pack = usePackAccess(base);
  // T160: a remote art pack always downloads first (free packs without Plus).
  const remoteArt = isRemoteArtTheme(base) ? base : null;
  const packView = remoteArt ? remoteArtDetailView(pack) : packDetailView(base, pack);
  const theme = usePackTheme(base, wantsPackArtwork(packView));
  const canApply = canApplyFromDetail(packView);
  // T179: a remote theme's glass bar holds its one primary action: Download (with the size), then a
  // determinate progress bar, a calm Try again, and "Use this theme" once the art is on the phone.
  const primary: RemotePrimary | null = remoteArt ? remotePrimary(packView, remoteArt.remoteArt.bytes, t('plus.packErrors.appVersion')) : null;
  const heroArt = remoteArt ? remoteHeroArt({ wallpaperUri: remoteWallpaperUri, thumbUrl: remoteArt.remoteArt.thumbUrl }) : null;
  const packName = remoteArt ? remoteArt.name : base.packId ? (packOf(base.id)?.name ?? base.packId) : '';
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
  // T184 / T185: the theme in use across every tab ("In use ✓"), re-read on focus.
  const activeId = useActiveThemeId();
  const inUse = isThemeInUse(activeId, theme.id);
  const [useBusy, setUseBusy] = useState(false);
  const [useError, setUseError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** T185: this theme's wallpaper was saved to Photos before (badge only; Save again always shows). */
  const [savedBefore, setSavedBefore] = useState(false);
  /** fb-1024 C: the real reason a save failed, in plain words, plus the technical detail. */
  const [saveWhy, setSaveWhy] = useState<{ why: SaveFailure; detail?: string } | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleError, setStyleError] = useState(false);
  const locked = useLocked(theme.plus);
  const [lockOpen, setLockOpen] = useState(false);
  /** Why the Plus sheet is open: unlocking from Download shouldn't put the theme in use. */
  const lockFor = useRef<'apply' | 'download' | ThemeStep | 'widgets'>('apply');
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

  // G6: Home / Lock mocks share one frame and cross-fade (both stay mounted). The Wallpaper screen
  // opens on the Lock Screen.
  const [mode, setMode] = useState<PreviewMode>(step === 'wallpaper' ? 'lock' : 'home');
  const homeShown = useSharedValue(mode === 'home' ? 1 : 0);
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

  // G3: using the theme ripples the icons into the Home mock, then a light haptic and a single
  // sheen across "Install icons". Reduced motion: HomeMock skips the ripple and settles at once,
  // SheenButton swaps the sweep for a short fade.
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
    haptic('light');
    setSheenKey((k) => k + 1);
  };

  const [barH, setBarH] = useState(0);

  // T185: the saved flag is per theme and only changes the badge and the label; re-read on focus.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      wasWallpaperSaved(theme.id).then((saved) => {
        if (alive) setSavedBefore(saved);
      });
      return () => {
        alive = false;
      };
    }, [theme.id]),
  );

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
    <ExpoImage source={{ uri: spacePhoto.uri }} contentFit="cover" cachePolicy="memory-disk" style={{ width: screenW, height: screenH }} accessibilityIgnoresInvertColors /> // i18n-ignore (code after a JSX element)
  ) : null;
  // T105: what the Wallpaper screen saves (own photo > downloaded Webb photo > drawn wallpaper);
  // a Space theme whose photo isn't on the phone yet offers the download first.
  const wallSource: WallpaperSource = wallpaperSourceFor({ ownPhoto: !!photo, isSpace: !!spacePhoto.photo, spaceReady: !!spacePhoto.uri });
  const spaceCredit = spacePhoto.photo ? photoCreditParams(spacePhoto.photo.photo) : null;
  const [savedFrom, setSavedFrom] = useState<WallpaperSource | null>(null);
  // T130: an art-pack theme shows (and saves) its bundled wallpaper image; the own photo still wins.
  const artPack = artPackOf(theme);
  const artImage = artPack ? artPackWallpaper(artPack.artPack.id) : null;
  /** T173: the Credits block shows only when there is a photo or art credit to show. */
  const hasCredits = !!spacePhoto.photo || !!(artPack && artPack.artPack.credits);
  const artBackground =
    artImage != null ? (
      <ExpoImage source={artImage} contentFit="cover" cachePolicy="memory-disk" style={{ width: screenW, height: screenH }} accessibilityIgnoresInvertColors /> // i18n-ignore (code after a JSX element)
    ) : remoteArt ? (
      <RemoteArtImage theme={remoteArt} localUri={remoteWallpaperUri} width={screenW} height={screenH} /> // i18n-ignore (code after a JSX element)
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

  /**
   * T184 / T185: "Use this theme" makes it the base for every tab in one go: the icon style
   * (Icons tab), the widget theme (Widgets tab + the Home Screen widgets) and the theme in use
   * (wallpaper maker, "In use ✓"). Saving wallpaper and installing icons stay separate screens.
   */
  const putInUse = async () => {
    if (useBusy) return;
    setUseBusy(true);
    setUseError(false);
    try {
      const res = await applyThemeEverywhere(theme);
      if (!res.icons) {
        setUseError(true);
        haptic('warning');
        return;
      }
      playApply();
      AccessibilityInfo.announceForAccessibility(t('theme.use.doneA11y', { name: theme.name }));
    } finally {
      setUseBusy(false);
    }
  };
  const onUseTheme = () => {
    if (locked) {
      lockFor.current = 'apply';
      setLockOpen(true);
      return;
    }
    void putInUse();
  };

  /** T185: the three separate entry points, each its own clean screen. */
  const openPart = (part: 'wallpaper' | 'icons' | 'widgets', checkLock = true) => {
    if (checkLock && locked) {
      lockFor.current = part;
      setLockOpen(true);
      return;
    }
    // T201: Widgets is the theme's own widgets screen (practical, art, then the standard set, which
    // still opens Widget Studio), not Widget Studio directly.
    router.push({ pathname: '/theme/[id]', params: { id: theme.id, step: part } });
  };

  const onDownloadPack = async () => {
    if (pack.state === 'downloading') return;
    haptic('select');
    const r = await pack.download();
    if (r === 'locked') {
      lockFor.current = 'download';
      setLockOpen(true);
    } else if (r === 'ok') {
      // T179 (PREMIUM_UI §1.7): `success` stays the one end-of-flow moment; a finished download is a step.
      haptic('light');
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
    // T160: a downloaded remote art pack saves its local wallpaper file. T179: one the page hasn't
    // resolved yet is read now; a remote pack whose file is gone reports it (never the drawn fallback).
    // The file is .webp: RN Image.getSize and the offscreen <Image> decode it (iOS 14+, Android), and
    // view-shot captures the cropped view as PNG, so Photos always gets a PNG.
    const remoteFile = remoteArt && !photo ? (remoteWallpaperUri ?? (await downloadedRemoteWallpaper(remoteArt.id))) : null;
    const artPackUri = artPack ? (artPackWallpaperUri(artPack.artPack.id) ?? remoteFile) : null;
    const remoteMissing = !!remoteArt && !photo && !artPackUri;
    const res: { ok: boolean; reason?: string; why?: SaveFailure; message?: string } = remoteMissing
      ? { ok: false, why: 'unreadable' }
      : photo
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
      setSavedBefore(true);
      haptic('success');
      AccessibilityInfo.announceForAccessibility(t('theme.save.savedBadge'));
      void rememberWallpaperSaved(theme.id);
      void tickStoredChecklist(theme.id, 'wallpaper');
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
      void tickStoredChecklist(theme.id, 'iconStyle');
      void runInstalledProbe(); // T229: tick the popular apps on this iPhone; never throws
      // navigate, not push: push would stack a second copy of the tab navigator.
      router.navigate(destination);
    } catch {
      setStyleError(true);
    } finally {
      setStyleBusy(false);
    }
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
  const overview = step === 'overview';
  const showBar = overview && canApply && (!primary || primary.kind === 'apply');
  /** T179: a remote theme not on the phone yet: Download / progress / Try again / Unlock in the bar. */
  const showDownloadBar = overview && !!primary && primary.kind !== 'apply';
  const onUnlockRemote = () => {
    haptic('select');
    lockFor.current = 'download';
    setLockOpen(true);
  };
  const photoLabel = photo ? t('theme.photo.change') : t('theme.photo.use');
  const screenStyle = [
    styles.screen,
    continuous,
    noMirror,
    { width: screenW, borderRadius: screenRadius, backgroundColor: theme.palette.bg },
  ];
  const saving = saver.saving || photoSaver.saving;
  const saveView = wallpaperSaveView(savedBefore || saveState === 'saved', saving);
  const title =
    step === 'wallpaper'
      ? t('theme.parts.wallpaper')
      : step === 'icons'
        ? t('theme.parts.icons')
        : step === 'widgets'
          ? t('theme.parts.widgets')
          : theme.name;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title, headerTintColor: c.tint }} />
      <ScrollView bounces={false} overScrollMode="never"
        contentContainerStyle={[styles.content, { paddingBottom: (showBar || showDownloadBar ? barH : insets.bottom) + spaceV2.xxl }]}
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
            <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('title1')} style={[...ts('title1'), { color: c.ink }]}>
              {theme.name}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.inkSecondary }]}>
              {overview
                ? theme.tagline
                : step === 'wallpaper'
                  ? t('theme.parts.wallpaperSub')
                  : step === 'widgets'
                    ? t('theme.parts.widgetsSub')
                    : t('theme.parts.iconsSub')}
            </Text>
            {theme.plus ? <PlusBadge /> : null}
          </View>
        </View>
        {/* fb-1022 G1: the first-run hints moved here from the Themes screen. They appear after the
            first action (opening a theme), one line at a time, never stacked; "?" brings them back. */}
        {overview ? <ContextTip ids={DETAIL_TIPS} /> : null}

        {overview && !remoteArt && showsPackCard(packView) ? <PackCard view={packView} packName={packName} onDownload={onDownloadPack} /> : null}
        {/* T222: a newer version of this downloaded pack is listed: background update state + manual Update. */}
        {overview && remoteArt && packView.kind === 'ready' ? (
          <PackUpdateNote
            theme={remoteArt}
            packName={packName}
            onLocked={() => {
              lockFor.current = 'download';
              setLockOpen(true);
            }}
          />
        ) : null}

        {/* L2 + T173 hero: one large phone-shaped preview, centred on a soft surface (layered
            shadow, no border), with a quiet Home / Lock pill under it. */}
        <SquircleCard size="large" elevation="card" padding={spaceV2.xl} style={styles.side}>
          <View style={styles.previewCol}>
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
            <Segmented<PreviewMode>
              label={t('theme.mode.label')}
              options={previewModes(t)}
              value={mode}
              onChange={setMode}
              style={[styles.modeToggle, { width: modePillWidthFor(phoneW) }]}
            />
            {mode === 'home' ? <PreviewModeLabel iosMask={iosMask} /> : null}
            {/* T179: a remote theme says what the hero shows: the catalogue preview, or the downloaded art. */}
            {heroArt ? (
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.heroNote, { color: c.inkSecondary }]}>
                {heroArt.stage === 'downloaded' ? t('theme.remote.heroDownloaded') : t('theme.remote.heroPreview')}
              </Text>
            ) : null}
          </View>
        </SquircleCard>

        {/* T185 (owner-1101 item 3): three clear, separate entry points, each its own clean screen. */}
        {overview && canApply ? (
          <View style={styles.block}>
            {/* T200 (owner-1101d #3): a bold section header (title1, one heading for VoiceOver) with
                a one-line subtitle, so the eye lands on it before the three cards. */}
            <View style={styles.setUpHead} accessible accessibilityRole="header" accessibilityLabel={[t('theme.parts.title'), t('theme.parts.subtitle')].join(', ')}>
              <View style={[styles.setUpRule, { backgroundColor: c.tint }]} />
              <Text maxFontSizeMultiplier={fontScaleCap('title1')} style={[...ts('title1'), styles.setUpTitle, { color: c.ink }]}>
                {t('theme.parts.title')}
              </Text>
              <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.inkSecondary }]}>
                {t('theme.parts.subtitle')}
              </Text>
            </View>
            {/* T210 (premium pass): three lifted entry cards on the 16 pt rhythm instead of one
                ruled inset group; each leads with a small piece of this theme (a phone in its
                wallpaper colours, four of its icons, a widget in its palette), then the name, one
                line, and "Saved to Photos ✓" on the wallpaper card once saved. */}
            <View style={styles.parts}>
              <PartCard
                title={t('theme.parts.wallpaper')}
                subtitle={t('theme.parts.wallpaperSub')}
                status={savedBefore ? t('theme.save.savedBadge') : null}
                art={<PartWallpaperArt theme={theme} />}
                onPress={() => openPart('wallpaper')}
                accessibilityHint={t('theme.parts.wallpaperSub')}
              />
              <PartCard
                title={t('theme.parts.icons')}
                subtitle={t('theme.parts.iconsSub')}
                art={<PartIconsArt specs={specs} />}
                onPress={() => openPart('icons')}
                accessibilityHint={t('theme.parts.iconsSub')}
              />
              <PartCard
                title={t('theme.parts.widgets')}
                subtitle={t('theme.parts.widgetsSub')}
                art={<PartWidgetArt theme={theme} />}
                onPress={() => openPart('widgets')}
                accessibilityHint={t('theme.parts.widgetsSub')}
              />
            </View>
          </View>
        ) : null}

        {/* T185: the Wallpaper screen. "Saved to Photos ✓" once saved, and Save again always offered
            (someone who deleted it from Photos gets it back). */}
        {step === 'wallpaper' ? (
          <SquircleCard size="large" elevation="raised" style={styles.side}>
            <View style={styles.stack}>
              <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]}>
                {photo
                  ? t('theme.save.bodyPhoto', sizeParams)
                  : wallSource === 'space-photo'
                    ? t('ui.photoCredit.applyBody', sizeParams)
                    : t('theme.save.body', sizeParams)}
              </Text>
              {/* T105: a Space theme offers its Webb photo download first (Retry on failure, T108). */}
              {wallSource === 'space-offer-download' ? (
                <View style={styles.gap}>
                  <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('ui.photoCredit.applyOffer')}</Text>
                  <PhotoDownloadControl p={spacePhoto} allowRemove={false} />
                </View>
              ) : null}
              {/* The credit stays with the Webb photo wherever it is saved (T108). */}
              {wallSource === 'space-photo' && spaceCredit ? (
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]} selectable>
                  {t('ui.photoCredit.creditLine', spaceCredit)}
                </Text>
              ) : null}
              {saveView.badge ? (
                <View style={[styles.note, continuous, { backgroundColor: c.pastels.mint.fill }]} accessibilityLiveRegion="polite">
                  <Feather name="check" size={18} color={c.pastels.mint.ink} />
                  <View style={[styles.flex, styles.gap]}>
                    <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...ts('headline'), { color: c.pastels.mint.ink }]}>
                      {t('theme.save.savedBadge')}
                    </Text>
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.pastels.mint.ink }]} selectable={savedFrom === 'space-photo'}>
                      {savedFrom === 'space-photo' && spaceCredit ? t('ui.photoCredit.savedCredit', spaceCredit) : t('theme.save.saved')}
                    </Text>
                  </View>
                </View>
              ) : null}
              {saveState === 'denied' ? (
                <View style={styles.gap}>
                  <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.warn }]}>{t('theme.save.denied')}</Text>
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
                  <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.warn }]}>
                    {saveWhy && saveFailureKey(saveWhy.why) ? t(`theme.save.why.${saveWhy.why}`) : t('theme.save.error')}
                  </Text>
                  {saveWhy?.detail ? (
                    <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]} selectable>
                      {saveWhy.detail}
                    </Text>
                  ) : null}
                  {saveWhy && offersOpenSettings(saveWhy.why) ? (
                    <PillButton
                      label={t('theme.save.openSettings')}
                      icon="settings"
                      variant="plain"
                      size="small"
                      onPress={openAppSettings}
                    />
                  ) : null}
                </View>
              ) : null}
              {/* T185: never hidden. The label reads Save again once saved. */}
              <PillButton
                label={t(`theme.save.${saveView.label}`)}
                icon={saveView.badge ? 'refresh-cw' : 'download'}
                variant={saveView.badge ? 'tinted' : 'filled'}
                block
                busy={saving}
                onPress={onSaveWallpaper}
              />
              {/* T173 §3.3: while the wallpaper saves, a skeleton of the result (a phone-shaped wallpaper in the theme's colour). */}
              {saver.saving || photoSaver.saving ? (
                <Skeleton width={WALL_SKELETON_W} height={Math.round(WALL_SKELETON_W * PHONE_ASPECT)} radius={radiusV2.control} colour={theme.palette.surface} style={styles.wallSkeleton} />
              ) : null}
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.checklist.wallpaper.pairBody')}</Text>
              <PillButton
                label={t('theme.checklist.wallpaper.pairCta')}
                icon="layers"
                variant="plain"
                size="small"
                onPress={() => router.push({ pathname: '/wallpaper', params: { theme: theme.id } })}
              />
            </View>
          </SquircleCard>
        ) : null}

        {/* T185: the Icons screen: the style (with the shape choice), then install. */}
        {step === 'icons' ? (
          <SquircleCard size="large" elevation="raised" style={styles.side}>
            <View style={styles.stack}>
              <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]}>{t('theme.style.body')}</Text>
              {/* T179: art packs bring wallpaper + widget art; their icons are Glaze glyphs in the theme's colours. */}
              {remoteArt ? (
                <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.remote.iconsNote')}</Text>
              ) : null}
              {styleError ? <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.warn }]}>{t('theme.style.error')}</Text> : null}
              <PillButton
                label={styleBusy ? t('common.loading') : t('theme.style.cta')}
                icon="grid"
                block
                busy={styleBusy}
                onPress={() => void onUseStyle()}
                accessibilityHint={t('theme.style.hint')}
              />
              {/* T173 §3.3: while the icon style renders, a skeleton of the result (icon tiles), not a spinner. */}
              {styleBusy ? <IconGridSkeleton count={4} size={48} /> : null}
              <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...ts('body'), { color: c.ink }]}>{t('theme.install.body')}</Text>
              <SheenButton
                label={t('theme.install.cta')}
                icon="upload"
                sheenKey={sheenKey}
                onPress={() => {
                  void onUseStyle('/install');
                }}
              />
            </View>
          </SquircleCard>
        ) : null}

        {/* T173 (PREMIUM_UI §3.3): editorial blocks, each one eyebrow + title (SectionHeader reads
            them as one heading), quiet cards and inset rows under it, so "Use this theme" stays the
            one primary action. Order: Icons, Widgets, Wallpaper, Credits (T200: no "What's inside"). */}
        {/* T26 + fb-1022 G2: the icon shape picker sits behind one collapsed "Shape" row (on the Icons
            screen since T185), with the "How it looks on iPhone" switch inside. */}
        {step === 'icons' ? (
          <View style={styles.block}>
            <SectionHeader eyebrow={t('theme.section.icons.eyebrow')} title={t('theme.section.icons.title')} style={styles.sectionHead} />
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
            {locked || !canApply ? null : (
              <View style={styles.side}>
                <ThemeOverrideRow theme={theme} />
              </View>
            )}
          </View>
        ) : null}

        {/* T201 (owner-1101d #4): the Widgets screen, in the shelf order every widgets screen uses
            (src/core/widgetOptions.ts widgetShelf / WIDGET_SHELF_ORDER): (a) the theme's practical
            pieces (habits, countdown, calendar, clock, battery… with Make it live), (b) its art
            pieces (any piece in any size, fitted), then (c) the standard widgets in its palette.
            The overview keeps only (c) as a teaser; the Widgets card opens this screen. */}
        {step === 'widgets' ? <ThemeWidgetsShelf theme={theme} /> : null}
        {/* T133: the Seamless widget (wallpaper crop + floating art), art-pack themes only: part of (b). */}
        {step === 'widgets' && artPack ? <SeamlessCard artPackId={artPack.artPack.id} theme={theme} wallpaperUri={remoteWallpaperUri} heroUris={remoteHeroUris} remoteHeroSizes={remoteHeroSizes} /> : null}
        {overview || step === 'widgets' ? (
          <View style={styles.block}>
            <SectionHeader
              eyebrow={t('theme.section.widgets.eyebrow')}
              title={t('theme.widgetPreviews.title')}
              body={t('theme.widgetPreviews.body')}
              style={styles.sectionHead}
            />
            <WidgetPreviews theme={theme} palette={palette} />
          </View>
        ) : null}

        {/* Make it yours (Wallpaper screen): quiet rows for the photo and the wallpaper editor. */}
        {step === 'wallpaper' ? (
          <View style={styles.block}>
            <SectionHeader eyebrow={t('theme.section.wallpaper.eyebrow')} title={t('theme.customise')} style={styles.sectionHead} />
            <InsetGroup footer={photo ? t('theme.photo.yours', { name: theme.name }) : t('theme.photo.prompt')}>
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
          </View>
        ) : null}

        {hasCredits ? (
          <View style={styles.block}>
            <SectionHeader eyebrow={t('theme.section.credits.eyebrow')} title={t('theme.section.credits.title')} style={styles.sectionHead} />
            {/* T103 (fb-1022 G5a): credit + licence for a Webb photo, with Download / Remove (on a tap only). */}
            {spacePhoto.photo ? <PhotoCredit theme={theme} style={styles.side} /> : null}
            {/* T130: credit + licence for an art-pack theme (from its meta.json). */}
            {artPack && artPack.artPack.credits ? <ArtPackCredit theme={artPack} style={styles.side} /> : null}
          </View>
        ) : null}

        <OffscreenWallpaper ref={saver.ref} job={saver.job} />
        <OffscreenPhotoWallpaper ref={photoSaver.ref} job={photoSaver.job} onReady={photoSaver.markReady} />
      </ScrollView>

      {/* T185: the one primary action, sticky on chrome glass: "Use this theme" (the base for every
          tab), or "In use ✓" when it already is. Wallpaper, Icons and Widgets are separate screens. */}
      {showBar ? (
        <GlassBar material="chrome" hairline="top" style={styles.bar}>
          <View
            onLayout={(e: LayoutChangeEvent) => setBarH(e.nativeEvent.layout.height)}
            style={[styles.barInner, { paddingBottom: insets.bottom + spaceV2.sm }]}
          >
            <PillButton
              label={useBusy ? t('common.loading') : inUse ? t('theme.use.inUse') : t('theme.use.cta')}
              icon={locked ? 'lock' : 'check-circle'}
              block
              busy={useBusy}
              onPress={onUseTheme}
              accessibilityHint={locked ? t('theme.applyHintLocked') : inUse ? t('theme.use.inUseHint') : t('theme.use.hint')}
            />
            {useError ? (
              <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.barNote, { color: c.warn }]}>
                {t('theme.use.error')}
              </Text>
            ) : null}
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.barNote, { color: c.inkSecondary }]}>
              {inUse ? t('theme.use.inUseNote') : t('theme.use.note')}
            </Text>
          </View>
        </GlassBar>
      ) : null}

      {showDownloadBar && primary && remoteArt ? (
        <RemoteDownloadBar
          primary={primary}
          name={remoteArt.name}
          free={!remoteArt.remoteArt.plus}
          bottomInset={insets.bottom}
          onLayout={(e: LayoutChangeEvent) => setBarH(e.nativeEvent.layout.height)}
          onDownload={() => void onDownloadPack()}
          onUnlock={onUnlockRemote}
        />
      ) : null}

      <PlusLockSheet
        visible={lockOpen}
        onClose={() => setLockOpen(false)}
        subject={t('theme.lockSubject', { name: theme.name })}
        onUnlocked={() => {
          const why = lockFor.current;
          if (why === 'download') {
            void onDownloadPack();
            return;
          }
          if (why === 'apply' || why === 'overview') {
            void putInUse();
            return;
          }
          openPart(why, false);
        }}
      />
    </View>
  );
}

/**
 * T59: the theme's matching widgets (one per kind, small size when it has one), drawn in-app so
 * they work in Expo Go. Tapping one opens Widget Studio on that widget. Kinds come from the
 * generated set, so new widget kinds appear here automatically.
 */
function WidgetPreviews({ theme, palette }: { theme: Theme; palette: readonly (readonly [string, string])[] }) {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const tl = t as unknown as (key: string) => string;
  const set = useMemo(() => generateWidgetSet(theme), [theme]);
  // T80: show what the person made in Widget Studio (reloaded on every focus, so a save there
  // shows up when they come back). Until it loads, the plain set is shown.
  const [saved, setSaved] = useState<StudioState | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadStudio(set)
        .then((s) => {
          if (alive) setSaved(s);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [set]),
  );
  const items = useMemo(() => studioPreviews(set, saved), [set, saved]);
  const open = (kind?: string, size?: string) => {
    haptic('select');
    router.push({ pathname: '/widget-studio', params: { theme: theme.id, ...(kind ? { kind } : {}), ...(size ? { size } : {}) } });
  };
  return (
    <SquircleCard style={styles.side}>
      <View style={styles.stack}>
        {/* T173: the title and body moved into the Widgets block's SectionHeader. */}
        {/* T200: the theme's palette lives here, with the widgets it colours. */}
        <View style={styles.paletteRow}>
          {palette.map(([name, hex]) => (
            <View
              key={name}
              accessible
              accessibilityLabel={t('theme.a11y.swatch', { name, hex })}
              style={[styles.paletteDot, { backgroundColor: hex, borderColor: c.separator }]}
            />
          ))}
        </View>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>
          {t('theme.widgetPreviews.palette')}
        </Text>
        <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.widgetRow}>
          {items.map(({ spec, photoUri }) => (
            <Pressable
              key={spec.id}
              accessibilityRole="button"
              accessibilityLabel={t('theme.widgetPreviews.itemA11y', { kind: tl(widgetKindKey(spec.kind)), size: tl(widgetSizeKey(spec.size)) })}
              accessibilityHint={t('theme.widgetPreviews.hint')}
              onPress={() => open(spec.kind, spec.size)}
              style={({ pressed }) => [styles.widgetItem, { opacity: pressed ? 0.75 : 1 }]}
            >
              <WidgetPreview spec={spec} width={WIDGET_PREVIEW_W} photoUri={photoUri} />
              <Text maxFontSizeMultiplier={fontScaleCap('caption1')} style={[...typeFor(script, 'caption1'), { color: c.ink }]} numberOfLines={2}>
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

const SHELF_SIZES: readonly HomeOptionSize[] = ['small', 'medium', 'large'];

/**
 * T201: the theme's practical pieces then its art pieces (ThemeWidgetArt → WidgetArtMenu, ordered by
 * src/core/widgetOptions.ts widgetShelf), for a Home Screen size picked here. Every piece is offered
 * in every size, fitted. "Use on my widget" writes the App Group and reloads the widgets (bridge).
 * Draws nothing for a theme with no widget art (its standard widgets follow below).
 */
function ThemeWidgetsShelf({ theme }: { theme: Theme }) {
  const { t } = useT();
  const tl = t as unknown as (key: string) => string;
  const window = useWindowDimensions();
  const [size, setSize] = useState<HomeOptionSize>('small');
  const width = window.width - spaceV2.lg * 2;
  return (
    <View style={[styles.side, styles.shelf]}>
      <Segmented<HomeOptionSize>
        label={t('tabs.widgetsTab.sizes')}
        options={SHELF_SIZES.map((s) => ({ value: s, label: tl(widgetTabSizeKey(s)) }))}
        value={size}
        onChange={setSize}
      />
      <ThemeWidgetArt theme={theme} size={size} width={width} />
    </View>
  );
}

const WIDGET_PREVIEW_W = 112;
/** T173 §3.3: width of the wallpaper-save skeleton (height follows the phone aspect). */
const WALL_SKELETON_W = 72;

type SeamlessStatus = 'idle' | 'busy' | 'saved' | 'unavailable' | 'failed';

/**
 * T133: the Seamless widget card on an art-pack theme. T168: a downloaded remote pack uses its
 * local files (wallpaperUri / heroUris); a file that is missing or fails to load falls back to the
 * theme's drawn gradient (wallpaper) or no hero, via src/core/seamlessSource.ts. A mock Home Screen shows the widget cut from
 * the wallpaper with the art floating on top; size / spot / nudge pick where it sits, and "Use for
 * my Glaze widget" writes the image through the widget bridge. Expo Go: the button explains that
 * the TestFlight app is needed; nothing throws.
 */
function SeamlessCard({
  artPackId,
  theme,
  wallpaperUri: remoteWallpaper,
  heroUris,
  remoteHeroSizes,
}: {
  artPackId: string;
  theme: Theme;
  wallpaperUri: string | null;
  heroUris: Partial<Record<HeroSize, string>> | null;
  remoteHeroSizes: Partial<Record<HeroSize, { w: number; h: number }>> | null;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const window = useWindowDimensions();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const [size, setSize] = useState<SeamlessSize>('small');
  const [slot, setSlot] = useState<SeamlessSlot>('top-left');
  const [nudge, setNudge] = useState<Nudge>({ dx: 0, dy: 0 });
  const [status, setStatus] = useState<SeamlessStatus>('idle');
  // T168: sources that failed to load (or were not on the phone) fall back for this visit.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const markFailed = useCallback((key: string) => {
    setFailed((f) => (f.includes(key) ? f : [...f, key]));
  }, []);
  const sources = seamlessCardSources({
    bundledWallpaper: artPackWallpaper(artPackId),
    wallpaperUri: remoteWallpaper,
    bundledHero: artPackHero(artPackId, size),
    heroUri: heroUris?.[size] ?? null,
    failed,
  });
  const wallpaperSrc = sources.wallpaper;
  const heroSrc = sources.hero;
  const fallbackWallpaper = useCallback(
    (w: number, h: number) => <WallpaperView params={theme.wallpaper} width={w} height={h} maxGrain={120} />,
    [theme.wallpaper],
  );
  // T208: a downloaded piece is fitted at its real size (a v2 piece may be square in every size);
  // a bundled hero is the reference size for its slot.
  const heroRef = HERO_REFERENCE_SIZES[size];
  const heroPx = (heroSrc.kind === 'file' ? remoteHeroSizes?.[size] : undefined) ?? { w: heroRef.width, h: heroRef.height };
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

  if (!sources.show) return null;

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
        const wallpaperUri =
          wallpaperSrc.kind === 'bundled'
            ? await localAssetUri(wallpaperSrc.module, `${artPackId}-wallpaper.png`)
            : wallpaperSrc.kind === 'file'
              ? await existingLocalFile(wallpaperSrc.uri)
              : null;
        const heroUri =
          heroSrc.kind === 'bundled'
            ? await localAssetUri(heroSrc.module, `${artPackId}-${size}.png`)
            : heroSrc.kind === 'file'
              ? await existingLocalFile(heroSrc.uri)
              : null;
        // A downloaded file that is gone falls back in the preview too.
        if (wallpaperSrc.kind === 'file' && !wallpaperUri) markFailed(seamlessSourceKey(wallpaperSrc));
        if (heroSrc.kind === 'file' && !heroUri) markFailed(seamlessSourceKey(heroSrc));
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
        <Text maxFontSizeMultiplier={fontScaleCap('title3')} accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
          {t('ui.seamless.title')}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.inkSecondary }]}>{t('ui.seamless.body')}</Text>
        <SeamlessWidgetPreview
          wallpaper={seamlessImageSource(wallpaperSrc)}
          fallbackWallpaper={fallbackWallpaper}
          onWallpaperError={() => markFailed(seamlessSourceKey(wallpaperSrc))}
          onHeroError={() => markFailed(seamlessSourceKey(heroSrc))}
          wallpaperPx={{ w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height }}
          hero={seamlessImageSource(heroSrc)}
          heroPx={heroPx}
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
          disabled={!sources.canWrite}
          onPress={onUse}
          accessibilityHint={t('ui.seamless.useHint')}
        />
        {statusLine ? (
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} accessibilityLiveRegion="polite" style={[...ts('footnote'), { color: status === 'saved' ? c.ok : status === 'failed' ? c.warn : c.inkSecondary }]}>
            {statusLine}
          </Text>
        ) : null}
        <Text maxFontSizeMultiplier={fontScaleCap('headline')} accessibilityRole="header" style={[...ts('headline'), { color: c.ink }]}>
          {t('ui.seamless.howTitle')}
        </Text>
        <View style={styles.gap}>
          {how.map((line, i) => (
            <View key={i} style={styles.howRow}>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.howNum, { color: c.inkSecondary }]}>{i + 1}.</Text>
              <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), styles.flex, { color: c.inkSecondary }]}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </SquircleCard>
  );
}

/**
 * T179: the glass bar of a remote theme that is not on the phone yet. One primary pill: Download
 * with the size; while downloading a determinate bar (capped at 99 % until verified); offline, a
 * 404 or a damaged file all read as one calm line with Try again (never an error code); a Plus pack
 * without Plus offers Unlock (the Plus sheet then starts the download).
 */
function RemoteDownloadBar({
  primary,
  name,
  free,
  bottomInset,
  onLayout,
  onDownload,
  onUnlock,
}: {
  primary: RemotePrimary;
  name: string;
  /** Free pack (the "Free. Wallpaper, widget art…" line shows only then). */
  free: boolean;
  bottomInset: number;
  onLayout: (e: LayoutChangeEvent) => void;
  onDownload: () => void;
  onUnlock: () => void;
}) {
  const { t, locale } = useT();
  const note = (text: string, live = false) => <BarNote text={text} live={live} />; // i18n-ignore (code after a JSX element)
  return (
    <GlassBar material="chrome" hairline="top" style={styles.bar}>
      <View onLayout={onLayout} style={[styles.barInner, { paddingBottom: bottomInset + spaceV2.sm }]}>
        {primary.kind === 'download' ? (
          <>
            <PillButton
              label={primary.bytes ? t('theme.remote.downloadSize', { size: formatBytes(primary.bytes, locale) }) : t('theme.remote.download')}
              icon="download"
              block
              onPress={onDownload}
              accessibilityLabel={
                primary.bytes ? t('theme.remote.downloadA11y', { name, size: formatBytes(primary.bytes, locale) }) : t('theme.remote.download')
              }
              accessibilityHint={t('theme.remote.downloadHint')}
            />
            {free ? note(t('theme.remote.includes')) : null}
          </>
        ) : null}
        {primary.kind === 'downloading' ? (
          <>
            {/* percent is capped at 99 until the files are verified */}
            <ProgressBar progress={primary.percent / 100} label={t('theme.remote.downloading', { name })} />
            {note(t('theme.pack.downloadingNote'))}
          </>
        ) : null}
        {primary.kind === 'retry' ? (
          <>
            {note(primary.reason === 'app-version' ? t('plus.packErrors.appVersion') : t('theme.remote.offline'), true)}
            {primary.reason === 'app-version' ? null : (
              <PillButton label={t('theme.pack.retry')} icon="refresh-cw" block onPress={onDownload} accessibilityHint={t('theme.pack.retryHint')} />
            )}
          </>
        ) : null}
        {primary.kind === 'unlock' ? (
          <>
            <PillButton label={t('theme.remote.unlock')} icon="lock" block onPress={onUnlock} accessibilityHint={t('theme.applyHintLocked')} />
            {note(t('theme.pack.locked'))}
          </>
        ) : null}
      </View>
    </GlassBar>
  );
}

/** T179: a quiet centred line in the download bar (polite live region for the Try again line). */
function BarNote({ text, live }: { text: string; live: boolean }) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <Text
      accessibilityLiveRegion={live ? 'polite' : undefined}
      maxFontSizeMultiplier={fontScaleCap('footnote')}
      style={[...typeFor(script, 'footnote'), styles.barNote, { color: c.inkSecondary }]}
    >
      {text}
    </Text>
  );
}

/** T179: the theme page while the cached catalogue is read: the hero phone and title as skeletons. */
function ThemePageSkeleton() {
  const { c } = useColorsV2();
  const { t } = useT();
  const window = useWindowDimensions();
  const phoneW = previewWidthFor(window.width);
  return (
    <View
      style={[styles.root, styles.skeletonPage, { backgroundColor: c.bg }]}
      accessible
      accessibilityLabel={t('theme.remote.loadingA11y')}
    >
      <Stack.Screen options={{ title: '' }} />
      <Skeleton width={Math.round(phoneW * 0.7)} height={28} radius={radiusV2.control} />
      <Skeleton width={Math.round(phoneW * 0.5)} height={16} radius={radiusV2.control} />
      <Skeleton width={phoneW} height={Math.round(phoneW * PHONE_ASPECT)} radius={radiusV2.cardLarge} style={styles.skeletonHero} />
    </View>
  );
}

/** T47: the pack card on a pack theme's detail (Download, progress, error + Try again, downloaded). */
function PackCard({ view, packName, onDownload, bytes }: { view: PackDetailView; packName: string; onDownload: () => void; bytes?: number }) {
  const { c } = useColorsV2();
  const { t, script, locale } = useT();
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
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} accessibilityRole="header" style={[...ts('headline'), styles.flex, { color: c.ink }]}>
            {t('theme.pack.title', params)}
          </Text>
        </View>
        {view.kind === 'locked' ? <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.inkSecondary }]}>{t('theme.pack.locked')}</Text> : null}
        {view.kind === 'bundled' ? <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.pack.bundled')}</Text> : null}
        {view.kind === 'download' ? (
          <>
            <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.ink }]}>{t('theme.pack.download', params)}</Text>
            {bytes ? <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.pack.size', { size: formatBytes(bytes, locale) })}</Text> : null}
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
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('theme.pack.downloadingNote')}</Text>
          </>
        ) : null}
        {view.kind === 'error' ? (
          <>
            <Text maxFontSizeMultiplier={fontScaleCap('callout')} accessibilityLiveRegion="polite" style={[...ts('callout'), { color: c.warn }]}>
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
        {view.kind === 'ready' ? <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), { color: c.inkSecondary }]}>{t('theme.pack.ready')}</Text> : null}
      </View>
    </SquircleCard>
  );
}

// ---------------------------------------------------------------- T210 "Set it up" entry cards

/** Edge of the art well that leads each "Set it up" card (points). */
const PART_ART = 56;
/** Mini phone in the wallpaper card: about a phone's aspect inside the well. */
const PART_PHONE_W = 26;
/** Each of the four icons in the icons card. */
const PART_ICON = 20;
/** Mini widget in the widgets card. */
const PART_WIDGET = 40;

/**
 * T210: one "Set it up" entry point as its own lifted card (raised surface in dark mode, the soft
 * card shadow in light, never a hairline): a small art well from this theme, the name (headline),
 * one line (footnote) and, when given, a status line in `ok` ("Saved to Photos ✓"). The whole card
 * is the ≥ 48 pt target and one VoiceOver element; a `select` haptic and the timed press ease come
 * from SquircleCard (no spring).
 */
function PartCard({
  title,
  subtitle,
  status = null,
  art,
  onPress,
  accessibilityHint,
}: {
  title: string;
  subtitle: string;
  status?: string | null;
  art: ReactNode;
  onPress: () => void;
  accessibilityHint: string;
}) {
  const { c, scheme } = useColorsV2();
  const { script, isRTL } = useT();
  const label = status ? `${title}, ${subtitle}, ${status}` : `${title}, ${subtitle}`;
  return (
    <SquircleCard
      tone={scheme === 'dark' ? 'raised' : 'surface'}
      outline={false}
      padding={spaceV2.md}
      onPress={onPress}
      haptic="select"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={styles.side}
    >
      <View style={styles.partRow}>
        <View
          style={[styles.partArt, continuous, { backgroundColor: c.fill }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {art}
        </View>
        <View style={styles.partText}>
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...typeFor(script, 'headline'), { color: c.ink }]}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>
            {subtitle}
          </Text>
          {status ? (
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), styles.partStatus, { color: c.ok }]}>
              {status}
            </Text>
          ) : null}
        </View>
        <Feather name={Chevron.forward(isRTL)} size={18} color={c.inkTertiary} />
      </View>
    </SquircleCard>
  );
}

/** A tiny phone in the theme's wallpaper colours: background, a glow in the accent, a dock in the surface colour. */
function PartWallpaperArt({ theme }: { theme: Theme }) {
  const h = Math.round(PART_PHONE_W * PHONE_ASPECT);
  return (
    <View style={[styles.partPhone, continuous, { width: PART_PHONE_W, height: Math.min(h, PART_ART - spaceV2.xs), borderRadius: iconTileRadius(PART_PHONE_W), backgroundColor: theme.palette.bg }]}>
      <View style={[styles.partGlow, { backgroundColor: theme.palette.accent }]} />
      <View style={[styles.partDock, { backgroundColor: theme.palette.surface }]} />
    </View>
  );
}

/** Four of the theme's own icons, drawn as they install (no morph animation in a thumbnail). */
function PartIconsArt({ specs }: { specs: ReturnType<typeof previewSpecs> }) {
  return (
    <View style={styles.partIcons}>
      {specs.slice(0, 4).map((s, i) => (
        <IconCanvas key={`${s.appId}-${i}`} spec={s} size={PART_ICON} morph={false} />
      ))}
    </View>
  );
}

/** A small widget in the theme's palette: its surface, an accent bar and two lines of ink. */
function PartWidgetArt({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.partWidget, continuous, { borderRadius: iconTileRadius(PART_WIDGET), backgroundColor: theme.palette.surface }]}>
      <View style={[styles.partBar, { backgroundColor: theme.palette.accent }]} />
      <View style={[styles.partLine, { backgroundColor: theme.palette.ink }]} />
      <View style={[styles.partLine, styles.partLineShort, { backgroundColor: theme.palette.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // T210 "Set it up" entry cards: 16 pt between cards (editorialV2.cardGap).
  parts: { gap: editorialV2.cardGap },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch },
  partArt: { width: PART_ART, height: PART_ART, borderRadius: radiusV2.control, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  partText: { flex: 1, gap: spaceV2.xxs },
  partStatus: { fontWeight: '600' },
  partPhone: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: spaceV2.xs, overflow: 'hidden' },
  partGlow: { width: spaceV2.md, height: spaceV2.md, borderRadius: circleRadius(spaceV2.md), marginTop: spaceV2.sm },
  partDock: { width: PART_PHONE_W - spaceV2.sm, height: spaceV2.xs + spaceV2.xxs, borderRadius: circleRadius(spaceV2.xs + spaceV2.xxs) },
  partIcons: { width: PART_ICON * 2 + spaceV2.xs, flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.xs },
  partWidget: { width: PART_WIDGET, height: PART_WIDGET, padding: spaceV2.sm - spaceV2.xxs, gap: spaceV2.xs, justifyContent: 'flex-end' },
  partBar: { width: '70%', height: spaceV2.xs + spaceV2.xxs, borderRadius: circleRadius(spaceV2.xs + spaceV2.xxs) },
  partLine: { width: '90%', height: spaceV2.xxs + 1, borderRadius: circleRadius(spaceV2.xxs + 1), opacity: 0.55 },
  partLineShort: { width: '55%' },
  content: { gap: spaceV2.lg },
  missing: { flex: 1, padding: spaceV2.inset, gap: spaceV2.md, justifyContent: 'center' },
  side: { marginHorizontal: spaceV2.lg },
  shelf: { gap: spaceV2.lg, paddingTop: spaceV2.lg },
  headWrap: {
    paddingHorizontal: spaceV2.inset,
    paddingTop: spaceV2.lg,
    paddingBottom: spaceV2.xl,
    marginBottom: -spaceV2.md,
  },
  head: { gap: spaceV2.xs },
  stack: { gap: spaceV2.md },
  // T173 editorial blocks: 32 pt above each section (the content gap supplies 16 of it), 12 pt
  // between the header and its cards and between cards in a block.
  block: { gap: editorialV2.sectionBottom },
  sectionHead: { marginHorizontal: spaceV2.lg, paddingTop: editorialV2.sectionTop - spaceV2.lg, paddingBottom: 0 },
  setUpHead: { marginHorizontal: spaceV2.lg, paddingTop: editorialV2.sectionTop, gap: spaceV2.xs },
  setUpRule: { width: spaceV2.xxl, height: spaceV2.xs, borderRadius: circleRadius(spaceV2.xs), marginBottom: spaceV2.xs },
  setUpTitle: { fontWeight: '800' },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm, alignItems: 'center' },
  paletteDot: { width: 28, height: 28, borderRadius: circleRadius(28), borderWidth: StyleSheet.hairlineWidth },
  modeToggle: { alignSelf: 'center' },
  previewCol: { alignItems: 'center', gap: spaceV2.lg },
  phone: { alignSelf: 'center' },
  frame: { position: 'relative' },
  layer: { position: 'absolute', top: 0, start: 0, end: 0, alignItems: 'center' },
  screen: { overflow: 'hidden' },
  progressRow: { flexDirection: 'row', gap: spaceV2.xs },
  progressSeg: { flex: 1, height: 6, borderRadius: circleRadius(6) },
  note: { flexDirection: 'row', gap: spaceV2.sm, padding: spaceV2.md, borderRadius: radiusV2.control, alignItems: 'flex-start' },
  checkItem: { gap: spaceV2.md, paddingTop: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  noBorder: { borderTopWidth: 0, paddingTop: 0 },
  checkHead: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch },
  tick: { width: 32, height: 32, borderRadius: circleRadius(32), borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowBody: { gap: spaceV2.md, paddingBottom: spaceV2.sm },
  success: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, padding: spaceV2.md, borderRadius: radiusV2.control },
  bloomWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bloomHalo: { position: 'absolute', width: 48, height: 48, borderRadius: circleRadius(48) },
  bloomCheck: { width: 44, height: 44, borderRadius: circleRadius(44), alignItems: 'center', justifyContent: 'center' },
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
  barLink: { alignSelf: 'center' },
  wallSkeleton: { alignSelf: 'center' },
  heroNote: { textAlign: 'center' },
  skeletonPage: { padding: spaceV2.inset, gap: spaceV2.md, alignItems: 'center' },
  skeletonHero: { marginTop: spaceV2.lg },
});
