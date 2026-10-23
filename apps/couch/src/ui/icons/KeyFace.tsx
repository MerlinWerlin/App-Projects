import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { keyFaceColors } from './keyFaceColors';

/**
 * Physical-button face (fb-1017b H2): a gentle top-to-bottom gradient, a thin top highlight and a
 * soft inner shadow along the bottom edge, drawn behind a key's icon. Colours come from the remote
 * theme (key / keyEdge, see keyFace.ts); the shading is kept small so every label keeps AA.
 * Absolutely fills its parent and never takes touches. Hidden from screen readers.
 */
export function KeyFace({
  keyColor,
  edgeColor,
  radius,
}: {
  keyColor: string;
  edgeColor: string;
  /** Corner radius in pt; large values (999) give a round key. */
  radius: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const c = keyFaceColors({ key: keyColor, keyEdge: edgeColor });
  const face = `kf-face-${id}`;
  const gloss = `kf-gloss-${id}`;
  const shade = `kf-shade-${id}`;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Defs>
        <LinearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.top} />
          <Stop offset="1" stopColor={c.bottom} />
        </LinearGradient>
        <LinearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.highlight} stopOpacity={c.highlightOpacity} />
          <Stop offset="0.18" stopColor={c.highlight} stopOpacity={0} />
          <Stop offset="1" stopColor={c.highlight} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.shade} stopOpacity={0} />
          <Stop offset="0.78" stopColor={c.shade} stopOpacity={0} />
          <Stop offset="1" stopColor={c.shade} stopOpacity={c.shadeOpacity} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${face})`} />
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${shade})`} />
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${gloss})`} />
    </Svg>
  );
}
