// Text pill on v2 camera glass (T91): lock badge, sketch-step label, REC timer. Row of an optional leading icon
// and text; long translations wrap (no truncation). Accessibility props are passed through by the caller.
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { radiusV2, spaceV2 } from '../../theme/tokensV2';
import { useTypography } from '../../theme/typography';
import { CameraGlassSurface, cameraGlass } from './CameraGlass';

export type CameraPillProps = ViewProps & {
  /** Leading element (icon, dot or spinner). */
  leading?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CameraPill({ leading, children, style, ...rest }: CameraPillProps) {
  return (
    <CameraGlassSurface
      {...rest}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spaceV2.x2 - 2,
          paddingVertical: spaceV2.x2,
          paddingHorizontal: spaceV2.x3 + 2,
          borderRadius: radiusV2.pill,
        },
        style,
      ]}
    >
      {leading}
      {children}
    </CameraGlassSurface>
  );
}

/** White 14 pt label used inside a CameraPill. */
export function CameraPillText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const ty = useTypography();
  return (
    <Text style={[{ flexShrink: 1, fontSize: 14, color: cameraGlass.icon }, ty.face('bodyMedium'), style]} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}
