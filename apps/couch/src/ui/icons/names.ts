/**
 * Icon ids of Couch's own vector icon set (fb-1017b H2). Pure TS so core-free tables
 * (src/ui/remote/controls.ts) can name icons without importing react-native-svg.
 * Every id is drawn as an original SVG in src/ui/icons/RemoteIcon.tsx.
 */
export const ICON_NAMES = [
  'power', 'source', 'settings', 'home', 'back', 'menu',
  'mute', 'volUp', 'volDown', 'chUp', 'chDown',
  'playPause', 'rewind', 'fastForward',
  'mic', 'keyboard', 'numpad', 'apps', 'tv', 'search',
  'up', 'down', 'left', 'right',
  'close', 'backspace', 'enter', 'check', 'plus', 'minus', 'speaker',
  'timer',
] as const;
export type IconName = (typeof ICON_NAMES)[number];
export function isIconName(v: unknown): v is IconName {
  return typeof v === 'string' && (ICON_NAMES as readonly string[]).includes(v);
}
