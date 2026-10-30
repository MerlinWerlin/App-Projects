// In-app preview of one catalogue widget (T78; CatalogueSpec from src/core/widgetKinds.ts). Plain
// React Native views + react-native-svg, so it works in Expo Go. The real widget is drawn by the
// WidgetKit extension in a full build; this is a faithful picture of the spec, nothing more:
//
// - Time-based parts (analog hands, month grid, progress dots, countdown) use calendarMaths with
//   the device's current time (`now`, default: a clock that ticks every 30 s).
// - Buttons (`action` regions) are drawn but do nothing here: the in-app preview never pretends a
//   habit tap worked. Screens that show habit widgets label them "Preview only".
// - Habit values come only from what the user logged (`habitValue`); with none it shows 0 / "–".
//   The goal is the person's own (`habitGoal`, T86) or the tracker's default.
//   Nothing is read from health, weather or media apps.
// - Accessory (Lock Screen) sizes render monochrome: white at the spec's tint opacity over a dark
//   modelled backdrop, the way iOS tints them. StandBy specs are already solved on black.
//
// T85 looks: clear / tinted glass draw the wallpaper behind the see-through pane (the theme
// wallpaper's colours, or the user's photo via `wallpaperUri`: what the core checked contrast
// against); glow adds a soft halo to text and glyphs.
//
// T92: what to draw (sizes, pane, halo, frame, per-region draw kind, colours and resolved text)
// comes from src/core/catalogueWidgetModel.ts, which is tested for every kind in every look;
// this file only turns that model into views.
//
// Region frames are fractions with origin top-start, so the layout mirrors in RTL like iOS does
// (the dial and the dot grid don't mirror, matching the system).
import { Feather } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { DisplayFont } from '../core/artwork';
import { dotGrid, handAngles, monthProgress, yearProgress } from '../core/calendarMaths';
import { catalogueWidgetModel, type CatalogueRegionDraw, type CatalogueRegionModel } from '../core/catalogueWidgetModel';
import type { CatalogueSpec } from '../core/widgetKinds';
import type { WidgetFill } from '../core/widgetSets';
import { useT } from '../i18n';
import { artFontsV2 as fonts, continuous } from '../theme/tokensV2';
import type { FeatherName } from './featherName';
import { displayFontStyle } from './ThemeCard';

type Props = {
  spec: CatalogueSpec;
  /** Drawn width in points; height follows the widget's aspect. */
  width: number;
  /** Device time to draw (defaults to a live clock). */
  now?: Date;
  /** Today's value the user logged for this habit (habit widgets). Omitted: nothing logged. */
  habitValue?: number;
  /** T86: the person's daily goal for this habit (useWidgetHabits). Omitted: the tracker's default. */
  habitGoal?: number;
  /** Screen-reader label for the whole preview (it is read as one image). */
  accessibilityLabel?: string;
  /** T85: the user's wallpaper photo, drawn behind clear / tinted glass. Never uploaded. */
  wallpaperUri?: string | null;
};

/** Untyped key lookup for keys carried in data. */
type LooseT = (key: string) => string;

const SYMBOLS: Record<string, FeatherName> = {
  theme: 'star',
  water: 'droplet',
  moon: 'moon',
  steps: 'activity',
  mood: 'smile',
  hourglass: 'watch',
  next: 'skip-forward',
  plus: 'plus',
  minus: 'minus',
  mood1: 'frown',
  mood2: 'frown',
  mood3: 'meh',
  mood4: 'smile',
  mood5: 'smile',
};

const WEIGHTS: Record<'regular' | 'medium' | 'bold', TextStyle['fontWeight']> = { regular: '400', medium: '600', bold: '700' };

let gradientSeq = 0;

function gradientVector(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2;
  const dy = -Math.cos(a) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

function FillLayer({ fill, opacity, id }: { fill: WidgetFill; opacity: number; id: string }) {
  if (fill.kind === 'solid') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill.colour, opacity }]} />;
  }
  const v = gradientVector(fill.angle);
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
          <Stop offset="0" stopColor={fill.from} stopOpacity={1} />
          <Stop offset="1" stopColor={fill.to} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </Svg>
  );
}

