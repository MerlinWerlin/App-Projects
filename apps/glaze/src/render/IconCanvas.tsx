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
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { iconArtLayout, type IconArt } from '../core/artwork';
import type { IconBackground, IconShape, IconSpec } from '../core/iconspec';
import type { Monogram } from '../core/monogram';
import { lerpPoints, morphProgress, pointsToPath, sampleShape } from '../core/shapeMorph';
import type { Point } from '../core/shapes';
import { glyphBox, gradientVector, hairline, IOS_MASK_RADIUS, iosMaskPath, shapePath } from '../core/shapes';
import { resolveGlyph } from '../core/glyphnames';
import { useMotionReduced } from '../theme/motion';
import { ArtPaths } from './ArtPaths';
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
   * with the backdrop (black if none, as exported) filling around circle/blob shapes. Never
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
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.08} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </LinearGradient>
    );
  }
  return null;
}

function BackgroundLayer({ bg, d, size, id }: BgProps) {
  if (bg.kind === 'solid') return <Path d={d} fill={bg.colour} />;
  if (bg.kind === 'gradient') return <Path d={d} fill={`url(#${id}-grad)`} />;
  // Glass: translucent tint, white top highlight, hairline edge (stroke is centred on the
  // path, so twice the width leaves one hairline inside the clip).
  return (
    <G>
      <Path d={d} fill={bg.tint} fillOpacity={clampOpacity(bg.opacity)} />
      <Rect x={0} y={0} width={size} height={size * 0.6} fill={`url(#${id}-shine)`} />
      <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={hairline(size) * 2} />
    </G>
  );
}

/** Monogram lettering centred in the icon (T66). The baseline sits ~0.35 em below the centre. */
function MonogramText({ monogram, size }: { monogram: Monogram; size: number }) {
  const fontSize = Math.max(1, size * monogram.fontScale);
  return (
    <SvgText
      x={size / 2}
      y={size / 2 + fontSize * 0.35}
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight="700"
      fill={monogram.colour}
    >
      {monogram.text}
    </SvgText>
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
        </Defs>
        {maskD ? (
          <Path d={maskD} fill={backdrop ?? '#000000'} />
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
            <MonogramText monogram={monogram} size={s} />
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
