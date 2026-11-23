// One icon system: SF Symbols on iPhone (expo-symbols, so icons match the platform and follow its weights), with the
// matching Ionicons glyph as the fallback on web previews and Android. Call sites use the Ionicons name.
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, type StyleProp, type TextStyle } from 'react-native';

const SF: Partial<Record<keyof typeof Ionicons.glyphMap, SFSymbol>> = {
  thermometer: 'thermometer.medium',
  speedometer: 'gauge.with.dots.needle.67percent',
  construct: 'wrench.and.screwdriver.fill',
  clipboard: 'list.clipboard.fill',
  'settings-outline': 'gearshape',
  'chevron-forward': 'chevron.right',
  'chevron-down': 'chevron.down',
  'trash-outline': 'trash',
  'share-outline': 'square.and.arrow.up',
  'lock-closed': 'lock.fill',
  'checkmark-circle': 'checkmark.circle.fill',
  'radio-button-off': 'circle',
  'radio-button-on': 'largecircle.fill.circle',
  remove: 'minus',
  add: 'plus',
  'time-outline': 'clock',
  'lock-open-outline': 'lock.open',
  'refresh-outline': 'arrow.clockwise',
  'shield-checkmark-outline': 'checkmark.shield',
  'add-circle-outline': 'plus.circle',
  'grid-outline': 'tablecells',
  'information-circle-outline': 'info.circle',
  'information-circle': 'info.circle.fill',
  warning: 'exclamationmark.triangle.fill',
  'timer-outline': 'timer',
  'git-merge-outline': 'arrow.triangle.branch',
  'home-outline': 'house',
  'build-outline': 'wrench.adjustable',
  'swap-horizontal-outline': 'arrow.left.arrow.right',
  'flask-outline': 'testtube.2',
  'globe-outline': 'globe',
  'help-buoy-outline': 'lifepreserver',
  'help-circle-outline': 'questionmark.circle',
};

export type IconName = keyof typeof Ionicons.glyphMap;

export function Icon({ name, size = 24, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const fallback = <Ionicons name={name} size={size} color={color} style={style} />;
  const sf = SF[name];
  if (Platform.OS !== 'ios' || !sf) return fallback;
  return <SymbolView name={sf} size={size} tintColor={color} weight="semibold" resizeMode="scaleAspectFit" style={[{ width: size, height: size }, style as object]} fallback={fallback} />;
}

/** Keeps call sites typed as before (`keyof typeof Ionicons.glyphMap`). */
Icon.glyphMap = Ionicons.glyphMap;
