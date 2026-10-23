// Camera glass (docs/DESIGN_V2.md §4 "Materials": camera controls keep dark glass, systemUltraThinMaterialDark;
// oversight D72-3). Used only by the Trace screen's pills, buttons and sheets; the camera preview, the traced
// overlay and its gestures are never wrapped in it.
//
// iOS with expo-blur and without Reduce Transparency: a dark ultra-thin BlurView under a lighter wash. Otherwise
// (Android, missing module, Reduce Transparency) the v1 solid dark-glass fill, so nothing changes there.
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { getBlurView, useReduceTransparency } from '../../native/blur';
import { shouldBlur } from '../../core/materials';
import { cameraBlurMaterial, cameraGlass, cameraGlassFill, type CameraGlassKind } from '../../core/cameraGlass';
import { squircle } from './shared';

export { cameraGlass };
export type { CameraGlassKind };

/** Blur layer + background colour for one camera glass surface. */
export function useCameraGlass(kind: CameraGlassKind) {
  const reduceTransparency = useReduceTransparency();
  const Blur = getBlurView();
  const blur = shouldBlur({ os: Platform.OS, hasModule: !!Blur, reduceTransparency });
  const layer =
    blur && Blur ? <Blur {...cameraBlurMaterial()} pointerEvents="none" style={StyleSheet.absoluteFill} /> : null;
  return { layer, blur: !!layer, backgroundColor: cameraGlassFill(!!layer, kind) };
}

export type CameraGlassSurfaceProps = ViewProps & {
  kind?: CameraGlassKind;
  /** Draw the hairline border (default true). */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * A View painted with camera glass. Give it a borderRadius in `style`; the blur is clipped to it. All other View
 * props (accessibility, pointerEvents, layout) pass straight through.
 */
export function CameraGlassSurface({ kind = 'pill', bordered = true, style, children, ...rest }: CameraGlassSurfaceProps) {
  const g = useCameraGlass(kind);
  return (
    <View
      {...rest}
      style={[
        squircle,
        {
          backgroundColor: g.backgroundColor,
          overflow: g.layer ? 'hidden' : 'visible',
          borderWidth: bordered ? 1 : 0,
          borderColor: cameraGlass.border,
        },
        style,
      ]}
    >
      {g.layer}
      {children}
    </View>
  );
}
