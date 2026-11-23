/**
 * Icons: SF Symbols on iOS (expo-symbols), so weights and baselines match the system; Ionicons only as the fallback
 * on platforms without SF Symbols.
 */
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

const MAP = {
  construct: ['wrench.and.screwdriver.fill', 'construct'],
  bookmarks: ['bookmark.fill', 'bookmarks'],
  settings: ['gearshape.fill', 'settings-sharp'],
  lock: ['lock.fill', 'lock-closed'],
  flash: ['bolt.fill', 'flash'],
  location: ['globe', 'globe-outline'],
  add: ['plus', 'add'],
  remove: ['minus', 'remove'],
  close: ['xmark', 'close'],
  trash: ['trash', 'trash-outline'],
  chevronRight: ['chevron.right', 'chevron-forward'],
  chevronUp: ['chevron.up', 'chevron-up'],
  chevronDown: ['chevron.down', 'chevron-down'],
  working: ['function', 'calculator-outline'],
  warning: ['exclamationmark.triangle.fill', 'warning-outline'],
  alert: ['exclamationmark.circle.fill', 'alert-circle-outline'],
  error: ['xmark.octagon.fill', 'close-circle-outline'],
  info: ['info.circle.fill', 'information-circle-outline'],
  print: ['printer.fill', 'print'],
  bookmark: ['bookmark', 'bookmark-outline'],
  help: ['lifepreserver', 'help-buoy-outline'],
  privacy: ['checkmark.shield', 'shield-checkmark-outline'],
  book: ['book', 'book-outline'],
  time: ['clock', 'time-outline'],
  check: ['checkmark', 'checkmark'],
  removeCircle: ['minus.circle', 'remove-circle-outline'],
} as const satisfies Record<string, [string, keyof typeof Ionicons.glyphMap]>;

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const [sf, ion] = MAP[name];
  // Decorative: hidden from VoiceOver so a button reads "Print template", not "print, Print template".
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <SymbolView
      name={sf as SFSymbol}
      size={size}
      tintColor={color}
      weight="semibold"
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
      fallback={<Ionicons name={ion} size={size} color={color} />}
    />
    </View>
  );
}
