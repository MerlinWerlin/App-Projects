import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  MAX_TINT,
  TINT_STEP,
  clampTint,
  defaultBackground,
  usesPhoto,
  type BackgroundSource,
  type PhotoOverlay,
  type ThemeBackground,
} from '../src/core/background';
import { DEFAULT_TRANSFORM, looksSoft, pinchBy, type PhotoTransform } from '../src/core/photoCrop';
import { pairSaveTicksWallpaper, type PairSaveOutcome } from '../src/core/applyChecklist';
import { getAnyTheme, wallpaperMakerSwatches, wallpaperMakerTheme } from '../src/core/plusThemes';
import { previewSpecs } from '../src/core/themes';
import {
  WALLPAPER_PATTERNS,
  WALLPAPER_SIZES,
  editorParamsFor,
  nextSeed,
  randomise,
  sizeForScreen,
  type WallpaperKind,
  type WallpaperParams,
  type WallpaperPattern,
} from '../src/core/wallpaper';
import { designedColours, homeVersionFor, type PairStrength } from '../src/core/wallpaperPair';
import { OffscreenHomeWallpaper, type HomeWallpaperData } from '../src/render/HomeWallpaperView';
import { OffscreenPhotoWallpaper, type PhotoWallpaperData } from '../src/render/PhotoWallpaperView';
import { openAppSettings, useOffscreenCapture, useWallpaperSaver } from '../src/render/saveWallpaper';
import { OffscreenWallpaper, WallpaperView } from '../src/render/WallpaperView';
import { useLocked } from '../src/plus/useLocked';
import { tickStoredChecklist } from '../src/store/applyChecklist';
import { loadBackground, photoCopyExists, saveBackground } from '../src/store/background';
import { applyWidgetTheme } from '../src/store/widgetTheme';
import { useT } from '../src/i18n';
import { continuous, radiusV2, sizeV2, spaceV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import type { FeatherName } from '../src/ui/featherName';
import { PillButton } from '../src/ui/PillButton';
import { PressableScale } from '../src/ui/PressableScale';
import { LockMock } from '../src/ui/LockMock';
import { ContextTip } from '../src/ui/ContextTip';
import { PhotoCropEditor } from '../src/ui/PhotoCropEditor';
import { SwitchRow } from '../src/ui/Switch';
import { haptic } from '../src/ui/haptics';
import { useAnnounce } from '../src/ui/announce';
import { localizedTypeV2, noMirror } from '../src/ui/i18nLayout';
import { pickBackgroundPhoto } from '../src/ui/pickBackgroundPhoto';
import { Skeleton } from '../src/ui/Skeleton';
import { WallpaperPairCard } from '../src/ui/WallpaperPairCard';

const KIND_IDS: WallpaperKind[] = ['gradient', 'mesh', 'grain', 'pattern'];

const KIND_KEYS = {
  gradient: 'wallpaper.kinds.gradient',
  mesh: 'wallpaper.kinds.mesh',
  grain: 'wallpaper.kinds.grain',
  pattern: 'wallpaper.kinds.pattern',
} as const satisfies Record<WallpaperKind, string>;

const PATTERN_KEYS = {
  dots: 'wallpaper.patterns.dots',
  grid: 'wallpaper.patterns.grid',
  waves: 'wallpaper.patterns.waves',
  checker: 'wallpaper.patterns.checker',
} as const satisfies Record<WallpaperPattern, string>;

/** Photo picker failures (pickBackgroundPhoto result kinds) to catalogue keys. */
const PICK_KEYS = {
  denied: 'wallpaper.pick.denied',
  unreadable: 'wallpaper.pick.unreadable',
  error: 'wallpaper.pick.error',
  copyFailed: 'wallpaper.pick.copyFailed',
} as const;

const PREVIEW_W = 220;
/** Width of each half of the Lock + Home pair preview (T62). */
const PAIR_W = 112;
const ANGLE_STEP = 15;
const GRAIN_STEP = 0.1;

const SOURCE_KEYS = {
  theme: 'wallpaper.source.theme',
  photo: 'wallpaper.source.photo',
} as const satisfies Record<BackgroundSource, string>;
const SOURCE_IDS: BackgroundSource[] = ['theme', 'photo'];

type Status = { kind: 'saved' | 'denied' | 'error'; text: string } | null;

type WallpaperIconButtonProps = {
  icon: FeatherName;
  onPress: () => void;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  disabled?: boolean;
};

/** 48 pt round tint icon button (steppers and zoom), design v2 (T83). */
function WallpaperIconButton({ icon, onPress, accessibilityLabel, disabled = false }: WallpaperIconButtonProps) {
  const { c } = useColorsV2();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.iconBtn, disabled ? styles.iconBtnDisabled : null]}
    >
      <Feather name={icon} size={20} color={c.tint} />
    </PressableScale>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  grid = false,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /**
   * Night 23 Oct (cross-app, from Linework fb-1022c and Glaze fb-1023 B): four options as a 2×2 block of
   * equal pills, so words like "Sfumatura", "Cuadrícula" or "グラデーション" get room instead of breaking
   * mid-word in a quarter-width segment (iPhone ~375 pt, larger text, long locales).
   */
  grid?: boolean;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const tt = localizedTypeV2(script);
  return (
    <View
      style={[styles.segment, grid && styles.segmentGrid, { backgroundColor: c.fill }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              // Same as the shared Segmented: no re-fire on the chosen pill, selection tick on change.
              if (selected) return;
              haptic('select');
              onChange(o.id);
            }}
            accessibilityRole="radio"
            accessibilityLabel={t('wallpaper.option', { group: label, option: o.label })}
            accessibilityState={{ selected, checked: selected }}
            hitSlop={3}
            style={[styles.segmentItem, grid && styles.segmentItemGrid, selected && { backgroundColor: c.surfaceRaised }]}
          >
            <Text style={[tt.label, styles.segmentText, { color: selected ? c.tint : c.inkSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const tt = localizedTypeV2(script);
  return (
    <View style={styles.stepper}>
      <Text style={[tt.label, styles.flex, { color: c.ink }]}>{label}</Text>
      <WallpaperIconButton icon="minus" accessibilityLabel={t('wallpaper.stepper.less', { label })} onPress={onMinus} disabled={minusDisabled} />
      <Text
        style={[tt.label, styles.stepValue, { color: c.ink }]}
        accessibilityLabel={t('wallpaper.stepper.value', { label, value })}
        accessibilityLiveRegion="polite"
      >
        {value}
      </Text>
      <WallpaperIconButton icon="plus" accessibilityLabel={t('wallpaper.stepper.more', { label })} onPress={onPlus} disabled={plusDisabled} />
    </View>
  );
}

export default function WallpaperScreen() {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tt = localizedTypeV2(script);
  /** Pixel sizes: locale digits, no grouping (1290 × 2796). */
  const px = (n: number) => formatNumber(n, { useGrouping: false });
  const pct = (fraction: number) => t('wallpaper.percent', { value: Math.round(fraction * 100) });
  const kinds = KIND_IDS.map((id) => ({ id, label: t(KIND_KEYS[id]) }));
  const sources = SOURCE_IDS.map((id) => ({ id, label: t(SOURCE_KEYS[id]) }));
  const { theme: themeParam, source: sourceParam } = useLocalSearchParams<{ theme?: string; source?: string }>();
  const themeId = typeof themeParam === 'string' ? themeParam : undefined;
  // T81: the designed-wallpaper editor starts from the theme it was opened for, Plus themes
  // included once unlocked (a locked Plus theme starts from a free one); the photo background
  // works in every theme, keyed by its id, with that theme's colours for the overlay.
  const anyTheme = getAnyTheme(themeId);
  const plusLocked = useLocked(anyTheme?.plus === true);
  const startTheme = wallpaperMakerTheme(themeId, plusLocked);
  const swatchThemes = useMemo(() => wallpaperMakerSwatches(startTheme), [startTheme]);
  const bgTheme = anyTheme ?? startTheme;
  // Theme icons shown live over the photo while cropping (T37).
  const cropIcons = useMemo(() => previewSpecs(bgTheme, 12), [bgTheme]);
  const saver = useWallpaperSaver();
  const photoSaver = useOffscreenCapture<PhotoWallpaperData>({ waitForReady: true });
  // Home half of a Lock + Home pair: the saved Lock PNG, blurred and dimmed (T62).
  const homeSaver = useOffscreenCapture<HomeWallpaperData>({ waitForReady: true });
  const [pairStrength, setPairStrength] = useState<PairStrength>('soft');

  // --- Background source (T25) ---
  const [bg, setBg] = useState<ThemeBackground>(() => defaultBackground());
  const [bgLoaded, setBgLoaded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const autoPicked = useRef(false);
  const touched = useRef(false);

  const persist = useCallback(
    (next: ThemeBackground) => {
      touched.current = true;
      setBg(next);
      bgRef.current = next;
      void saveBackground(bgTheme.id, next);
    },
    [bgTheme.id],
  );

  const [params, setParams] = useState<WallpaperParams>(() => editorParamsFor(startTheme.wallpaper));
  const [paletteId, setPaletteId] = useState(startTheme.id);
  // T81: the Plus entitlement loads after the first render (locked while loading), so an unlocked
  // Plus theme can arrive a moment later; switch to it unless the design was already edited.
  const designEdited = useRef(false);
  const shownStart = useRef(startTheme.id);
  useEffect(() => {
    if (shownStart.current === startTheme.id) return;
    shownStart.current = startTheme.id;
    if (designEdited.current) return;
    setParams(editorParamsFor(startTheme.wallpaper));
    setPaletteId(startTheme.id);
  }, [startTheme]);
  const [sizeId, setSizeId] = useState(() => {
    const s = Dimensions.get('screen');
    return sizeForScreen(s.width, s.height).id;
  });
  const [status, setStatus] = useState<Status>(null);
  // VoiceOver hears every save / pick result (live regions are Android-only; night 23 Oct).
  useAnnounce(status?.text, status);

  const size = WALLPAPER_SIZES.find((s) => s.id === sizeId) ?? WALLPAPER_SIZES[WALLPAPER_SIZES.length - 1];
  const previewH = Math.round((PREVIEW_W * size.height) / size.width);
  const angle = params.angle ?? 180;
  const grain = params.grain ?? 0;

  // Hide the confirmation after a few seconds, like a toast.
  useEffect(() => {
    if (status?.kind !== 'saved') return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const pickPhoto = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    setStatus(null);
    try {
      const res = await pickBackgroundPhoto(bgTheme.id);
      if (res.kind === 'picked') {
        haptic('success');
        persist({
          ...bgRef.current,
          source: 'photo',
          photoUri: res.uri,
          imageW: res.imageW,
          imageH: res.imageH,
          transform: { ...DEFAULT_TRANSFORM },
        });
      } else if (res.kind !== 'cancelled') {
        haptic('warning');
        setStatus({ kind: res.kind === 'denied' ? 'denied' : 'error', text: t(PICK_KEYS[res.kind]) });
      }
    } finally {
      setPicking(false);
    }
  }, [picking, bgTheme.id, persist, t]);

  // Load this theme's saved background; reopen straight into "My photo" when asked.
  useEffect(() => {
    let alive = true;
    (async () => {
      let saved = await loadBackground(bgTheme.id);
      if (saved.photoUri && !(await photoCopyExists(saved.photoUri))) {
        // The private copy is gone (e.g. restored from a backup): fall back to the design.
        saved = { source: 'theme', overlay: saved.overlay };
        if (alive) setStatus({ kind: 'error', text: t('wallpaper.status.photoGone') });
        void saveBackground(bgTheme.id, saved);
      }
      if (!alive) return;
      if (touched.current) {
        // The user already changed something while this was loading; keep their choice.
        setBgLoaded(true);
        return;
      }
      const wantPhoto = sourceParam === 'photo';
      const next = wantPhoto && usesPhoto({ ...saved, source: 'photo' }) ? { ...saved, source: 'photo' as const } : saved;
      setBg(next);
      bgRef.current = next;
      setBgLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // t is read once when the load finishes; a language change re-renders the screen anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgTheme.id, sourceParam]);

  useEffect(() => {
    if (!bgLoaded || autoPicked.current) return;
    if (sourceParam === 'photo' && !bgRef.current.photoUri) {
      autoPicked.current = true;
      void pickPhoto();
    }
  }, [bgLoaded, sourceParam, pickPhoto]);

  const chooseSource = (source: BackgroundSource) => {
    haptic('select');
    setStatus(null);
    if (source === 'photo' && !bgRef.current.photoUri) {
      void pickPhoto();
      return;
    }
    persist({ ...bgRef.current, source });
  };

  const setTransform = (transform: PhotoTransform) => setBg((b) => ({ ...b, transform }));
  const commitTransform = (transform: PhotoTransform) => persist({ ...bgRef.current, transform });
  const setOverlay = (patch: Partial<PhotoOverlay>) => {
    haptic('select');
    persist({ ...bgRef.current, overlay: { ...bgRef.current.overlay, ...patch } });
  };
  const zoomPhoto = (factor: number) => {
    haptic('select');
    const b = bgRef.current;
    if (!usesPhoto(b)) return;
    commitTransform(pinchBy(b.transform ?? DEFAULT_TRANSFORM, factor, { width: b.imageW, height: b.imageH }, { width: PREVIEW_W, height: previewH }));
  };

  const photoMode = bg.source === 'photo';
  const photoData: PhotoWallpaperData | null = usesPhoto(bg)
    ? {
        uri: bg.photoUri,
        imageW: bg.imageW,
        imageH: bg.imageH,
        transform: bg.transform ?? DEFAULT_TRANSFORM,
        overlay: bg.overlay,
        palette: bgTheme.palette,
      }
    : null;
  const soft = photoData
    ? looksSoft({ width: photoData.imageW, height: photoData.imageH }, size, photoData.transform)
    : false;

  // Photos: pixels are unknown in JS, so the Home dim plans for the brightest case.
  const home = useMemo(
    () => homeVersionFor({ colours: photoMode ? undefined : designedColours(params), size, strength: pairStrength }),
    [photoMode, params, size, pairStrength],
  );
  const pairH = Math.round((PAIR_W * size.height) / size.width);

  const tick = () => haptic('select');
  const update = (patch: Partial<WallpaperParams>) => {
    tick();
    designEdited.current = true;
    setParams((p) => ({ ...p, ...patch }));
  };

  const shuffle = () => {
    haptic('select');
    designEdited.current = true;
    setParams((p) => ({ ...randomise(p, nextSeed(p.seed)), grain: p.grain, pattern: p.pattern }));
  };

  const onSave = async () => {
    setStatus(null);
    if (photoMode && !photoData) {
      void pickPhoto();
      return;
    }
    const res = photoMode && photoData ? await photoSaver.save(photoData, size) : await saver.save(params, size);
    if (res.ok) {
      haptic('success');
      // T125: saving a theme's wallpaper applies that theme, so the widgets follow it too.
      if (anyTheme && !plusLocked) void applyWidgetTheme(anyTheme);
      setStatus({ kind: 'saved', text: t('wallpaper.status.saved', { width: px(res.width), height: px(res.height) }) });
    } else {
      showSaveFailure(res.reason);
    }
  };

  const showSaveFailure = (reason: 'denied' | 'error' | 'unreadable') => {
    if (reason === 'denied') {
      haptic('warning');
      setStatus({
        kind: 'denied',
        text: t('wallpaper.status.denied'),
      });
    } else if (reason === 'unreadable') {
      haptic('warning');
      setStatus({ kind: 'error', text: t('wallpaper.pick.unreadable') });
    } else {
      haptic('warning');
      setStatus({ kind: 'error', text: t('wallpaper.status.saveFailed') });
    }
  };

  /** One tap: save the Lock image, then blur + dim that same PNG and save it as the Home image (T62). */
  const onSavePair = async () => {
    setStatus(null);
    if (photoMode && !photoData) {
      void pickPhoto();
      return;
    }
    const lock = photoMode && photoData ? await photoSaver.save(photoData, size) : await saver.save(params, size);
    if (!lock.ok) {
      showSaveFailure(lock.reason);
      return;
    }
    const tickPair = (outcome: PairSaveOutcome) => {
      // T81: a saved pair ticks the wallpaper step of the theme this maker was opened for.
      if (anyTheme && !plusLocked && pairSaveTicksWallpaper(outcome)) void tickStoredChecklist(anyTheme.id, 'wallpaper');
      // T125: and the widgets follow the theme whose wallpaper was saved.
      if (anyTheme && !plusLocked) void applyWidgetTheme(anyTheme);
    };
    const homeData: HomeWallpaperData = {
      uri: lock.uri,
      imageW: lock.width,
      imageH: lock.height,
      home,
      background: '#000000',
    };
    const res = await homeSaver.save(homeData, size);
    tickPair(res.ok ? 'saved' : 'homeFailed');
    if (res.ok) {
      haptic('success');
      setStatus({ kind: 'saved', text: t('wallpaper.pair.saved', { width: px(res.width), height: px(res.height) }) });
    } else if (res.reason === 'denied') {
      showSaveFailure('denied');
    } else {
      haptic('warning');
      setStatus({ kind: 'error', text: t('wallpaper.pair.homeFailed') });
    }
  };

  const busySaving = saver.saving || photoSaver.saving || homeSaver.saving;

  return (
    <ScrollView
      scrollEnabled={scrollEnabled}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
    >
      <ContextTip ids={['photo-background', 'wallpaper-save']} />
      <View style={styles.gapSm}>
        <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.source.for', { theme: bgTheme.name })}</Text>
        <Segmented
          label={t('wallpaper.source.label')}
          options={sources}
          value={photoMode ? 'photo' : 'theme'}
          onChange={chooseSource}
        />
      </View>

      <View style={styles.previewWrap}>
        {photoMode ? (
          photoData ? (
            <View style={[styles.phone, noMirror, { width: PREVIEW_W, height: previewH, borderColor: c.separator }]}>
              <PhotoCropEditor
                photo={photoData}
                width={PREVIEW_W}
                height={previewH}
                onChange={setTransform}
                onCommit={commitTransform}
                onGestureActive={(active) => setScrollEnabled(!active)}
                onImageError={() => setStatus({ kind: 'error', text: t('wallpaper.pick.unreadable') })}
                iconSpecs={cropIcons}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => void pickPhoto()}
              disabled={picking}
              accessibilityRole="button"
              accessibilityLabel={t('wallpaper.photo.chooseA11y')}
              style={[
                styles.phone,
                styles.emptyPhoto,
                { width: PREVIEW_W, height: previewH, borderColor: c.separator, backgroundColor: c.tintSoft },
              ]}
            >
              <Feather name="image" size={32} color={c.onTintSoft} />
              <Text style={[tt.label, { color: c.onTintSoft, textAlign: 'center' }]}>
                {picking ? t('wallpaper.photo.opening') : t('wallpaper.photo.choose')}
              </Text>
            </Pressable>
          )
        ) : (
          <View
            style={[styles.phone, noMirror, { width: PREVIEW_W, height: previewH, borderColor: c.separator }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={
              params.kind === 'pattern'
                ? t('wallpaper.preview.a11yPattern', {
                    style: t(KIND_KEYS.pattern),
                    pattern: t(PATTERN_KEYS[params.pattern ?? 'dots']),
                  })
                : t('wallpaper.preview.a11y', { style: t(KIND_KEYS[params.kind]) })
            }
          >
            <WallpaperView params={params} width={PREVIEW_W} height={previewH} maxGrain={400} />
            <LockMock width={PREVIEW_W} height={previewH} showGuides={false} />
          </View>
        )}
        <Text style={[tt.small, { color: c.inkSecondary }]}>
          {t('wallpaper.preview.sizePx', { width: px(size.width), height: px(size.height) })}
        </Text>
      </View>

      {photoMode ? (
        <>
          {photoData ? (
            <>
              <Text style={[tt.small, { color: c.inkSecondary, textAlign: 'center' }]}>{t('wallpaper.photo.help')}</Text>
              <View style={styles.zoomRow}>
                <WallpaperIconButton
                  icon="zoom-out"
                  accessibilityLabel={t('wallpaper.photo.zoomOut')}
                  onPress={() => zoomPhoto(0.8)}
                  disabled={photoData.transform.scale <= 1}
                />
                <PillButton
                  label={t('common.reset')}
                  icon="rotate-ccw"
                  variant="plain"
                  haptic={false}
                  onPress={() => {
                    haptic('select');
                    commitTransform({ ...DEFAULT_TRANSFORM });
                  }}
                  accessibilityHint={t('wallpaper.photo.resetHint')}
                />
                <WallpaperIconButton
                  icon="zoom-in"
                  accessibilityLabel={t('wallpaper.photo.zoomIn')}
                  onPress={() => zoomPhoto(1.25)}
                  disabled={photoData.transform.scale >= 5}
                />
              </View>
              {soft ? (
                <Text style={[tt.small, { color: c.warn, textAlign: 'center' }]}>{t('wallpaper.photo.soft')}</Text>
              ) : null}
              <PillButton
                label={picking ? t('wallpaper.photo.opening') : t('wallpaper.photo.change')}
                icon="image"
                variant="tinted"
                haptic={false}
                disabled={picking}
                onPress={() => void pickPhoto()}
              />
            </>
          ) : null}

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.separator }]}>
            <Text accessibilityRole="header" style={[tt.heading, { color: c.ink }]}>
              {t('wallpaper.photo.touches', { theme: bgTheme.name })}
            </Text>
            <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.photo.touchesBody')}</Text>
            <View style={styles.stepper}>
              <View style={[styles.tintSwatch, { backgroundColor: bgTheme.palette.accent, borderColor: c.separator }]} />
              <View style={styles.flex}>
                <Stepper
                  label={t('wallpaper.photo.colourWash')}
                  value={pct(bg.overlay.tint)}
                  minusDisabled={bg.overlay.tint <= 0}
                  plusDisabled={bg.overlay.tint >= MAX_TINT}
                  onMinus={() => setOverlay({ tint: clampTint(bg.overlay.tint - TINT_STEP) })}
                  onPlus={() => setOverlay({ tint: clampTint(bg.overlay.tint + TINT_STEP) })}
                />
              </View>
            </View>
            <SwitchRow
              label={t('wallpaper.photo.grain')}
              value={bg.overlay.grain}
              onChange={(grain) => setOverlay({ grain })}
              description={t('wallpaper.photo.grainDesc')}
            />
            <SwitchRow
              label={t('wallpaper.photo.border')}
              value={bg.overlay.border}
              onChange={(border) => setOverlay({ border })}
              description={t('wallpaper.photo.borderDesc')}
            />
          </View>

          <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.photo.privacy')}</Text>
        </>
      ) : (
        <PillButton
          label={t('wallpaper.design.shuffle')}
          icon="shuffle"
          variant="tinted"
          haptic={false}
          onPress={shuffle}
          accessibilityHint={t('wallpaper.design.shuffleHint')}
        />
      )}

      {photoMode ? null : (
        <>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.separator }]}>
            <Text accessibilityRole="header" style={[tt.heading, { color: c.ink }]}>
              {t('wallpaper.design.style')}
            </Text>
            <Segmented grid label={t('wallpaper.design.style')} options={kinds} value={params.kind} onChange={(kind) => update({ kind })} />
            {params.kind === 'pattern' ? (
              <Segmented
                grid
                label={t('wallpaper.design.pattern')}
                options={WALLPAPER_PATTERNS.map((p) => ({ id: p, label: t(PATTERN_KEYS[p]) }))}
                value={params.pattern ?? 'dots'}
                onChange={(pattern) => update({ pattern })}
              />
            ) : null}
            <Stepper
              label={t('wallpaper.design.angle')}
              value={t('wallpaper.degrees', { value: angle })}
              onMinus={() => update({ angle: (angle - ANGLE_STEP + 360) % 360 })}
              onPlus={() => update({ angle: (angle + ANGLE_STEP) % 360 })}
            />
            <Stepper
              label={t('wallpaper.design.grain')}
              value={pct(grain)}
              minusDisabled={grain <= 0}
              plusDisabled={grain >= 1}
              onMinus={() => update({ grain: Math.max(0, Math.round((grain - GRAIN_STEP) * 10) / 10) })}
              onPlus={() => update({ grain: Math.min(1, Math.round((grain + GRAIN_STEP) * 10) / 10) })}
            />
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.separator }]}>
            <Text accessibilityRole="header" style={[tt.heading, { color: c.ink }]}>
              {t('wallpaper.design.colours')}
            </Text>
            <View style={styles.swatches}>
              {swatchThemes.map((th) => {
                const selected = th.id === paletteId;
                return (
                  <Pressable
                    key={th.id}
                    onPress={() => {
                      setPaletteId(th.id);
                      update({ colours: [...th.wallpaper.colours] });
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={t('wallpaper.design.themeColours', { theme: th.name })}
                    accessibilityState={{ selected, checked: selected }}
                    style={[styles.swatchBtn, { borderColor: selected ? c.tint : c.separator, borderWidth: selected ? 2 : StyleSheet.hairlineWidth }]}
                  >
                    <View style={[styles.swatchStripes, noMirror]}>
                      {th.wallpaper.colours.map((col, i) => (
                        <View key={i} style={[styles.flex, { backgroundColor: col }]} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <PillButton
              label={t('wallpaper.design.reverse')}
              icon="repeat"
              variant="plain"
              haptic={false}
              onPress={() => update({ colours: [...params.colours].reverse() })}
            />
          </View>
        </>
      )}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.separator }]}>
        <Text accessibilityRole="header" style={[tt.heading, { color: c.ink }]}>
          {t('wallpaper.size.heading')}
        </Text>
        {WALLPAPER_SIZES.map((s) => {
          const selected = s.id === sizeId;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                tick();
                setSizeId(s.id);
              }}
              accessibilityRole="radio"
              accessibilityLabel={t('wallpaper.size.a11y', { name: s.name, width: px(s.width), height: px(s.height) })}
              accessibilityState={{ selected, checked: selected }}
              style={({ pressed }) => [styles.sizeRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? c.tint : c.inkTertiary} />
              <View style={styles.flex}>
                <Text style={[tt.label, { color: c.ink }]}>{s.name}</Text>
                <Text style={[tt.small, { color: c.inkSecondary }]}>
                  {t('wallpaper.size.dims', { width: px(s.width), height: px(s.height) })}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <WallpaperPairCard
        width={PAIR_W}
        height={pairH}
        photo={photoMode ? photoData : null}
        params={params}
        home={home}
        iconSpecs={cropIcons}
        strength={pairStrength}
        onStrengthChange={setPairStrength}
        pixels={{ width: px(size.width), height: px(size.height) }}
        saving={busySaving}
        disabled={busySaving || picking || (photoMode && !photoData)}
        onSave={() => void onSavePair()}
      />

      {status ? (
        <View
          style={[styles.toast, { backgroundColor: status.kind === 'saved' ? c.tintSoft : c.surface, borderColor: c.separator }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Feather
            name={status.kind === 'saved' ? 'check-circle' : 'alert-circle'}
            size={20}
            color={status.kind === 'saved' ? c.ok : c.warn}
          />
          <Text style={[tt.body, styles.flex, { color: c.ink }]}>{status.text}</Text>
        </View>
      ) : null}
      {status?.kind === 'denied' ? (
        <PillButton label={t('wallpaper.save.openSettings')} icon="settings" variant="tinted" haptic={false} onPress={openAppSettings} />
      ) : null}
      <Text style={[tt.small, { color: status?.kind === 'saved' ? c.ink : c.inkSecondary }]}>{t('wallpaper.help')}</Text>

      {busySaving ? (
        // Export wait (POLISH rule 5): shimmer in the button's place-holder row, not a bare spinner.
        <View style={styles.exporting} accessible accessibilityRole="progressbar" accessibilityLabel={t('wallpaper.save.renderingA11y')}>
          <Skeleton width="100%" height={8} radius={radiusV2.pill} />
          <Text style={[tt.small, { color: c.inkSecondary }]}>
            {t('wallpaper.save.rendering', { width: px(size.width), height: px(size.height) })}
          </Text>
        </View>
      ) : null}
      <PillButton
        block
        label={
          busySaving
            ? t('wallpaper.save.saving')
            : photoMode && !photoData
              ? t('wallpaper.photo.choose')
              : t('wallpaper.save.save')
        }
        icon={photoMode && !photoData ? 'image' : 'download'}
        disabled={busySaving || picking}
        onPress={onSave}
        accessibilityHint={
          photoMode && !photoData
            ? t('wallpaper.save.openLibraryHint')
            : t('wallpaper.save.hint', { width: px(size.width), height: px(size.height) })
        }
      />

      <OffscreenWallpaper ref={saver.ref} job={saver.job} />
      <OffscreenPhotoWallpaper ref={photoSaver.ref} job={photoSaver.job} onReady={photoSaver.markReady} />
      <OffscreenHomeWallpaper ref={homeSaver.ref} job={homeSaver.job} onReady={homeSaver.markReady} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spaceV2.lg, gap: spaceV2.md, paddingBottom: spaceV2.xxl },
  previewWrap: { alignItems: 'center', gap: spaceV2.xs },
  exporting: { gap: spaceV2.xs },
  gapSm: { gap: spaceV2.xs },
  emptyPhoto: { alignItems: 'center', justifyContent: 'center', gap: spaceV2.sm, padding: spaceV2.md },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.sm },
  tintSwatch: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginEnd: spaceV2.sm },
  phone: { ...continuous, borderRadius: radiusV2.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  card: { ...continuous, borderRadius: radiusV2.card, borderWidth: StyleSheet.hairlineWidth, padding: spaceV2.lg, gap: spaceV2.md },
  segment: { flexDirection: 'row', borderRadius: radiusV2.pill, padding: 3 },
  // 2×2 block (night 23 Oct): rounded track like the shared Segmented grid; each pill takes half the row.
  segmentGrid: { flexWrap: 'wrap', borderRadius: radiusV2.group, gap: 3 },
  segmentItem: {
    flex: 1,
    minHeight: sizeV2.touch - 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.xs,
  },
  segmentItemGrid: { flexGrow: 1, flexShrink: 0, flexBasis: '45%', paddingHorizontal: spaceV2.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: sizeV2.touch },
  stepValue: { minWidth: 56, textAlign: 'center' },
  segmentText: { textAlign: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  swatchBtn: { width: sizeV2.touch, height: sizeV2.touch, borderRadius: radiusV2.control, overflow: 'hidden', padding: 3 },
  swatchStripes: { flex: 1, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch, paddingVertical: spaceV2.xs },
  toast: {
    ...continuous,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    padding: spaceV2.md,
    borderRadius: radiusV2.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  iconBtn: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  iconBtnDisabled: { opacity: 0.35 },
});
