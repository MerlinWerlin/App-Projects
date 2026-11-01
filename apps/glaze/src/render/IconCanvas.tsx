// IconCanvas: draws one icon from an IconSpec at `size` points.
// Layers (all clipped to the shape): background (solid / gradient / glass) → theme texture →
// glyph → corner stickers → frame (along the inside of the shape edge). A user's own image
// replaces the texture, glyph, stickers and frame but keeps the shape. In-house glyphs are SVG;
// Feather glyphs are a font overlay, so stickers and the frame go in a second clipped SVG on top
// of it. Labels are not drawn here (iOS draws them); see IconTile for previews.
// `morph` (previews only, T35): when the shape changes, the outline morphs from the old shape to
// the new one over MORPH_MS (JS-driven, requestAnimationFrame, points from src/core/shapeMorph.ts),
// then snaps to the exact shapePath. Off by default, so captures always draw the final shape.

import { forwardRef, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { iconArtLayout, type DisplayFont, type IconArt } from '../core/artwork';
import type { IconBackground, IconShape, IconSpec } from '../core/iconspec';
import type { Monogram, MonogramLook } from '../core/monogram';
import { lerpPoints, morphProgress, pointsToPath, sampleShape } from '../core/shapeMorph';
import type { Point } from '../core/shapes';
import { glyphBox, gradientVector, hairline, IOS_MASK_RADIUS, iosMaskPath, shapePath } from '../core/shapes';
import { resolveGlyph } from '../core/glyphnames';
import { useMotionReduced } from '../theme/motion';
import { ArtPaths } from './ArtPaths';
import { iconBackdrop } from '../core/iconBackdrop';
import { GLASS_FROST } from '../core/iconLook';
import { FeatherGlyphOverlay, InhouseSvgGlyph } from './glyphs';

/** The fields IconCanvas needs; a full IconSpec satisfies it. */
export type IconDrawSpec = Pick<IconSpec, 'shape' | 'background' | 'glyph' | 'glyphColour' | 'glyphScale'> & {
  /** Seeds the blob shape so each app gets its own stable blob. */
  appId?: string;
  glyphSet?: string;
  /** Local image URI (file://, data:, ph:// resolved to file) that fills the shape instead of the glyph. */
  overrideImage?: string;
  /** Theme artwork (texture, stickers, frame). Absent = plain icon. */
  art?: IconArt;
  /** T66: lettering drawn instead of the glyph (apps with no glyph). */
  monogram?: Monogram;
};

export type IconCanvasProps = {
  spec: IconDrawSpec;
  /** Edge length in points. */
  size: number;
  /** Optional colour behind the shape (fills the transparent corners), e.g. to match a wallpaper. */
  backdrop?: string;
  /**
   * Preview only: show the icon as iOS does, clipped to iOS's own rounded-square web-clip mask
   * with the backdrop (the icon background colour if unset) filling around circle/blob shapes. Never
   * used for captures: the exported PNG is the full square and iOS applies the mask itself.
   */
  iosMask?: boolean;
  /**
   * Preview only: morph the outline when `spec.shape` changes (snaps when Reduce Motion is on).
   * Default false; never set it for the off-screen PNG capture.
   */
  morph?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;

function safeId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '');
}

function clampOpacity(o: number): number {
  return typeof o === 'number' && Number.isFinite(o) ? Math.max(0, Math.min(1, o)) : 1;
}

type BgProps = { bg: IconBackground; d: string; size: number; id: string };

function BackgroundDefs({ bg, id }: { bg: IconBackground; id: string }) {
  if (bg.kind === 'gradient') {
    const v = gradientVector(bg.angle);
    return (
      <LinearGradient id={`${id}-grad`} x1={pct(v.x1)} y1={pct(v.y1)} x2={pct(v.x2)} y2={pct(v.y2)}>
        <Stop offset="0" stopColor={bg.from} stopOpacity={1} />
        <Stop offset="1" stopColor={bg.to} stopOpacity={1} />
      </LinearGradient>
    );
  }
  if (bg.kind === 'glass') {
    return (
      <LinearGradient id={`${id}-shine`} x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={GLASS_FROST.shineTop} />
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={GLASS_FROST.shineMid} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </LinearGradient>
    );
  }
  return null;
}

