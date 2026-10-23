// Captions under round camera-screen controls (T94: moved here from the retired v1 GlassButton). White 11 pt
// text with a soft shadow so it reads on any camera view; wraps to a second line for longer translations
// (German, French) instead of being cut off. Hidden from screen readers: the control itself carries the label.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTypography } from '../../theme/typography';
import { cameraGlass } from './CameraGlass';

/** Width of a captioned control column: 5 fit side by side on a 320 pt phone (5 × 56 + 4 × 4 gaps = 296). */
export const CAPTION_WIDTH = 56;

export function CaptionText({ children, dim = false }: { children: string; dim?: boolean }) {
  const ty = useTypography();
  return (
    <Text
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      maxFontSizeMultiplier={1.2}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        marginTop: 3,
        width: CAPTION_WIDTH,
        textAlign: 'center',
        ...ty.face('bodyMedium'),
        fontSize: 11,
        lineHeight: ty.lhOf(14),
        color: cameraGlass.icon,
        opacity: dim ? 0.6 : 1,
        textShadowColor: cameraGlass.captionShadow,
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      }}
    >
      {children}
    </Text>
  );
}

/** Puts a caption under a control rendered elsewhere (e.g. the timelapse RecordButton). */
export function Captioned({ caption, dim, children }: { caption: string; dim?: boolean; children: ReactNode }) {
  return (
    <View style={{ width: CAPTION_WIDTH, alignItems: 'center' }}>
      {children}
      <CaptionText dim={dim}>{caption}</CaptionText>
    </View>
  );
}
