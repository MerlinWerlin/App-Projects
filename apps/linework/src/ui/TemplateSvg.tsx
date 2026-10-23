import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_DETAIL_WIDTH, DEFAULT_STROKE_WIDTH, type Template } from '../core/templates';
import { light } from '../theme/tokens';

export type TemplateSvgProps = {
  template: Template;
  /** Rendered width and height in points (the art is square). */
  size: number;
  /** Stroke colour (default graphite). */
  color?: string;
  /** Stroke width in viewBox units (default template.strokeWidth ?? 4). */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

// Renders a bundled template's line art. Decorative by default: callers label the surrounding control.
function TemplateSvgBase({ template, size, color = light.graphite, strokeWidth, style }: TemplateSvgProps) {
  const base = template.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const width = strokeWidth ?? base;
  // Detail lines keep their ratio to the main stroke when callers scale the width (thumbnails).
  const detailWidth = width * ((template.detailWidth ?? DEFAULT_DETAIL_WIDTH) / base);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={template.viewBox}
      style={style}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {template.paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {(template.detail ?? []).map((d, i) => (
        <Path
          key={`d${i}`}
          d={d}
          stroke={color}
          strokeWidth={detailWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

export const TemplateSvg = memo(TemplateSvgBase);