function BackgroundLayer({ bg, d, size, id }: BgProps) {
  if (bg.kind === 'solid') return <Path d={d} fill={bg.colour} />;
  if (bg.kind === 'gradient') return <Path d={d} fill={`url(#${id}-grad)`} />;
  // Glass: translucent tint, faint white top frost, quiet hairline edge (stroke is centred on the
  // path, so twice the width leaves one hairline inside the clip). T240: frost values live in
  // src/core/iconLook.ts GLASS_FROST (the old bright 0.55 shine / 0.5 rim read as a white tile).
  return (
    <G>
      <Path d={d} fill={bg.tint} fillOpacity={clampOpacity(bg.opacity)} />
      <Rect x={0} y={0} width={size} height={size * 0.6} fill={`url(#${id}-shine)`} />
      <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={GLASS_FROST.edge} strokeWidth={hairline(size) * 2} />
    </G>
  );
}

/**
 * T170: font family for a theme's display-type token (same families as ThemeCard's
 * displayFontStyle). undefined = the system face ('display', and any script the face lacks).
 */
function monogramFontFamily(font: DisplayFont | undefined): string | undefined {
  switch (font) {
    case 'serif':
      return Platform.select({ ios: 'Georgia', default: 'serif' });
    case 'script':
      return Platform.select({ ios: 'Snell Roundhand', default: 'serif' });
    case 'mono':
      return Platform.select({ ios: 'Menlo', default: 'monospace' });
    case 'rounded':
      return Platform.select({ ios: 'Avenir Next', default: 'sans-serif-medium' });
    default:
      return undefined;
  }
}

/** Gradient / glow definitions for a themed monogram plate (T170). */
function MonogramDefs({ look, size, id }: { look: MonogramLook; size: number; id: string }) {
  if (look.treatment === 'gradient') {
    return (
      <LinearGradient id={`${id}-mono`} x1="15%" y1="10%" x2="85%" y2="90%">
        <Stop offset="0" stopColor={look.plate} stopOpacity={1} />
        <Stop offset="1" stopColor={look.plateTo} stopOpacity={1} />
      </LinearGradient>
    );
  }
  if (look.treatment === 'glow') {
    const r = size * look.radius;
    return (
      <RadialGradient id={`${id}-mono`} cx={size / 2} cy={size / 2} r={r} fx={size / 2} fy={size / 2} gradientUnits="userSpaceOnUse">
        <Stop offset={0} stopColor={look.plate} stopOpacity={look.glowOpacity} />
        <Stop offset={0.55} stopColor={look.plate} stopOpacity={look.glowOpacity * 0.5} />
        <Stop offset={1} stopColor={look.plate} stopOpacity={0} />
      </RadialGradient>
    );
  }
  return null;
}

/** The plate under a themed monogram (T170): disc, two-tone disc with a hairline, ring, or glow. */
function MonogramPlate({ look, size, id }: { look: MonogramLook; size: number; id: string }) {
  const c = size / 2;
  const r = size * look.radius;
  const sw = Math.max(1, size * look.stroke);
  if (look.treatment === 'ring') {
    return <Circle cx={c} cy={c} r={r} fill="none" stroke={look.plate} strokeWidth={sw} />;
  }
  if (look.treatment === 'glow') {
    return <Circle cx={c} cy={c} r={r} fill={`url(#${id}-mono)`} />;
  }
  return (
    <G>
      <Circle cx={c} cy={c} r={r} fill={look.treatment === 'gradient' ? `url(#${id}-mono)` : look.plate} />
      <Circle cx={c} cy={c} r={Math.max(1, r - sw * 2.5)} fill="none" stroke={look.accent} strokeOpacity={0.6} strokeWidth={sw} />
    </G>
  );
}

/** Monogram lettering centred in the icon (T66). The baseline sits ~0.35 em below the centre. */
function MonogramText({ monogram, size, id }: { monogram: Monogram; size: number; id: string }) {
  const fontSize = Math.max(1, size * monogram.fontScale);
  const look = monogram.look;
  return (
    <G>
      {look ? <MonogramPlate look={look} size={size} id={id} /> : null}
      <SvgText
        x={size / 2}
        y={size / 2 + fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={look ? look.weight : '700'}
        fontFamily={look ? monogramFontFamily(look.font) : undefined}
        fill={monogram.colour}
      >
        {monogram.text}
      </SvgText>
    </G>
  );
}

type ShapeKey = { shape: IconShape; size: number; seed: string };

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/**
 * The outline to draw: `finalD` normally; while a morph runs, the interpolated outline between
 * the previous shape (or wherever an interrupted morph had got to) and the new one.
 */
function useMorphedPath(finalD: string, key: ShapeKey, enabled: boolean, reduced: boolean): string {
  const [animD, setAnimD] = useState<string | null>(null);
  const prev = useRef<ShapeKey>(key);
  const inFlight = useRef<Point[] | null>(null);

  // Layout effect: the first morph frame replaces the new shape before it is painted.
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = key;
    if (!enabled || reduced || from.size !== key.size || from.seed !== key.seed || from.shape === key.shape) {
      inFlight.current = null;
      setAnimD(null);
      return undefined;
    }
    const start = inFlight.current ?? sampleShape(from.shape, key.size, from.seed);
    const end = sampleShape(key.shape, key.size, key.seed);
    inFlight.current = start;
    setAnimD(pointsToPath(start));
    const t0 = now();
    let raf = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const elapsed = now() - t0;
      const t = morphProgress(elapsed);
      if (t >= 1) {
        inFlight.current = null;
        setAnimD(null);
        return;
      }
      const pts = lerpPoints(start, end, t);
      inFlight.current = pts;
      setAnimD(pointsToPath(pts));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key.shape, key.size, key.seed, enabled, reduced]);

  return enabled && !reduced && animD !== null ? animD : finalD;
}

