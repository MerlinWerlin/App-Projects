// Photo-collage Lock Screen maker (T76, docs/MARKET.md "Owner screenshots 18 Oct" L5).
//
// Pick 2..6 photos (system picker, multiple selection), switch layouts with chips (or "Next
// layout", core cycleLayout), choose spacing and a background gradient from a theme (it fills
// the gutters and the clock band), preview in a phone frame with the mock Lock Screen clock,
// then "Save to Photos" renders the full-resolution collage off screen with react-native-view-shot
// and saves it with expo-media-library (src/render/saveWallpaper.ts, the same path every
// wallpaper uses, with the same Photos-denied handling).
//
// Layout maths: src/core/collage.ts (tested). Photos never leave the device: no network.
//
// T97: picked photos are copied into the app's documents folder (the picker cache is temporary)
// and the draft is kept (src/store/collage.ts), so the collage reopens and can be edited later
// (and later used as a Live Lock source). The mock clock turns dark on very light backgrounds.
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  COLLAGE_SPACINGS,
  collageBackground,
  collageRects,
  collageSpacingKey,
  collageStyleKey,
  cycleLayout,
  layoutFor,
  layoutsFor,
  scaleRects,
  spacingOptions,
  type CollageLayout,
  type CollageSpacing,
} from '../src/core/collage';
import { collageClockInk } from '../src/core/collageStore';
import { THEMES, getTheme, type Theme } from '../src/core/themes';
import { sizeForScreen } from '../src/core/wallpaper';
import { useT } from '../src/i18n';
import { CollageView, OffscreenCollage, type CollageData, type CollagePhoto } from '../src/render/CollageView';
import { openAppSettings, useOffscreenCapture } from '../src/render/saveWallpaper';
import { keepCollageCopies, loadCollageDraft, pruneCollageCopies, saveCollageDraft } from '../src/store/collage';
import { useStudio } from '../src/store/studio';
import { continuous, radiusV2, sizeV2, spaceV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { haptic } from '../src/ui/haptics';
import { localizedTypeV2, noMirror } from '../src/ui/i18nLayout';
import { PhoneFrame, phoneScreenSize } from '../src/ui/PhoneFrame';
import { pickCollagePhotos } from '../src/ui/pickCollagePhotos';
import { Segmented, type SegmentedOption } from '../src/ui/Segmented';
import { Swatches, type Swatch } from '../src/ui/Swatches';
import { PillButton } from '../src/ui/v2';

type Status = { kind: 'saved' | 'denied' | 'error' | 'info'; text: string } | null;

const CHIP_W = 56;
const CHIP_H = 100;

export default function CollageScreen() {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  const tt = localizedTypeV2(script);
  const { width: winW } = useWindowDimensions();
  const { state: studio } = useStudio();
  const px = (n: number) => formatNumber(n, { useGrouping: false });

  const size = useMemo(() => {
    const s = Dimensions.get('screen');
    return sizeForScreen(s.width, s.height);
  }, []);
  const canvas = useMemo(() => ({ width: size.width, height: size.height }), [size]);

  const [photos, setPhotos] = useState<CollagePhoto[]>([]);
  const [layoutId, setLayoutId] = useState<string>(() => layoutFor(2, null).id);
  const [spacing, setSpacing] = useState<CollageSpacing>('thin');
  const [themeId, setThemeId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const saver = useOffscreenCapture<CollageData>({ waitForReady: true, readyTimeoutMs: 15000 });

  // Start from the theme the person applied in the studio (starter themes only), else the first.
  const startTheme: Theme = getTheme(studio?.themeId) ?? THEMES[0];
  const theme: Theme = getTheme(themeId) ?? startTheme;
  const background = useMemo(() => collageBackground(theme.wallpaper.colours, theme.palette.bg), [theme]);

  const clockInk = useMemo(() => collageClockInk(background), [background]);

  // Reopen the last collage (T97): only photos whose app-storage copies still exist come back.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadCollageDraft().then((res) => {
      if (!alive) return;
      if (res) {
        setPhotos(res.draft.photos);
        setLayoutId(layoutFor(res.draft.photos.length, res.draft.layoutId).id);
        setSpacing(res.draft.spacing);
        setThemeId(res.draft.themeId);
      }
      setRestored(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the draft current once restore has finished (never overwrite it before that).
  useEffect(() => {
    if (!restored || photos.length < 2) return;
    void saveCollageDraft({ photos, layoutId, spacing, themeId });
  }, [restored, photos, layoutId, spacing, themeId]);

  const count = photos.length;
  const layouts = useMemo(() => (count >= 2 ? layoutsFor(count) : []), [count]);
  const layout = count >= 2 ? layoutFor(count, layoutId) : null;

  useEffect(() => {
    if (status?.kind !== 'saved') return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const data: CollageData | null = useMemo(
    () => (layout ? { photos, layoutId: layout.id, spacing, background, canvas } : null),
    [photos, layout, spacing, background, canvas],
  );

  const onPick = async () => {
    if (picking) return;
    setPicking(true);
    setStatus(null);
    try {
      const res = await pickCollagePhotos();
      if (res.kind === 'picked') {
        // Copy out of the temporary picker cache first (T97), then drop copies no longer used.
        const kept = await keepCollageCopies(res.photos);
        void pruneCollageCopies(kept);
        haptic('success');
        setPhotos(kept);
        // Keep the same layout style when it exists for the new count.
        setLayoutId((id) => layoutFor(kept.length, id).id);
        if (res.trimmed) setStatus({ kind: 'info', text: t('wallpaper.collage.trimmed') });
      } else if (res.kind === 'tooFew') {
        haptic('warning');
        setStatus({ kind: 'info', text: t('wallpaper.collage.tooFew') });
      } else if (res.kind === 'denied') {
        haptic('warning');
        setStatus({ kind: 'denied', text: t('wallpaper.pick.denied') });
      } else if (res.kind === 'unreadable') {
        haptic('warning');
        setStatus({ kind: 'error', text: t('wallpaper.pick.unreadable') });
      } else if (res.kind === 'error') {
        haptic('warning');
        setStatus({ kind: 'error', text: t('wallpaper.pick.error') });
      }
    } finally {
      setPicking(false);
    }
  };

  const onSave = async () => {
    if (!data) {
      void onPick();
      return;
    }
    setStatus(null);
    const res = await saver.save(data, canvas);
    if (res.ok) {
      haptic('success');
      setStatus({ kind: 'saved', text: t('wallpaper.collage.saved', { width: px(res.width), height: px(res.height) }) });
    } else if (res.reason === 'denied') {
      haptic('warning');
      setStatus({ kind: 'denied', text: t('wallpaper.status.denied') });
    } else if (res.reason === 'unreadable') {
      haptic('warning');
      setStatus({ kind: 'error', text: t('wallpaper.pick.unreadable') });
    } else {
      haptic('warning');
      setStatus({ kind: 'error', text: t('wallpaper.status.saveFailed') });
    }
  };

  const styleName = (l: CollageLayout) => t(collageStyleKey(l.style));
  const layoutA11y = (l: CollageLayout) =>
    l.clockClear ? t('wallpaper.collage.layoutA11y', { style: styleName(l) }) : t('wallpaper.collage.layoutFullA11y', { style: styleName(l) });

  const frameW = Math.min(260, Math.round(winW * 0.62));
  const aspect = canvas.width / canvas.height;
  const { width: screenW, height: screenH } = phoneScreenSize(frameW, aspect);

  const spacingOpts: SegmentedOption<CollageSpacing>[] = COLLAGE_SPACINGS.map((s) => ({ value: s, label: t(collageSpacingKey(s)) }));
  const swatches: Swatch[] = THEMES.map((th) => {
    const bg = collageBackground(th.wallpaper.colours, th.palette.bg);
    return { hex: bg.from, hex2: bg.to, name: th.name, value: th.id };
  });

  const busy = saver.saving;
  const card = [styles.card, { backgroundColor: c.surface, borderColor: c.separator }];

  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: c.bg }}>
      <Text style={[tt.body, { color: c.inkSecondary }]}>{t('wallpaper.collage.intro')}</Text>

      <View style={styles.previewWrap}>
        <PhoneFrame width={frameW} aspect={aspect} showClock screenColor={background.from} clockInk={clockInk}>
          {data ? (
            <View accessible accessibilityRole="image" accessibilityLabel={t('wallpaper.collage.previewA11y', { count, style: layout ? styleName(layout) : '' })}>
              <CollageView data={data} width={screenW} height={screenH} gradientId="collagePreviewBg" />
            </View>
          ) : (
            <Pressable
              onPress={() => void onPick()}
              disabled={picking}
              accessibilityRole="button"
              accessibilityLabel={t('wallpaper.collage.chooseA11y')}
              accessibilityHint={t('wallpaper.save.openLibraryHint')}
              style={({ pressed }) => [styles.empty, { width: screenW, height: screenH, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: c.tintSoft }]}>
                <Feather name="grid" size={26} color={c.onTintSoft} />
              </View>
            </Pressable>
          )}
        </PhoneFrame>
        {count > 0 ? <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.collage.count', { count })}</Text> : null}
      </View>

      <PillButton
        block
        variant={count > 0 ? 'tinted' : 'filled'}
        icon="image"
        label={picking ? t('wallpaper.collage.opening') : count > 0 ? t('wallpaper.collage.change') : t('wallpaper.collage.choose')}
        busy={picking}
        disabled={busy}
        onPress={() => void onPick()}
        accessibilityLabel={count > 0 ? t('wallpaper.collage.change') : t('wallpaper.collage.chooseA11y')}
        accessibilityHint={t('wallpaper.save.openLibraryHint')}
      />

      {layout ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[tt.heading, { color: c.ink }]}>
            {t('wallpaper.collage.layout')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('wallpaper.collage.layout')}>
            {layouts.map((l) => (
              <LayoutChip
                key={l.id}
                layout={l}
                selected={l.id === layout.id}
                label={styleName(l)}
                a11y={layoutA11y(l)}
                ink={c.ink}
                tint={c.tint}
                fill={c.fill}
                tile={c.inkTertiary}
                separator={c.separator}
                onPress={() => {
                  haptic('select');
                  setLayoutId(l.id);
                }}
              />
            ))}
          </ScrollView>
          <PillButton
            variant="plain"
            icon="repeat"
            haptic="select"
            label={t('wallpaper.collage.nextLayout')}
            accessibilityHint={t('wallpaper.collage.nextLayoutHint')}
            onPress={() => setLayoutId(cycleLayout(count, layout.id).id)}
          />
          <Text style={[tt.label, { color: c.ink }]}>{t('wallpaper.collage.spacing')}</Text>
          <Segmented label={t('wallpaper.collage.spacing')} options={spacingOpts} value={spacing} onChange={setSpacing} />
        </View>
      ) : null}

      <View style={card}>
        <Text accessibilityRole="header" style={[tt.heading, { color: c.ink }]}>
          {t('wallpaper.collage.background')}
        </Text>
        <Swatches label={t('wallpaper.collage.background')} swatches={swatches} value={theme.id} onChange={(v) => setThemeId(v)} />
        <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.collage.backgroundNote')}</Text>
      </View>

      {status ? (
        <View
          style={[styles.toast, { backgroundColor: status.kind === 'saved' ? c.tintSoft : c.surface, borderColor: c.separator }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Feather name={status.kind === 'saved' ? 'check-circle' : status.kind === 'info' ? 'info' : 'alert-circle'} size={20} color={status.kind === 'saved' ? c.ok : c.warn} />
          <Text style={[tt.body, styles.flex, { color: c.ink }]}>{status.text}</Text>
        </View>
      ) : null}
      {status?.kind === 'denied' ? (
        <PillButton label={t('wallpaper.save.openSettings')} icon="settings" variant="tinted" haptic={false} onPress={openAppSettings} />
      ) : null}

      <PillButton
        block
        icon={data ? 'download' : 'image'}
        label={busy ? t('wallpaper.save.saving') : data ? t('wallpaper.save.save') : t('wallpaper.collage.choose')}
        busy={busy}
        disabled={busy || picking}
        onPress={() => void onSave()}
        accessibilityHint={
          data ? t('wallpaper.collage.saveHint', { width: px(size.width), height: px(size.height) }) : t('wallpaper.save.openLibraryHint')
        }
      />
      <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.help')}</Text>
      <Text style={[tt.small, { color: c.inkSecondary }]}>{t('wallpaper.collage.privacy')}</Text>

      <OffscreenCollage ref={saver.ref} job={saver.job} onReady={saver.markReady} />
    </ScrollView>
  );
}

/** One layout chip: a tiny diagram of the layout (clock band shown as a bar) over its name. */
function LayoutChip({
  layout,
  selected,
  label,
  a11y,
  ink,
  tint,
  fill,
  tile,
  separator,
  onPress,
}: {
  layout: CollageLayout;
  selected: boolean;
  label: string;
  a11y: string;
  ink: string;
  tint: string;
  fill: string;
  tile: string;
  separator: string;
  onPress: () => void;
}) {
  const { script } = useT();
  const tt = localizedTypeV2(script);
  const dw = CHIP_W - 16;
  const dh = Math.round(dw * 2.1);
  const mini = useMemo(() => {
    // Lay out on a phone-sized canvas, then scale down, so the diagram matches the real thing.
    const big = { width: 1179, height: 2556 };
    const res = collageRects(layout.count, layout.id, big, spacingOptions('thin', big));
    return { rects: scaleRects(res.rects, big.width, dw), band: res.band ? { y: (res.band.y * dw) / big.width, h: (res.band.h * dw) / big.width } : null };
  }, [layout, dw]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={a11y}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        continuous,
        { borderColor: selected ? tint : separator, borderWidth: selected ? 2 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[noMirror, { width: dw, height: dh, backgroundColor: fill, borderRadius: 6, overflow: 'hidden' }]}>
        {mini.band ? (
          // rtl-ok: diagram never mirrors
          <View style={{ position: 'absolute', left: dw * 0.25, top: mini.band.y + mini.band.h * 0.3, width: dw * 0.5, height: Math.max(3, mini.band.h * 0.35), borderRadius: 2, backgroundColor: tint }} />
        ) : null}
        {mini.rects.map((r, i) => (
          // rtl-ok
          <View key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: Math.min(3, r.r), backgroundColor: tile }} />
        ))}
      </View>
      <Text style={[tt.small, styles.chipLabel, { color: selected ? tint : ink }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spaceV2.lg, gap: spaceV2.md, paddingBottom: spaceV2.xxl },
  previewWrap: { alignItems: 'center', gap: spaceV2.xs },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  card: { ...continuous, borderRadius: radiusV2.card, borderWidth: StyleSheet.hairlineWidth, padding: spaceV2.lg, gap: spaceV2.md },
  chips: { gap: spaceV2.sm, paddingVertical: spaceV2.xxs },
  chip: {
    width: CHIP_W + 16,
    minHeight: Math.max(sizeV2.touch, CHIP_H),
    borderRadius: radiusV2.control,
    alignItems: 'center',
    paddingVertical: spaceV2.sm,
    paddingHorizontal: spaceV2.xs,
    gap: spaceV2.xs,
  },
  chipLabel: { textAlign: 'center' },
  toast: { ...continuous, flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm, padding: spaceV2.md, borderRadius: radiusV2.control, borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
