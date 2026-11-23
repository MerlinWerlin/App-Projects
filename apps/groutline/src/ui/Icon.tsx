/**
 * One icon set: SF Symbols on iPhone (they follow the text weight and Dynamic Type), with matching Ionicons only as
 * the fallback for the web preview. Names are semantic so a screen asks for "stairs", not a glyph.
 */
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform } from 'react-native';

const MAP = {
  tiles: ['square.grid.3x3', 'grid-outline'],
  setout: ['square.split.2x2', 'scan-outline'],
  materials: ['drop.halffull', 'water-outline'],
  falls: ['arrow.down.right', 'arrow-down-outline'],
  trim: ['ruler', 'resize-outline'],
  stairs: ['stairs', 'trending-up-outline'],
  tools: ['square.grid.2x2', 'grid-outline'],
  toolsOn: ['square.grid.2x2.fill', 'grid'],
  jobs: ['bookmark', 'bookmark-outline'],
  jobsOn: ['bookmark.fill', 'bookmark'],
  settings: ['gearshape', 'settings-outline'],
  settingsOn: ['gearshape.fill', 'settings'],
  share: ['square.and.arrow.up', 'share-outline'],
  save: ['bookmark', 'bookmark-outline'],
  saved: ['bookmark.fill', 'bookmark'],
  close: ['xmark', 'close'],
  remove: ['xmark.circle.fill', 'close-circle'],
  trash: ['trash', 'trash-outline'],
  chevronRight: ['chevron.right', 'chevron-forward'],
  chevronDown: ['chevron.down', 'chevron-down'],
  chevronUp: ['chevron.up', 'chevron-up'],
  check: ['checkmark', 'checkmark'],
  checkCircle: ['checkmark.circle.fill', 'checkmark-circle'],
  info: ['info.circle', 'information-circle'],
  warn: ['exclamationmark.triangle.fill', 'warning'],
  edit: ['pencil.line', 'create-outline'],
  working: ['function', 'calculator-outline'],
  add: ['plus', 'add'],
  minus: ['minus', 'remove'],
  unlock: ['lock.open', 'lock-open'],
  lock: ['lock.fill', 'lock-closed'],
  flag: ['flag', 'flag-outline'],
  book: ['book', 'book-outline'],
  help: ['questionmark.circle', 'help-buoy-outline'],
  privacy: ['hand.raised', 'shield-checkmark-outline'],
  arrowRight: ['arrow.right', 'arrow-forward'],
  globe: ['globe', 'globe-outline'],
  keyboardDown: ['keyboard.chevron.compact.down', 'chevron-down'],
} as const satisfies Record<string, readonly [SFSymbol, keyof typeof Ionicons.glyphMap]>;

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const [sf, ion] = MAP[name];
  const fallback = <Ionicons name={ion} size={size} color={color} />;
  if (Platform.OS !== 'ios') return fallback;
  return <SymbolView name={sf} size={size} tintColor={color} weight="semibold" fallback={fallback} />;
}