export const IconCanvas = forwardRef<View, IconCanvasProps>(function IconCanvas(
  { spec, size, backdrop, iosMask = false, morph = false, accessibilityLabel, style },
  ref,
) {
  const rawId = useId();
  const id = `glz${safeId(rawId)}`;
  const s = Math.max(1, size);
  const finalD = useMemo(() => shapePath(spec.shape, s, spec.appId ?? spec.glyph), [spec.shape, s, spec.appId, spec.glyph]);
  const reduced = useMotionReduced();
  const d = useMorphedPath(finalD, { shape: spec.shape, size: s, seed: spec.appId ?? spec.glyph }, morph, reduced);
  const box = glyphBox(s, spec.glyphScale);
  const glyph = resolveGlyph(spec.glyph, spec.glyphSet);
  const image = typeof spec.overrideImage === 'string' && spec.overrideImage.length > 0 ? spec.overrideImage : null;
  const clip = `url(#${id}-clip)`;
  const art = image ? null : spec.art ?? null;
  const seed = spec.appId ?? spec.glyph;
  const artLayout = useMemo(() => (art ? iconArtLayout(art, spec.shape, s, seed) : null), [art, spec.shape, s, seed]);
  const maskD = useMemo(() => (iosMask ? iosMaskPath(s) : null), [iosMask, s]);
  const monogram = !image && spec.monogram && spec.monogram.text.length > 0 ? spec.monogram : null;
  const hasTop = artLayout !== null && (artLayout.stickers.length > 0 || artLayout.frame.length > 0);

  return (
    <View
      ref={ref}
      collapsable={false}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        { width: s, height: s, overflow: 'hidden' },
        // iOS mask preview: the view clip also trims the Feather glyph overlay and the top art layer.
        iosMask ? { borderRadius: s * IOS_MASK_RADIUS, borderCurve: 'continuous' as const } : null,
        style,
      ]}
    >
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Defs>
          <ClipPath id={`${id}-clip`}>
            <Path d={d} />
          </ClipPath>
          <BackgroundDefs bg={spec.background} id={id} />
          {monogram?.look ? <MonogramDefs look={monogram.look} size={s} id={id} /> : null}
        </Defs>
        {maskD ? (
          <Path d={maskD} fill={iconBackdrop(spec.background, backdrop)} />
        ) : backdrop ? (
          <Rect x={0} y={0} width={s} height={s} fill={backdrop} />
        ) : null}
        <G clipPath={clip}>
          <BackgroundLayer bg={spec.background} d={d} size={s} id={id} />
          {artLayout ? <ArtPaths paths={artLayout.texture} /> : null}
          {image ? (
            <SvgImage
              href={image}
              x={0}
              y={0}
              width={s}
              height={s}
              preserveAspectRatio="xMidYMid slice"
              clipPath={clip}
            />
          ) : monogram ? (
            <MonogramText monogram={monogram} size={s} id={id} />
          ) : glyph.source === 'inhouse' ? (
            <InhouseSvgGlyph name={glyph.name} box={box} colour={spec.glyphColour} />
          ) : null}
        </G>
      </Svg>
      {!image && !monogram && glyph.source === 'feather' ? (
        <FeatherGlyphOverlay name={glyph.name} box={box} colour={spec.glyphColour} />
      ) : null}
      {hasTop && artLayout ? (
        <Svg
          width={s}
          height={s}
          viewBox={`0 0 ${s} ${s}`}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <Defs>
            <ClipPath id={`${id}-clip2`}>
              <Path d={d} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${id}-clip2)`}>
            <ArtPaths paths={artLayout.stickers} />
            <ArtPaths paths={artLayout.frame} />
          </G>
        </Svg>
      ) : null}
    </View>
  );
});
