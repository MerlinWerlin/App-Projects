// In-app widget preview (T59): draws one WidgetSpec from src/core/widgetSets.ts with plain React
// Native views + react-native-svg, so it works in Expo Go. The real Home Screen widget comes from
// the WidgetKit extension (targets/widget) in a full build; this is only a faithful preview.
// Region frames are fractions with origin top-start, so the layout mirrors in RTL like iOS does.
// Times, dates and battery levels are formatted here in the app language (battery shows the
// spec's sample level: there is no device battery reading in the app).
// T65 looks: clear / tinted glass draw the theme wallpaper behind the see-through pane (the
// colours the core checked contrast against); glow adds a soft halo to text and glyphs.
// T85: when the wallpaper is the user's own photo, `wallpaperUri` draws that photo behind the pane
// instead (the core checked contrast against colours sampled from it, wallpaperPalette.ts).
import { Feather } from '@expo/vector-icons';
import { memo, useMemo, type ReactNode } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { DisplayFont } from '../core/artwork';
import type { WidgetFill, WidgetKind, WidgetRegion, WidgetSpec } from '../core/widgetSets';
import { daysUntil } from '../core/widgetStudio';
import { useT } from '../i18n';
import { artFontsV2 as fonts, continuous } from '../theme/tokensV2';
import type { FeatherName } from './featherName';
import { displayFontStyle } from './ThemeCard';

type Props = {
  spec: WidgetSpec;
  /** Drawn width in points; height follows the widget's aspect. */
  width: number;
  /** Local file URI of the user's photo (photo widgets). Never uploaded. */
  photoUri?: string | null;
  /** Clock used for time/date text (defaults to now; pass a fixed date for stable previews). */
  now?: Date;
  /** Screen-reader label for the whole preview (it is read as one image). */
  accessibilityLabel?: string;
  /** T85: the user's wallpaper photo, drawn behind clear / tinted glass. Never uploaded. */
  wallpaperUri?: string | null;
};

const GLYPHS: Partial<Record<WidgetKind, FeatherName>> = {
  clock: 'clock',
  date: 'calendar',
  photo: 'image',
  quote: 'feather',
  battery: 'battery-charging',
};

/** Untyped key lookup for catalogue keys carried in data (spec/region keys). */
type LooseT = (key: string) => string;

let gradientSeq = 0;

