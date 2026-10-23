import type { MessageKey } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';

/** Canonical keys. Names match the prototype's data-key values. */
export const KEYS = [
  'POWER',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'OK',
  'BACK',
  'HOME',
  'MENU',
  'INPUT',
  'VOL_UP',
  'VOL_DOWN',
  'MUTE',
  'CH_UP',
  'CH_DOWN',
  'REW',
  'PLAY_PAUSE',
  'FF',
  'BACKSPACE',
  'ENTER',
  'SEARCH',
  // Owner feedback 12 Oct 2026 (prototype v2)
  'SOURCE',
  'SETTINGS',
  'NUM_0',
  'NUM_1',
  'NUM_2',
  'NUM_3',
  'NUM_4',
  'NUM_5',
  'NUM_6',
  'NUM_7',
  'NUM_8',
  'NUM_9',
  'NUM_DASH',
  'RED',
  'GREEN',
  'YELLOW',
  'BLUE',
  'VOICE',
] as const;

/** Digit keys in order, for the 123 number pad. */
export const NUM_KEYS = ['NUM_0', 'NUM_1', 'NUM_2', 'NUM_3', 'NUM_4', 'NUM_5', 'NUM_6', 'NUM_7', 'NUM_8', 'NUM_9'] as const;

/** Colour keys in remote order. Shown only when the driver has the 'colorKeys' capability. */
export const COLOR_KEYS = ['RED', 'GREEN', 'YELLOW', 'BLUE'] as const;

export type Key = (typeof KEYS)[number];

export function isKey(v: unknown): v is Key {
  return typeof v === 'string' && (KEYS as readonly string[]).includes(v);
}

/** Message key of each key's accessibility label (digits have none: they read as digits). */
export const KEY_LABEL_KEY: Readonly<Partial<Record<Key, MessageKey>>> = {
  POWER: 'core.key.power',
  UP: 'core.key.up',
  DOWN: 'core.key.down',
  LEFT: 'core.key.left',
  RIGHT: 'core.key.right',
  OK: 'core.key.ok',
  BACK: 'core.key.back',
  HOME: 'core.key.home',
  MENU: 'core.key.menu',
  INPUT: 'core.key.input',
  VOL_UP: 'core.key.volUp',
  VOL_DOWN: 'core.key.volDown',
  MUTE: 'core.key.mute',
  CH_UP: 'core.key.chUp',
  CH_DOWN: 'core.key.chDown',
  REW: 'core.key.rew',
  PLAY_PAUSE: 'core.key.playPause',
  FF: 'core.key.ff',
  BACKSPACE: 'core.key.backspace',
  ENTER: 'core.key.enter',
  SEARCH: 'core.key.search',
  SOURCE: 'core.key.source',
  SETTINGS: 'core.key.settings',
  NUM_DASH: 'core.key.numDash',
  RED: 'core.key.red',
  GREEN: 'core.key.green',
  YELLOW: 'core.key.yellow',
  BLUE: 'core.key.blue',
  VOICE: 'core.key.voice',
};

/**
 * Accessibility labels, identical to the prototype's aria-labels in English. Translated on read
 * (t() getters), so read them at render time: copying KEY_LABEL[k] into a module-level table freezes
 * the language of that moment (use withCopy(obj, { label: KEY_LABEL_KEY[k] }) there instead).
 */
export const KEY_LABEL: Record<Key, string> = withCopy(
  {
    POWER: '',
    UP: '',
    DOWN: '',
    LEFT: '',
    RIGHT: '',
    OK: '',
    BACK: '',
    HOME: '',
    MENU: '',
    INPUT: '',
    VOL_UP: '',
    VOL_DOWN: '',
    MUTE: '',
    CH_UP: '',
    CH_DOWN: '',
    REW: '',
    PLAY_PAUSE: '',
    FF: '',
    BACKSPACE: '',
    ENTER: '',
    SEARCH: '',
    SOURCE: '',
    SETTINGS: '',
    NUM_DASH: '',
    RED: '',
    GREEN: '',
    YELLOW: '',
    BLUE: '',
    VOICE: '',
    NUM_0: '0',
    NUM_1: '1',
    NUM_2: '2',
    NUM_3: '3',
    NUM_4: '4',
    NUM_5: '5',
    NUM_6: '6',
    NUM_7: '7',
    NUM_8: '8',
    NUM_9: '9',
  } as Record<Key, string>,
  KEY_LABEL_KEY,
);

/** Key for a digit character, or undefined. */
export function numKey(ch: string): Key | undefined {
  if (ch === '-') return 'NUM_DASH';
  return /^[0-9]$/.test(ch) ? (`NUM_${ch}` as Key) : undefined;
}

/** Per-platform code maps are filled in by each driver task (T05, T08, ...). */
export type KeyMap = Partial<Record<Key, string>>;

export function mapKey(map: KeyMap, key: Key): string | undefined {
  return map[key];
}
