// Registration / crop marks (DESIGN.md §5): four short red-pencil L-strokes at the corners of a sheet, the marks
// you line paper up with when tracing. Drawn just outside the parent's edges (the parent must not clip).
// Decorative, hidden from accessibility, mirror-safe (start/end).
import { View } from 'react-native';
import { useThemeV2 } from '../../theme/useTheme';

const LEN = 14;
const W = 2;
const GAP = 6;

export function CropMarks({ color }: { color?: string }) {
  const { c } = useThemeV2();
  const col = color ?? c.ink;
  const corner = (v: 'top' | 'bottom', h: 'start' | 'end') => {
    const off = -(GAP + W);
    return (
      <View key={v + h} style={{ position: 'absolute', [v]: off, [h]: off, width: LEN, height: LEN }}>
        <View style={{ position: 'absolute', [v]: 0, [h]: 0, width: LEN, height: W, backgroundColor: col }} />
        <View style={{ position: 'absolute', [v]: 0, [h]: 0, width: W, height: LEN, backgroundColor: col }} />
      </View>
    );
  };
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
      {corner('top', 'start')}
      {corner('top', 'end')}
      {corner('bottom', 'start')}
      {corner('bottom', 'end')}
    </View>
  );
}
