// Static paper-grain texture for Home (docs/POLISH.md L7). An original SVG "noise": a deterministic scatter of
// tiny low-opacity dots and specks from a seeded PRNG, generated once per screen size. No animation, no touches,
// hidden from accessibility. Graphite at ~3–5% on light paper, paper-light at ~3% on dark.
import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { light } from '../theme/tokens';

const MAX_DOTS = 340;
const MAX_SPECKS = 60;

// mulberry32: small, fast, deterministic.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dot = { x: number; y: number; r: number; o: number };
type Speck = { d: string; o: number; w: number };

function makeGrain(width: number, height: number): { dots: Dot[]; specks: Speck[] } {
  const rand = prng(0x11e3c0de);
  const area = Math.max(1, width * height);
  const dotCount = Math.min(MAX_DOTS, Math.round(area / 1100));
  const speckCount = Math.min(MAX_SPECKS, Math.round(dotCount / 6));
  const dots: Dot[] = [];
  for (let i = 0; i < dotCount; i++) {
    dots.push({
      x: Math.round(rand() * width * 10) / 10,
      y: Math.round(rand() * height * 10) / 10,
      r: Math.round((0.35 + rand() * 0.75) * 100) / 100,
      o: 0.6 + rand() * 0.4,
    });
  }
  const specks: Speck[] = [];
  for (let i = 0; i < speckCount; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 1.5 + rand() * 3;
    const ang = rand() * Math.PI;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    specks.push({
      d: `M${x.toFixed(1)} ${y.toFixed(1)} l${dx.toFixed(1)} ${dy.toFixed(1)}`,
      o: 0.5 + rand() * 0.5,
      w: Math.round((0.4 + rand() * 0.4) * 100) / 100,
    });
  }
  return { dots, specks };
}

function PaperGrainBase() {
  const { isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const w = Math.round(width);
  const h = Math.round(height);
  const grain = useMemo(() => makeGrain(w, h), [w, h]);
  // Per-element opacity is scaled by these peaks: light 3–5%, dark ~3%.
  const tint = isDark ? light.paper : light.graphite;
  const peak = isDark ? 0.034 : 0.05;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Svg width={w} height={h}>
        {grain.dots.map((d, i) => (
          <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={tint} fillOpacity={peak * d.o} />
        ))}
        {grain.specks.map((s, i) => (
          <Path
            key={`s${i}`}
            d={s.d}
            stroke={tint}
            strokeOpacity={peak * s.o}
            strokeWidth={s.w}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

// No props: memoised so Home re-renders (busy state, recents) do not re-diff the few hundred grain nodes.
export const PaperGrain = memo(PaperGrainBase);
