// Round camera-screen control on v2 camera glass (T91). Same props and behaviour as the v1 GlassButton it
// replaces on the Trace screen: white Feather icon, optional caption under the circle (part of the tap target,
// hidden from screen readers), ink fill when active, ≥ 48 pt, no own haptic (callers fire theirs).
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { touch } from '../../theme/tokens';
import { PressableScale } from '../PressableScale';
import { CAPTION_WIDTH, CaptionText } from './CameraCaption';
import { CameraGlassSurface, cameraGlass } from './CameraGlass';
import type { FeatherName } from './shared';

export type CameraButtonProps = {
  icon: FeatherName;
  /** Spoken name of the control. */
  label: string;
  /** Short always-visible word under the button. */
  caption?: string;
  onPress: () => void;
  /** Toggle state: ink fill when on, reported to screen readers as selected. */
  active?: boolean;
  /** Diameter in points; never below the 48 pt touch target. */
  size?: number;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CameraButton({
  icon,
  label,
  caption,
  onPress,
  active,
  size = 52,
  accessibilityHint,
  disabled = false,
  style,
}: CameraButtonProps) {
  const d = Math.max(touch, size);
  const circle = (pressed: boolean) => (
    <CameraGlassSurface
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0, borderRadius: d / 2, backgroundColor: cameraGlass.fillActive }}
        />
      ) : null}
      <Feather name={icon} size={Math.round(d * 0.42)} color={cameraGlass.icon} />
    </CameraGlassSurface>
  );
  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint,
    accessibilityState: active === undefined ? { disabled } : { disabled, selected: active },
  };

  if (caption) {
    return (
      <PressableScale
        onPress={onPress}
        haptic="none"
        disabled={disabled}
        {...a11y}
        hitSlop={4}
        style={[{ width: Math.max(d, CAPTION_WIDTH), alignItems: 'center' }, style]}
      >
        {({ pressed }) => (
          <>
            {circle(pressed)}
            <CaptionText dim={disabled}>{caption}</CaptionText>
          </>
        )}
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onPress} haptic="none" scaleTo={0.94} disabled={disabled} {...a11y} hitSlop={6} style={style}>
      {({ pressed }) => circle(pressed)}
    </PressableScale>
  );
}
