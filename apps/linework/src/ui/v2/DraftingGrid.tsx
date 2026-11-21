// Drafting-grid paper (DESIGN.md §1): a faint 8 pt minor / 32 pt major grid printed on the paper behind the main
// screens, like the cutting mat or graph paper Linework is used on. One static SVG pattern, drawn once per screen
// size: no animation, no touches, hidden from accessibility. Graphite at a few percent, so text contrast is
// unaffected (every text sits on paper or on a card).
import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { useThemeV2 } from '../../theme/useTheme';

const MINOR = 8;
const MAJOR = MINOR * 4;

function DraftingGridImpl() {
  const { c, isDark } = useThemeV2();
  const { width, height } = useWindowDimensions();
  const minor = isDark ? 0.035 : 0.04;
  const major = isDark ? 0.07 : 0.075;
  let minorPath = '';
  for (let i = MINOR; i < MAJOR; i += MINOR) minorPath += `M${i} 0V${MAJOR}M0 ${i}H${MAJOR}`;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="lw-grid" width={MAJOR} height={MAJOR} patternUnits="userSpaceOnUse">
            <Path d={minorPath} stroke={c.graphite} strokeOpacity={minor} strokeWidth={0.5} />
            <Path d={`M0 0V${MAJOR}M0 0H${MAJOR}`} stroke={c.graphite} strokeOpacity={major} strokeWidth={0.75} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#lw-grid)" />
      </Svg>
    </View>
  );
}

export const DraftingGrid = memo(DraftingGridImpl);
