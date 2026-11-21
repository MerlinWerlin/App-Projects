import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { capColors } from '../remote/machined';

/**
 * Physical key cap (fb-1017b H2, redrawn in the Nov 2026 overhaul to match the buttons in the app icon and opening
 * animation): a domed face lit from the top left, darkening toward the bottom right, with a thin rim that catches the
 * light on top and falls into shadow underneath. Colours come from the remote theme (key / keyEdge) only; the centre of
 * the cap stays the theme's key colour, so every label keeps its AA pair. Absolutely fills its parent and never takes
 * touches. Hidden from screen readers.
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
  const c = capColors({ key: keyColor, keyEdge: edgeColor, body: keyColor });
  const dome = `kf-dome-${id}`;
  const rim = `kf-rim-${id}`;
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
        <RadialGradient id={dome} cx="0.36" cy="0.22" rx="0.95" ry="1.05" fx="0.36" fy="0.22">
          <Stop offset="0" stopColor={c.hi} />
          <Stop offset="0.55" stopColor={c.mid} />
          <Stop offset="1" stopColor={c.lo} />
        </RadialGradient>
        <LinearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.rimTop} stopOpacity={0.9} />
          <Stop offset="0.45" stopColor={c.mid} stopOpacity={0.15} />
          <Stop offset="1" stopColor={c.rimBottom} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${dome})`} />
      <Rect x="0.75" y="0.75" width="99%" height="99%" rx={radius} ry={radius} fill="none" stroke={`url(#${rim})`} strokeWidth={1.5} />
    </Svg>
  );
}
