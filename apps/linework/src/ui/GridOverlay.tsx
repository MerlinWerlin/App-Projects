import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { gridLines, gridPreset, type GridPresetId } from '../core/grid';

export type GridOverlayProps = {
  preset: GridPresetId;
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
};

// Full-screen guide grid (thin white lines at 50% opacity). Ignores touches.
export function GridOverlay({ preset, width, height, color = 'rgba(255,255,255,0.5)', strokeWidth = 1 }: GridOverlayProps) {
  const p = gridPreset(preset);
  const lines = useMemo(
    () => (p.id === 'off' ? [] : gridLines({ x: 0, y: 0, width, height }, p.cols, p.rows)),
    [p.id, p.cols, p.rows, width, height],
  );
  if (lines.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={width} height={height}>
        {lines.map((l, i) => (
          <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={strokeWidth} />
        ))}
      </Svg>
    </View>
  );
}
