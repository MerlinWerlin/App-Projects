import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { materialMode, materialOverlay, materials, type Material } from '../../theme/design';
import { registeredBlurView } from './blurRegistry';
import { useDesign } from './useDesign';
import { useReducedTransparency } from './useReducedTransparency';

/**
 * Translucent material (market-1018 M3): a blur of what is behind, under a tint overlay whose opacity
 * alone keeps text at WCAG AA over any backdrop (proven in design.test.ts; secondary text only on
 * 'thick' / 'chrome'). Solid fill instead with Reduce Transparency, on Android, or when no blur view
 * is registered (see blurRegistry.ts). Purely visual: never focusable, children keep their own roles.
 */
export function BlurMaterial({
  material = 'regular',
  style,
  children,
}: {
  material?: Material;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const p = useDesign();
  const reduceTransparency = useReducedTransparency();
  const Blur = registeredBlurView();
  const mode = materialMode({ reduceTransparency, hasBlur: Blur !== null, platform: Platform.OS });

  if (mode === 'solid' || !Blur) {
    // The palette's surface, so a remote theme's sheet keeps its body colour when solid.
    return <View style={[{ backgroundColor: p.surface }, style]}>{children}</View>;
  }
  return (
    <View style={[styles.clip, style]}>
      <Blur intensity={materials[material].intensity} tint={p.scheme} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: materialOverlay(material, p.scheme) }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
