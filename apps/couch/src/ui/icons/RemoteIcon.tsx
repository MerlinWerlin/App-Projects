import Svg, { G, Path } from 'react-native-svg';
import type { IconName } from './names';
import { ICON_PATHS, ICON_STROKE, ICON_VIEWBOX } from './paths';

export interface RemoteIconProps {
  name: IconName;
  /** Box size in pt (square). Default 24. */
  size?: number;
  /** Stroke/fill colour, from the remote theme tokens. */
  color: string;
}

/**
 * Couch's original vector icon (fb-1017b H2): 24x24 grid, one stroke weight, round caps/joins,
 * tinted by `color`. Path data lives in ./paths.ts (pure TS, unit-tested). Decorative: the
 * surrounding button carries the accessibilityLabel, so the drawing is hidden from screen readers.
 * Never mirrored in RTL: arrows and transport icons are physical directions.
 */
export function RemoteIcon({ name, size = 24, color }: RemoteIconProps) {
  const parts = ICON_PATHS[name] ?? [];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <G stroke={color} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {parts.map((p, i) =>
          p.fill ? <Path key={i} d={p.d} fill={color} stroke="none" /> : <Path key={i} d={p.d} />,
        )}
      </G>
    </Svg>
  );
}
