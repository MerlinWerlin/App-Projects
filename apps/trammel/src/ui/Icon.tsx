// One icon system: SF Symbols on iPhone (expo-symbols), Ionicons only where SF Symbols don't exist (web preview,
// Android). Every icon in the app goes through this, by meaning rather than by glyph name.
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform } from 'react-native';

const MAP = {
  stairs: ['stairs', 'stats-chart'],
  layout: ['ruler', 'barcode-outline'],
  decking: ['square.split.1x2', 'reorder-four'],
  cutlist: ['scissors', 'cut'],
  rafter: ['triangle', 'triangle-outline'],
  hip: ['arrow.triangle.branch', 'git-merge-outline'],
  pitch: ['angle', 'trending-up'],
  mitre: ['skew', 'contract-outline'],
  crown: ['square.on.square', 'shapes-outline'],
  square: ['square.dashed', 'scan-outline'],
  arc: ['circle.bottomhalf.filled', 'radio-button-off'],
  convert: ['arrow.left.arrow.right', 'swap-horizontal'],
  tools: ['square.grid.2x2', 'grid-outline'],
  toolsOn: ['square.grid.2x2.fill', 'grid'],
  jobs: ['folder', 'folder-open-outline'],
  jobsOn: ['folder.fill', 'folder-open'],
  settings: ['gearshape', 'settings-outline'],
  settingsOn: ['gearshape.fill', 'settings'],
  lock: ['lock.fill', 'lock-closed'],
  unlock: ['lock.open', 'lock-open-outline'],
  chevron: ['chevron.right', 'chevron-forward'],
  chevronDown: ['chevron.down', 'chevron-down'],
  chevronUp: ['chevron.up', 'chevron-up'],
  check: ['checkmark.circle.fill', 'checkmark-circle'],
  checkmark: ['checkmark', 'checkmark'],
  warn: ['exclamationmark.circle.fill', 'alert-circle'],
  fail: ['xmark.circle.fill', 'close-circle'],
  close: ['xmark.circle.fill', 'close-circle'],
  plus: ['plus', 'add'],
  plusCircle: ['plus.circle', 'add-circle-outline'],
  minus: ['minus', 'remove'],
  bookmark: ['bookmark', 'bookmark-outline'],
  share: ['square.and.arrow.up', 'share-outline'],
  trash: ['trash', 'trash-outline'],
  time: ['clock', 'time-outline'],
  refresh: ['arrow.clockwise', 'refresh-outline'],
  shield: ['checkmark.shield', 'shield-checkmark-outline'],
  book: ['book', 'book-outline'],
  help: ['questionmark.circle', 'help-buoy-outline'],
  calc: ['function', 'calculator-outline'],
  edit: ['pencil', 'create-outline'],
  globe: ['globe', 'globe-outline'],
  arrow: ['arrow.right', 'arrow-forward'],
  folder: ['folder.fill', 'folder-open'],
} as const satisfies Record<string, readonly [string, keyof typeof Ionicons.glyphMap]>;

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const [sf, ion] = MAP[name];
  if (Platform.OS === 'ios') {
    return <SymbolView name={sf as SFSymbol} size={size} tintColor={color} weight="semibold" fallback={<Ionicons name={ion} size={size} color={color} />} />;
  }
  return <Ionicons name={ion} size={size} color={color} />;
}