function gradientVector(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  // CSS convention: 180° runs top to bottom.
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

/** Halo colour: the glow colour at its halo strength, as rgba. */
function haloColour(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(1, opacity * 2.4).toFixed(2)})`;
}

function fontFor(spec: WidgetSpec, role: 'display' | 'body', latin: boolean): TextStyle {
  if (role === 'display') {
    const custom = displayFontStyle(spec.typeface as DisplayFont);
    if (custom) return custom;
    return latin ? { fontFamily: fonts.display } : { fontWeight: '700' };
  }
  return latin ? { fontFamily: fonts.body } : {};
}

const WEIGHTS: Record<'regular' | 'medium' | 'bold', TextStyle['fontWeight']> = { regular: '400', medium: '600', bold: '700' };

function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Monday first
  out.setDate(out.getDate() - dow);
  return out;
}

export const WidgetPreview = memo(function WidgetPreview({ spec, width, photoUri, now, accessibilityLabel, wallpaperUri }: Props) {
  const { t, script, formatClock, formatDate, formatNumber } = useT();
  const tl = t as unknown as LooseT;
  const latin = script === 'latin';
  const scale = width / spec.width;
  const height = Math.round(spec.height * scale);
  const date = useMemo(() => now ?? new Date(), [now]);
  const ids = useMemo(() => {
    gradientSeq += 1;
    return `wp${gradientSeq}`;
  }, []);

  const meters = spec.regions.filter((r) => r.role === 'meter');
  const pane = (spec.look === 'clear' || spec.look === 'tinted') && spec.surface === 'glass';
  const glowStyle: TextStyle | null = spec.glow
    ? { textShadowColor: haloColour(spec.glow.colour, spec.glow.opacity), textShadowRadius: Math.max(2, spec.glow.radius * scale), textShadowOffset: { width: 0, height: 0 } }
    : null;
  let levelIndex = 0;

  const textFor = (r: WidgetRegion): string => {
    const slot = r.text!;
    switch (slot.source) {
      case 'text':
        return slot.userText ?? (slot.key ? tl(slot.key) : '');
      case 'time':
        return formatClock(date);
      case 'weekday':
        return formatDate(date, { weekday: 'long' });
      case 'date':
        return formatDate(date, { day: 'numeric', month: 'long' });
      case 'month':
        return formatDate(date, { month: 'long' });
      case 'dayNumber':
        return formatDate(date, { day: 'numeric' });
      case 'batteryLevel': {
        const m = meters[levelIndex] ?? meters[0];
        levelIndex += 1;
        return formatNumber(m?.meter?.sampleLevel ?? 0.72, { style: 'percent' });
      }
      case 'countdown':
        return formatNumber(Math.max(0, daysUntil(spec.countdownTo, date) ?? 12));
      default:
        return '';
    }
  };

  const renderText = (r: WidgetRegion) => {
    const slot = r.text!;
    const size = slot.sizePt * scale;
    const style: TextStyle[] = [
      fontFor(spec, slot.font, latin),
      { color: r.colour ?? '#000000', fontSize: size, lineHeight: Math.round(size * 1.2), fontWeight: WEIGHTS[slot.weight] },
    ];
    if (glowStyle && r.on === 'background') style.push(glowStyle);
    if (slot.source === 'week' || slot.source === 'monthGrid') return renderCalendar(r, style, size);
    const align = slot.align === 'center' ? 'center' : slot.align === 'end' ? 'flex-end' : 'flex-start';
    return (
      <View style={[styles.textBox, { alignItems: align }]}>
        <Text
          style={[...style, slot.align === 'center' ? styles.center : null]}
          numberOfLines={slot.source === 'text' ? 4 : 1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {textFor(r)}
        </Text>
      </View>
    );
  };

  const renderCalendar = (r: WidgetRegion, style: TextStyle[], size: number) => {
    const first = startOfWeek(date);
    const day = (i: number) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
    const cell = (d: Date, k: string, label: string, dim: boolean) => {
      const today = d.toDateString() === date.toDateString();
      return (
        <Text key={k} style={[...style, styles.cell, { fontSize: size * 0.9, opacity: dim ? 0.55 : 1 }, today ? styles.today : null]} numberOfLines={1}>
          {label}
        </Text>
      );
    };
    if (r.text!.source === 'week') {
      return (
        <View style={styles.weekCol}>
          <View style={styles.row}>{Array.from({ length: 7 }, (_, i) => cell(day(i), `w${i}`, formatDate(day(i), { weekday: 'narrow' }), true))}</View>
          <View style={styles.row}>{Array.from({ length: 7 }, (_, i) => cell(day(i), `d${i}`, formatDate(day(i), { day: 'numeric' }), false))}</View>
        </View>
      );
    }
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const rows = Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + i)),
    ).filter((week) => week.some((d) => d.getMonth() === date.getMonth()));
    return (
      <View style={styles.weekCol}>
        <View style={styles.row}>{rows[0].map((d, i) => cell(d, `h${i}`, formatDate(d, { weekday: 'narrow' }), true))}</View>
        {rows.map((week, w) => (
          <View key={`r${w}`} style={styles.row}>
            {week.map((d, i) => cell(d, `c${w}-${i}`, d.getMonth() === date.getMonth() ? formatDate(d, { day: 'numeric' }) : '', false))}
          </View>
        ))}
      </View>
    );
  };

  const renderMeter = (r: WidgetRegion, w: number, h: number) => {
    const m = r.meter!;
    if (m.shape === 'ring') {
      const d = Math.min(w, h);
      const stroke = Math.max(3, d * 0.1);
      const rad = (d - stroke) / 2;
      const circ = 2 * Math.PI * rad;
      return (
        <Svg width={d} height={d} style={styles.centerSelf}>
          <Circle cx={d / 2} cy={d / 2} r={rad} stroke={m.track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={d / 2}
            cy={d / 2}
            r={rad}
            stroke={r.colour ?? '#000000'}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * m.sampleLevel} ${circ}`}
            transform={`rotate(-90 ${d / 2} ${d / 2})`}
          />
        </Svg>
      );
    }
    return (
      <View style={[styles.bar, { backgroundColor: m.track, borderRadius: h / 2 }]}>
        <View style={{ flex: m.sampleLevel, borderRadius: h / 2, backgroundColor: r.colour ?? '#000000' }} />
        <View style={{ flex: Math.max(0, 1 - m.sampleLevel) }} />
      </View>
    );
  };

  // Behind a see-through pane: the user's photo when it is their wallpaper, else the theme wallpaper.
  let wallLayer: ReactNode = null;
  if (pane && wallpaperUri) wallLayer = <ExpoImage source={wallpaperUri} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} recyclingKey={wallpaperUri} />; // i18n-ignore (JSX, no copy)
  else if (pane && spec.tokens.wallpaper.length) wallLayer = <WallpaperLayer colours={spec.tokens.wallpaper} id={`${ids}wall`} />; // i18n-ignore (JSX, no copy)

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[
        styles.widget,
        continuous,
        {
          width,
          height,
          borderRadius: spec.cornerRadius * scale,
          borderWidth: spec.border ? Math.max(1, spec.border.width * scale) : pane ? StyleSheet.hairlineWidth * 2 : 0,
          // Glass: a faint light rim, as on the system's own glass.
          borderColor: spec.border?.colour ?? (pane ? GLASS_RIM : 'transparent'),
        },
      ]}
    >
      {wallLayer}
      <FillLayer fill={spec.background} opacity={spec.backgroundOpacity} id={`${ids}bg`} />
      {spec.regions.map((r) => {
        const w = r.frame.w * width;
        const h = r.frame.h * height;
        const box = { position: 'absolute' as const, start: r.frame.x * width, top: r.frame.y * height, width: w, height: h };
        let body: ReactNode = null;
        if (r.role === 'photo') {
          body = (
            <>
              {r.fill ? <FillLayer fill={r.fill} opacity={r.fillOpacity} id={`${ids}${r.id}`} /> : null}
              {photoUri && spec.photoRef ? <ExpoImage source={photoUri} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} recyclingKey={photoUri} /> : null}
            </>
          );
        } else if ((r.role === 'band' || r.role === 'scrim') && r.fill) {
          body = <FillLayer fill={r.fill} opacity={r.fillOpacity} id={`${ids}${r.id}`} />;
        } else if (r.role === 'glyph') {
          body = (
            <View style={styles.fillCenter}>
              <Feather
                name={GLYPHS[spec.kind] ?? 'star'}
                size={Math.max(10, Math.min(w, h) * 0.9)}
                color={r.colour ?? '#000000'}
                style={glowStyle ?? undefined}
              />
            </View>
          );
        } else if (r.role === 'meter' && r.meter) {
          body = renderMeter(r, w, h);
        } else if (r.text) {
          body = renderText(r);
        }
        return (
          <View key={r.id} pointerEvents="none" style={[box, r.role === 'photo' || r.role === 'band' || r.role === 'scrim' ? styles.clip : null]}>
            {body}
          </View>
        );
      })}
    </View>
  );
});

const GLASS_RIM = 'rgba(255, 255, 255, 0.45)';

const styles = StyleSheet.create({
  widget: { overflow: 'hidden', position: 'relative' },
  clip: { overflow: 'hidden' },
  textBox: { flex: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSelf: { alignSelf: 'center' },
  bar: { flex: 1, overflow: 'hidden', flexDirection: 'row' },
  weekCol: { flex: 1, justifyContent: 'space-around' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, textAlign: 'center' },
  today: { fontWeight: '800', textDecorationLine: 'underline' },
});
