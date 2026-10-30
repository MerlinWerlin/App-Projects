// HomeMock: a phone-shaped Home Screen preview (status bar, 4 x 6 icon grid with labels,
// page dots and a dock). Purely visual: one accessible image for screen readers.
// T107 (fb-1022-perf): the apply ripple / pop no longer re-mounts every icon on each replay (keys
// carried the replay counter, so 24 SVG icon tiles were torn down and rebuilt at once). Icons
// keep stable keys; each cell runs its own UI-thread timed fade (opacity only, no spring).
// T118 (fb-1024 B): gallery cards pass `still`: the icons are plain views (no per-icon shared value
// or animated style, no shape-morph effect), and the monogram pass over the specs is cached per
// specs array. A gallery card used to register ~24 animated styles just to sit still.

import { Feather } from '@expo/vector-icons';
import { memo, useEffect, useId, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { fitDelays, rippleDelays, staggerDelay } from '../core/motion';
import { withMonogram, type IconSpec } from '../core/iconspec';
import { weakMemo } from '../core/perfCache';
import { IconTile } from '../render/IconTile';
import { durations, timing, useMotionReduced } from '../theme/motion';
import { artFontsV2 as fonts, brandGlazeV2, tabularV2 as tabular } from '../theme/tokensV2';
import { CustomisedBadge } from './CustomisedBadge';
import { useT } from '../i18n';
import { noMirror, noMirrorText } from './i18nLayout';

export type HomeMockProps = {
  specs: IconSpec[];
  /** Width in points; height follows the 9:19.5 phone aspect. */
  width: number;
  /** Rendered absolutely behind everything (e.g. a wallpaper view). */
  background?: ReactNode;
  /** Used when no `background` node is given. */
  backgroundColour?: string;
  /** Icons in the dock, taken from the end of `specs` (default 4). */
  dockCount?: number;
  /** Most icons drawn (default 24 grid + dock). */
  maxIcons?: number;
  /** App ids with their own override in this theme: drawn with a small "customised" dot. */
  customisedIds?: ReadonlySet<string>;
  /** Draw each icon inside iOS's rounded-square mask, as the iPhone will (T26). */
  iosMask?: boolean;
  /** Colour baked behind each icon's shape (the exported backdrop); used with iosMask. */
  iconBackdrop?: string;
  /**
   * Polish (docs/POLISH.md G1/G3): 'pop' springs the icons in staggered (max 8 steps),
   * 'ripple' brings them in one by one as a wave from the top-left. Change `animateKey`
   * to replay. Reduced motion: icons simply appear.
   */
  animateIcons?: 'pop' | 'ripple' | false;
  animateKey?: string | number;
  /** Called once the ripple/pop has finished (or straight away when reduced/off). */
  onIconsSettled?: () => void;
  /**
   * T118: the icons never animate (gallery cards): plain views, no per-icon Reanimated hooks and
   * no shape morph. `animateIcons` is ignored. Keep it constant for a mounted preview.
   */
  still?: boolean;
};

/** T82 monograms for a specs array, computed once per array (gallery specs are cached arrays). */
const monogramSpecs = weakMemo((xs: IconSpec[]): IconSpec[] => xs.map((s) => withMonogram(s)));

/** Total ripple budget so even a full Home Screen settles quickly. */
export const RIPPLE_BUDGET_MS = 700;

const COLS = 4;
const ROWS = 6;
const GRID_MAX = COLS * ROWS;
export const HOME_ASPECT = 19.5 / 9;

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

// T162: memoised (props are plain values and stable callbacks), so a parent re-render skips it.
export const HomeMock = memo(function HomeMock({
  specs: rawSpecs,
  width,
  background,
  backgroundColour,
  dockCount = 4,
  maxIcons,
  customisedIds,
  iosMask = false,
  iconBackdrop,
  animateIcons = false,
  animateKey = 0,
  onIconsSettled,
  still = false,
}: HomeMockProps) {
  const { t } = useT();
  // T82: monograms agree with the glyph exactly as on the iOS install path (previewMonogram).
  const specs = useMemo(() => monogramSpecs(rawSpecs), [rawSpecs]);
  const reduced = useMotionReduced();
  const animate = animateIcons && !reduced && !still ? animateIcons : false;
  const Cell = still ? StillCell : PopCell;
  const rawId = useId();
  const gid = `home${rawId.replace(/[^A-Za-z0-9_-]/g, '')}`;
  const w = Math.max(120, width);
  const h = Math.round(w * HOME_ASPECT);
  const dockN = Math.max(0, Math.min(COLS, Math.floor(dockCount)));
  const limit = Math.max(0, Math.floor(maxIcons ?? GRID_MAX + dockN));

  // Dock: the last `dockN` specs (only once there are more icons than dock slots).
  const dock = specs.length > dockN ? specs.slice(specs.length - dockN) : [];
  const rest = specs.length > dockN ? specs.slice(0, specs.length - dockN) : specs;
  const grid = rest.slice(0, Math.max(0, Math.min(GRID_MAX, limit - dock.length)));
  const shown = grid.length + dock.length;
  const nCustom = customisedIds ? [...grid, ...dock].filter((s) => customisedIds.has(s.appId)).length : 0;

  const padX = w * 0.05;
  const cellW = (w - padX * 2) / COLS;
  const icon = Math.max(16, Math.round(cellW * 0.64));
  const showLabels = icon >= 34;
  const statusH = h * 0.065;
  const dockH = icon + w * 0.08;
  const dockBottom = w * 0.035;
  const gridTop = statusH + h * 0.02;
  const gridBottom = dockBottom + dockH + h * 0.045;
  const rowH = (h - gridTop - gridBottom) / ROWS;
  const statusFont = Math.max(8, w * 0.04);
  const corner = w * 0.12;

  const total = grid.length + dock.length;
  const delays = useMemo(() => {
    if (animate === 'ripple') return fitDelays(rippleDelays(total, COLS, 45), RIPPLE_BUDGET_MS);
    if (animate === 'pop') return Array.from({ length: total }, (_, i) => staggerDelay(i));
    return [];
  }, [animate, total]);
  const settleMs = animate ? Math.max(0, ...delays) + durations.slow : 0;
  useEffect(() => {
    if (!onIconsSettled) return;
    const t = setTimeout(onIconsSettled, settleMs);
    return () => clearTimeout(t);
    // Re-run per replay only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateKey, animate]);
  const playKey = animate ? animateKey : 'still';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={[
        t('liveUi.homeMock.a11y', { count: shown }),
        nCustom > 0 ? t('liveUi.homeMock.a11yCustomised', { count: nCustom }) : null,
        iosMask ? t('liveUi.homeMock.a11yIosMask') : null,
      ]
        .filter(Boolean)
        .join(t('liveUi.homeMock.listSeparator'))}
      style={[styles.phone, noMirror, { width: w, height: h, borderRadius: corner, backgroundColor: backgroundColour ?? brandGlazeV2.from }]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {background ?? (backgroundColour ? null : (
          <Svg width={w} height={h}>
            <Defs>
              <LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0" stopColor={brandGlazeV2.from} stopOpacity={1} />
                <Stop offset="1" stopColor={brandGlazeV2.to} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={w} height={h} fill={`url(#${gid})`} />
          </Svg>
        ))}
      </View>

      {/* Status bar */}
      <View style={[styles.status, { height: statusH, paddingHorizontal: w * 0.09, paddingTop: statusH * 0.3 }]}>
        <Text maxFontSizeMultiplier={1.6} style={[styles.statusText, tabular, noMirrorText, { fontSize: statusFont }]}>
          9:41
        </Text>
        <View style={styles.statusIcons}>
          <Feather name="bar-chart-2" size={statusFont} color="#FFFFFF" />
          <Feather name="wifi" size={statusFont} color="#FFFFFF" />
          <Feather name="battery" size={statusFont * 1.2} color="#FFFFFF" />
        </View>
      </View>

      {/* Grid */}
      <View style={{ position: 'absolute', top: gridTop, left: padX, right: padX }}>
        {chunk(grid, COLS).map((row, r) => (
          <View key={`r${r}`} style={[styles.row, { height: rowH }]}>
            {row.map((s, i) => (
              <Cell
                key={`${s.appId}-${r}-${i}`}
                animate={animate !== false}
                delay={delays[r * COLS + i] ?? 0}
                playKey={playKey}
                style={[styles.cell, { width: cellW }]}
              >
                <IconTile
                  spec={s}
                  size={icon}
                  showLabel={showLabels && s.showLabel}
                  labelColour="#FFFFFF"
                  maxFontSizeMultiplier={1.6}
                  iosMask={iosMask}
                  backdrop={iosMask ? iconBackdrop : undefined}
                  morph={!still}
                />
                {customisedIds?.has(s.appId) ? (
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, width: icon, height: icon }}>
                    <CustomisedBadge size={Math.max(6, Math.round(icon * 0.22))} />
                  </View>
                ) : null}
              </Cell>
            ))}
          </View>
        ))}
      </View>

      {/* Page dots */}
      <View style={[styles.dots, { bottom: dockBottom + dockH + h * 0.015 }]}>
        <View style={[styles.dot, { opacity: 0.95 }]} />
        <View style={[styles.dot, { opacity: 0.45 }]} />
      </View>

      {/* Dock */}
      <View
        style={[
          styles.dock,
          {
            left: w * 0.035, // rtl-ok
            right: w * 0.035, // rtl-ok
            bottom: dockBottom,
            height: dockH,
            borderRadius: corner * 0.75,
            paddingHorizontal: padX * 0.6,
          },
        ]}
      >
        {dock.map((s, i) => (
          <Cell
            key={`d-${s.appId}-${i}`}
            animate={animate !== false}
            delay={delays[grid.length + i] ?? 0}
            playKey={playKey}
            style={styles.cell}
          >
            <IconTile
              spec={s}
              size={icon}
              showLabel={false}
              iosMask={iosMask}
              backdrop={iosMask ? iconBackdrop : undefined}
              morph={!still}
            />
            {customisedIds?.has(s.appId) ? <CustomisedBadge size={Math.max(6, Math.round(icon * 0.22))} /> : null}
          </Cell>
        ))}
      </View>
    </View>
  );
});

type PopCellProps = {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
  /** Calm timed fade-in (ripple); false = simply shown. No spring (D145-1). */
  animate: boolean;
  delay: number;
  /** Changing it replays the fade without re-mounting the icon. */
  playKey: string | number;
};

/** One icon cell; replays scale + fade on the UI thread when `playKey` changes. */
const PopCell = memo(function PopCell({ children, style, animate, delay, playKey }: PopCellProps) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, timing.base));
  }, [animate, delay, playKey, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.5),
    transform: [{ scale: 0.92 + 0.08 * p.value }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
});

/** T118: one icon cell that never animates (same props as PopCell; plain view, no hooks). */
const StillCell = memo(function StillCell({ children, style }: PopCellProps) {
  return <View style={style}>{children}</View>;
});

const styles = StyleSheet.create({
  phone: { overflow: 'hidden' },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusText: { color: '#FFFFFF', fontFamily: fonts.bodyBold },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { alignItems: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }, // rtl-ok
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  dock: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
