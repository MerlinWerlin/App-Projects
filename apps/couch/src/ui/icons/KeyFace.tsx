import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  // Wide caps (voice, playback, colour keys) take straight top-to-bottom light; a round dome's light stretched across a
  // wide key reads as a curved streak.
  const [wide, setWide] = useState(false);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const next = height > 0 && width / height > 1.6;
        if (next !== wide) setWide(next);
      }}
    >
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        {wide ? (
          <LinearGradient id={dome} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.hi} />
            <Stop offset="0.5" stopColor={c.mid} />
            <Stop offset="1" stopColor={c.lo} />
          </LinearGradient>
        ) : (
          <RadialGradient id={dome} cx="0.36" cy="0.22" rx="0.95" ry="1.05" fx="0.36" fy="0.22">
            <Stop offset="0" stopColor={c.hi} />
            <Stop offset="0.55" stopColor={c.mid} />
            <Stop offset="1" stopColor={c.lo} />
          </RadialGradient>
        )}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${dome})`} />
    </Svg>
    {/* The rim: light along the top edge, shadow along the bottom, exact at any width (a View border, not an SVG stroke). */}
    <View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, borderWidth: 1, borderTopColor: c.rimTop, borderBottomColor: c.rimBottom, borderStartColor: c.mid, borderEndColor: c.mid },
      ]}
    />
    </View>
  );
}
