import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { luminance } from '../../theme/remoteThemes';
import { mixHex } from '../icons/keyFaceColors';

/**
 * The remote body's finish (Nov 2026 overhaul, DESIGN.md "The logo remote"): the panel of the app icon and opening
 * animation in the theme's body colour. Lit from the top left, falling off toward the bottom right, with a faint
 * sheen and a rim that catches the light along the top edge. Sits under any theme texture. Decoration only: no
 * touches, hidden from VoiceOver; the body colour itself is unchanged where labels sit, so every pair keeps AA.
 */
export function PanelFinish({ body, radius }: { body: string; radius: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        const h = Math.round(e.nativeEvent.layout.height);
        if (w > 0 && h > 0 && (w !== size?.w || h !== size?.h)) setSize({ w, h });
      }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
    >
      {size ? <Art body={body} w={size.w} h={size.h} r={radius} /> : null}
    </View>
  );
}

const Art = memo(function Art({ body, w, h, r }: { body: string; w: number; h: number; r: number }) {
  const dark = luminance(body) < 0.18;
  const lit = mixHex(body, '#FFFFFF', dark ? 0.1 : 0.35);
  const fall = mixHex(body, '#000000', dark ? 0.3 : 0.06);
  const rimTop = mixHex(body, '#FFFFFF', dark ? 0.32 : 0.7);
  const rimBottom = mixHex(body, '#000000', dark ? 0.5 : 0.12);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="pf-body" x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={lit} />
          <Stop offset="0.45" stopColor={body} />
          <Stop offset="1" stopColor={fall} />
        </LinearGradient>
        <RadialGradient id="pf-sheen" cx={w * 0.25} cy={h * 0.08} r={Math.max(w, h) * 0.7} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.06 : 0.25} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="pf-rim" x1="0" y1="0" x2="0" y2={h} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={rimTop} stopOpacity={0.9} />
          <Stop offset="0.3" stopColor={body} stopOpacity={0.2} />
          <Stop offset="1" stopColor={rimBottom} stopOpacity={0.8} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} fill="url(#pf-body)" />
      <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} fill="url(#pf-sheen)" />
      <Rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={r - 0.75} ry={r - 0.75} fill="none" stroke="url(#pf-rim)" strokeWidth={1.5} />
    </Svg>
  );
});
