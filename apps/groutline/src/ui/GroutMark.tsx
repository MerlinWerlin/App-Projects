// Brand mark (same drawing as the app icon): a set-out plan with full tiles, cut edge tiles and the orange centre lines.
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

export function GroutMark({ size = 48 }: { size?: number }) {
  const a0 = size * 0.15, span = size * 0.7;
  const g = span * 0.03, tile = span * 0.3, cut = (span - 2 * tile - 3 * g) / 2;
  const pos: Array<[number, number]> = [];
  let x = a0;
  for (const sz of [cut, tile, tile, cut]) { pos.push([x, sz]); x += sz + g; }
  const c = a0 + span / 2, w = g * 0.75, ext = g * 3;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} rx={size * 0.22} fill="#1D2024" />
        <Rect x={a0 - g * 1.2} y={a0 - g * 1.2} width={span + g * 2.4} height={span + g * 2.4} rx={g * 1.5} fill="#464A50" />
        {pos.map(([px, pw], i) => pos.map(([py, ph], j) => (
          <Rect key={`${i}-${j}`} x={px} y={py} width={pw} height={ph} rx={g * 0.8} fill={i > 0 && i < 3 && j > 0 && j < 3 ? '#F5F1E9' : '#FFBE96'} />
        )))}
        <Rect x={c - w} y={a0 - ext} width={w * 2} height={span + ext * 2} fill="#FF6A1A" />
        <Rect x={a0 - ext} y={c - w} width={span + ext * 2} height={w * 2} fill="#FF6A1A" />
      </Svg>
    </View>
  );
}
