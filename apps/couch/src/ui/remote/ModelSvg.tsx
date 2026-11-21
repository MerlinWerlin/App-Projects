import { memo, type ComponentType } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Gradient, Shape } from '../../core/introRemote';

type AnyComponent = ComponentType<Record<string, unknown>>;
const SHAPES: Record<Shape['kind'], AnyComponent> = {
  circle: Circle as unknown as AnyComponent,
  path: Path as unknown as AnyComponent,
  rect: Rect as unknown as AnyComponent,
  ellipse: Ellipse as unknown as AnyComponent,
};

function Grad({ g }: { g: Gradient }) {
  const stops = g.stops.map(([offset, color, opacity], i) => (
    <Stop key={i} offset={offset} stopColor={color} stopOpacity={opacity ?? 1} />
  ));
  return g.type === 'linear' ? (
    <LinearGradient id={g.id} gradientUnits="userSpaceOnUse" {...g.attrs}>
      {stops}
    </LinearGradient>
  ) : (
    <RadialGradient id={g.id} gradientUnits="userSpaceOnUse" {...g.attrs}>
      {stops}
    </RadialGradient>
  );
}

/**
 * Draws a shape model (src/ui/remote/machined.ts, the same model kind as the opening animation) at `size` pt square,
 * in pt coordinates. Memoised: callers pass a model built once per size and theme (useMemo), so a key press never
 * re-renders the artwork. Decoration only: no touches, hidden from VoiceOver.
 */
export const ModelSvg = memo(function ModelSvg({
  size,
  gradients,
  shapes,
  style,
}: {
  size: number;
  gradients: readonly Gradient[];
  shapes: readonly Shape[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      width={size}
      height={size}
      pointerEvents="none"
      style={[styles.art, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {gradients.length > 0 ? (
        <Defs>
          {gradients.map((g) => (
            <Grad key={g.id} g={g} />
          ))}
        </Defs>
      ) : null}
      {shapes.map((s, i) => {
        const C = SHAPES[s.kind];
        return <C key={i} {...s.attrs} />;
      })}
    </Svg>
  );
});

const styles = StyleSheet.create({ art: { position: 'absolute', top: 0 } });
