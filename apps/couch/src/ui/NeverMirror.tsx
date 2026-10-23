/**
 * Keeps physical directions in right-to-left languages (owner-1016 R3). The remote's d-pad, arrows,
 * volume/channel rockers, rewind/fast-forward and touchpad map to the TV's physical left/right, so
 * they must NOT mirror when the app runs RTL (Arabic). Everything else mirrors normally.
 * `direction: 'ltr'` is a Yoga layout style supported on iOS and Android.
 * tests/i18n-layout.test.ts asserts every physical-direction control renders inside this wrapper.
 */
import { View, type ViewProps } from 'react-native';

export const NEVER_MIRROR_STYLE = { direction: 'ltr' } as const;

export function NeverMirror({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[style, NEVER_MIRROR_STYLE]} />;
}