/** The theme wallpaper behind a clear / tinted pane (a gradient of its colours, top to bottom). */
function WallpaperLayer({ colours, id }: { colours: readonly string[]; id: string }) {
  const stops: readonly string[] = colours.length === 1 ? [colours[0], colours[0]] : colours;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1={0.5} y1={0} x2={0.5} y2={1}>
          {stops.map((c, i) => (
            <Stop key={`${c}${i}`} offset={String(i / (stops.length - 1))} stopColor={c} stopOpacity={1} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function fontFor(spec: CatalogueSpec, role: 'display' | 'body', latin: boolean): TextStyle {
  if (role === 'display') {
    const custom = displayFontStyle(spec.typeface as DisplayFont);
    if (custom) return custom;
    return latin ? { fontFamily: fonts.display } : { fontWeight: '700' };
  }
  return latin ? { fontFamily: fonts.body } : {};
}

/** A clock that re-renders every 30 s while mounted (only when no `now` is passed). */
function useNow(fixed: Date | undefined): Date {
  const [tick, setTick] = useState<Date>(() => new Date());
  useEffect(() => {
    if (fixed) return undefined;
    const id = setInterval(() => setTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, [fixed]);
  return fixed ?? tick;
}

export const CatalogueWidgetPreview = memo(function CatalogueWidgetPreview({ spec, width, now, habitValue, habitGoal, accessibilityLabel, wallpaperUri }: Props) {
  const { t, script, formatDate, formatNumber } = useT();
  const tl = t as unknown as LooseT;
  const latin = script === 'latin';
  const date = useNow(now);
  const ids = useMemo(() => {
    gradientSeq += 1;
    return `cwp${gradientSeq}`;
  }, []);

  const model = catalogueWidgetModel({
    spec,
    width,
    now: date,
    habitValue,
    habitGoal,
    wallpaperUri,
    hairline: StyleSheet.hairlineWidth,
    format: { t: tl, formatDate, formatNumber },
  });
  const { mono, pad, drawW, height } = model;
  const glowStyle: TextStyle | null = model.glow
    ? { textShadowColor: model.glow.colour, textShadowRadius: model.glow.radius, textShadowOffset: { width: 0, height: 0 } }
    : null;
  /** Glow halo on what is drawn straight on the widget background (not on bands or buttons). */
  const haloFor = (m: CatalogueRegionModel): TextStyle | null => (glowStyle && m.halo ? glowStyle : null);

  const textStyle = (m: CatalogueRegionModel): TextStyle[] => {
    const slot = m.region.text!;
    const halo = haloFor(m);
    return [
      fontFor(spec, slot.font, latin),
      { color: m.colour, opacity: m.opacity, fontSize: m.textSize, lineHeight: m.lineHeight, fontWeight: WEIGHTS[slot.weight] },
      ...(halo ? [halo] : []),
    ];
  };

  const renderText = (m: CatalogueRegionModel): ReactNode => {
    const slot = m.region.text!;
    const style = textStyle(m);
    const align = slot.align === 'center' ? 'center' : slot.align === 'end' ? 'flex-end' : 'flex-start';
    return (
      <View style={[styles.textBox, { alignItems: align }]}>
        <Text style={[...style, slot.align === 'center' ? styles.center : null]} numberOfLines={slot.source === 'text' ? 3 : 1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {m.text}
        </Text>
      </View>
    );
  };

  const renderGrid = (m: CatalogueRegionModel): ReactNode => {
    const grid = m.grid!;
    const style = textStyle(m);
    const cellSize = m.textSize * 0.92;
    const marker = grid.marker;
    return (
      <View style={styles.gridCol}>
        <View style={styles.row}>
          {grid.heads.map((h, i) => (
            <Text key={`h${i}`} style={[...style, styles.cell, { fontSize: cellSize, opacity: m.opacity * 0.6 }]} numberOfLines={1}>
              {h}
            </Text>
          ))}
        </View>
        {grid.weeks.map((week, w) => (
          <View key={`w${w}`} style={styles.row}>
            {week.map((cell, i) => (
              <View key={`c${w}-${i}`} style={styles.cellBox}>
                {cell.today && marker ? (
                  <View style={[styles.todayDot, { width: cellSize * 1.7, height: cellSize * 1.7, borderRadius: cellSize, backgroundColor: marker.todayFill }]} />
                ) : null}
                <Text
                  style={[...style, styles.center, { fontSize: cellSize }, cell.today && marker ? { color: marker.todayText, fontWeight: '700' } : null]}
                  numberOfLines={1}
                >
                  {cell.label}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderDial = (m: CatalogueRegionModel): ReactNode => {
    const dial = m.region.dial!;
    const d = Math.min(m.box.width, m.box.height);
    const c = d / 2;
    const a = handAngles(date);
    const hand = (deg: number, len: number, stroke: number, colour: string) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return <Line x1={c} y1={c} x2={c + Math.cos(rad) * len} y2={c + Math.sin(rad) * len} stroke={colour} strokeWidth={stroke} strokeLinecap="round" />;
    };
    const ticks = Array.from({ length: dial.ticks }, (_, i) => {
      const major = dial.ticks === 12 || i % 5 === 0;
      const rad = ((i * 360) / dial.ticks - 90) * (Math.PI / 180);
      const outer = c * 0.96;
      const inner = outer - (major ? c * 0.12 : c * 0.05);
      return (
        <Line
          key={`t${i}`}
          x1={c + Math.cos(rad) * inner}
          y1={c + Math.sin(rad) * inner}
          x2={c + Math.cos(rad) * outer}
          y2={c + Math.sin(rad) * outer}
          stroke={dial.tick}
          strokeWidth={Math.max(1, major ? d * 0.018 : d * 0.008)}
          strokeLinecap="round"
        />
      );
    });
    const numerals = dial.numerals
      ? Array.from({ length: 12 }, (_, i) => {
          const n = i === 0 ? 12 : i;
          const rad = ((i * 30 - 90) * Math.PI) / 180;
          const rr = c * 0.7;
          const fs = d * 0.1;
          return (
            <SvgText key={`n${i}`} x={c + Math.cos(rad) * rr} y={c + Math.sin(rad) * rr + fs * 0.35} fontSize={fs} fontWeight="600" fill={dial.hand} textAnchor="middle">
              {formatNumber(n)}
            </SvgText>
          );
        })
      : null;
    return (
      <Svg width={d} height={d} style={[styles.centerSelf, { opacity: m.opacity }]}>
        {ticks}
        {numerals}
        {hand(a.hour, c * 0.5, Math.max(2, d * 0.045), dial.hand)}
        {hand(a.minute, c * 0.78, Math.max(1.5, d * 0.03), dial.hand)}
        <Circle cx={c} cy={c} r={Math.max(2, d * 0.03)} fill={dial.hand} />
      </Svg>
    );
  };

  const renderDots = (m: CatalogueRegionModel): ReactNode => {
    const dots = m.region.dots!;
    const w = m.box.width;
    const h = m.box.height;
    const p = dots.source === 'year' ? yearProgress(date) : monthProgress(date);
    const { columns, rows } = dotGrid(p.total, w / Math.max(1, h));
    const pitch = Math.min(w / columns, h / rows);
    const rad = Math.max(0.6, pitch * 0.36);
    const offX = (w - pitch * columns) / 2;
    const offY = (h - pitch * rows) / 2;
    return (
      <Svg width={w} height={h} style={{ opacity: m.opacity }}>
        {Array.from({ length: p.total }, (_, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const day = i + 1;
          const fill = day === p.day ? dots.today : day < p.day ? m.colour : dots.track;
          return <Circle key={`d${i}`} cx={offX + pitch * (col + 0.5)} cy={offY + pitch * (row + 0.5)} r={day === p.day ? rad * 1.25 : rad} fill={fill} />;
        })}
      </Svg>
    );
  };

  const renderMeter = (m: CatalogueRegionModel): ReactNode => {
    const meter = m.region.meter!;
    const w = m.box.width;
    const h = m.box.height;
    const level = m.level;
    if (meter.shape === 'ring') {
      const d = Math.min(w, h);
      const stroke = Math.max(3, d * 0.1);
      const rad = (d - stroke) / 2;
      const circ = 2 * Math.PI * rad;
      return (
        <Svg width={d} height={d} style={styles.centerSelf}>
          <Circle cx={d / 2} cy={d / 2} r={rad} stroke={meter.track} strokeWidth={stroke} fill="none" />
          {level > 0 ? (
            <Circle
              cx={d / 2}
              cy={d / 2}
              r={rad}
              stroke={m.colour}
              strokeOpacity={m.opacity}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ * level} ${circ}`}
              transform={`rotate(-90 ${d / 2} ${d / 2})`}
            />
          ) : null}
        </Svg>
      );
    }
    return (
      <View style={[styles.bar, { backgroundColor: meter.track, borderRadius: h / 2 }]}>
        <View style={{ flex: level, borderRadius: h / 2, backgroundColor: m.colour, opacity: m.opacity }} />
        <View style={{ flex: Math.max(0, 1 - level) }} />
      </View>
    );
  };

  const renderGlyph = (m: CatalogueRegionModel): ReactNode => {
    const name: FeatherName = SYMBOLS[m.symbol ?? 'theme'] ?? 'star';
    return (
      <View style={styles.fillCenter}>
        <Feather name={name} size={Math.max(8, Math.min(m.box.width, m.box.height) * 0.9)} color={m.colour} style={[{ opacity: m.opacity }, haloFor(m)]} />
      </View>
    );
  };

  /** Button look only: nothing here is pressable (see the file header). */
  const renderAction = (m: CatalogueRegionModel): ReactNode => {
    const r = m.region;
    const name: FeatherName = SYMBOLS[m.symbol ?? 'plus'] ?? 'circle';
    const bg = r.fill?.kind === 'solid' ? r.fill.colour : 'transparent';
    const s = Math.min(m.box.width, m.box.height);
    return (
      <View style={[styles.action, continuous, { backgroundColor: bg, borderRadius: s / 2.4 }]}>
        <Feather name={name} size={Math.max(8, s * 0.55)} color={m.colour} />
      </View>
    );
  };

  const renderRegion = (m: CatalogueRegionModel): ReactNode => {
    const draw: CatalogueRegionDraw = m.draw;
    switch (draw) {
      case 'fill':
        return m.region.fill ? <FillLayer fill={m.region.fill} opacity={m.region.fillOpacity} id={`${ids}${m.region.id}`} /> : null;
      case 'glyph':
        return renderGlyph(m);
      case 'meter':
        return renderMeter(m);
      case 'dial':
        return renderDial(m);
      case 'dots':
        return renderDots(m);
      case 'action':
        return renderAction(m);
      case 'text':
        return renderText(m);
      case 'grid':
        return renderGrid(m);
      case 'none':
        return null;
      default: {
        const unknown: never = draw;
        void unknown;
        return null;
      }
    }
  };

  const regions = model.regions.map((m) => {
    const box = { position: 'absolute' as const, start: m.box.start, top: m.box.top, width: m.box.width, height: m.box.height };
    return (
      <View key={m.region.id} pointerEvents="none" style={[box, m.clip ? styles.clip : null]}>
        {renderRegion(m)}
      </View>
    );
  });

  const a11y = {
    accessible: !!accessibilityLabel,
    accessibilityRole: accessibilityLabel ? ('image' as const) : undefined,
    accessibilityLabel,
    importantForAccessibility: accessibilityLabel ? ('yes' as const) : ('no-hide-descendants' as const),
  };

  // Behind a see-through pane: the user's photo when it is their wallpaper, else the theme wallpaper.
  let wallLayer: ReactNode = null;
  if (model.wallpaper?.kind === 'photo') wallLayer = <ExpoImage source={model.wallpaper.uri} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} recyclingKey={model.wallpaper.uri} />; // i18n-ignore (JSX, no copy)
  else if (model.wallpaper?.kind === 'colours') wallLayer = <WallpaperLayer colours={model.wallpaper.colours} id={`${ids}wall`} />; // i18n-ignore (JSX, no copy)

  if (mono && model.stage) {
    // Lock Screen: a dark modelled backdrop around the system-tinted widget.
    const material = model.stage.material;
    return (
      <View {...a11y} style={[styles.lockStage, continuous, { width, padding: pad, backgroundColor: model.stage.colour }]}>
        <View style={[styles.widget, { width: drawW, height }]}>
          {material ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, continuous, { backgroundColor: material.colour, opacity: material.opacity, borderRadius: material.borderRadius }]}
            />
          ) : null}
          {regions}
        </View>
      </View>
    );
  }

  const frame = model.frame;
  return (
    <View
      {...a11y}
      style={[
        styles.widget,
        continuous,
        {
          width: frame.width,
          height: frame.height,
          borderRadius: frame.borderRadius,
          borderWidth: frame.borderWidth,
          // Glass: a faint light rim, as on the system's own glass.
          borderColor: frame.borderColour,
        },
      ]}
    >
      {wallLayer}
      {model.background ? <FillLayer fill={model.background.fill} opacity={model.background.opacity} id={`${ids}bg`} /> : null}
      {regions}
    </View>
  );
});

const styles = StyleSheet.create({
  widget: { overflow: 'hidden', position: 'relative' },
  lockStage: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  textBox: { flex: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSelf: { alignSelf: 'center' },
  bar: { flex: 1, overflow: 'hidden', flexDirection: 'row' },
  gridCol: { flex: 1, justifyContent: 'space-around' },
  row: { flexDirection: 'row', flex: 1 },
  cell: { flex: 1, textAlign: 'center' },
  cellBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  todayDot: { position: 'absolute' },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
