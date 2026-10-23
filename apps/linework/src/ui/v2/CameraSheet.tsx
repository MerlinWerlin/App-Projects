// Inline bottom sheet on v2 camera glass (T91) for the Trace screen: timelapse result and touch-lock intro.
// It floats above the bottom controls without a full-screen dim, so the camera stays visible. v2 radii (28 pt
// card, pill actions ≥ 50 pt); actions keep the v1 colours (primary periwinkle on dark, secondary hairline).
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { useTypography } from '../../theme/typography';
import { CameraGlassSurface, cameraGlass } from './CameraGlass';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type CameraSheetAction = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  /** Reported as busy while disabled (e.g. "Saving…"). */
  busy?: boolean;
  hint?: string;
};

export function CameraSheet({
  icon,
  title,
  children,
  actions,
}: {
  icon: FeatherName;
  title: string;
  children?: ReactNode;
  actions: CameraSheetAction[];
}) {
  const ty = useTypography();
  return (
    <CameraGlassSurface
      kind="sheet"
      style={{ width: '100%', maxWidth: 440, padding: spaceV2.x5, borderRadius: radiusV2.lg, borderTopColor: cameraGlass.highlight }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spaceV2.x2 }}>
        <Feather name={icon} size={20} color={cameraGlass.text} accessibilityElementsHidden importantForAccessibility="no" />
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={{ ...ty.face('display'), fontSize: 20, color: cameraGlass.text, flexShrink: 1 }}
        >
          {title}
        </Text>
      </View>
      {children}
      <View style={{ marginTop: spaceV2.x4, gap: spaceV2.x2 }}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            disabled={a.disabled}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityHint={a.hint}
            accessibilityState={a.busy === undefined ? undefined : { disabled: !!a.disabled, busy: a.busy }}
            style={({ pressed }) => ({
              minHeight: sizeV2.pill,
              borderRadius: radiusV2.pill,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spaceV2.x4,
              paddingVertical: spaceV2.x2,
              backgroundColor: a.primary ? cameraGlass.primary : cameraGlass.secondary,
              borderWidth: a.primary ? 0 : 1,
              borderColor: cameraGlass.border,
              opacity: a.disabled ? 0.6 : pressed ? 0.8 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ ...ty.face('bodyBold'), fontSize: 16, textAlign: 'center', color: a.primary ? cameraGlass.onPrimary : cameraGlass.text }}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </CameraGlassSurface>
  );
}

/** Secondary sheet text (muted, 15 pt). */
export function CameraSheetBody({ children, label, strong = false, gap = spaceV2.x1 }: { children: ReactNode; label?: string; strong?: boolean; gap?: number }) {
  const ty = useTypography();
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      accessibilityLabel={label}
      style={
        strong
          ? { ...ty.face('bodyMedium'), fontSize: 15, color: cameraGlass.text, marginTop: gap }
          : { ...ty.face('body'), fontSize: 15, lineHeight: ty.lhOf(21), color: cameraGlass.muted, marginTop: gap }
      }
    >
      {children}
    </Text>
  );
}
