/**
 * Simple mode layout as data, ported exactly from prototype/index.html viewRemote()
 * (the `S.simple` branch): a 2-column grid of big keys, read row by row.
 * Pure TS so it is unit-tested; SimpleRemote.tsx only renders it. Every control is free.
 */
import { KEY_LABEL, KEY_LABEL_KEY, type Key } from '../../core/keys';
import type { MessageKey } from '../../i18n/core';
import { withCopy } from '../lazyCopy';
import type { IconName } from '../icons/names';
import { KEY_ICON } from './controls';

export interface SimpleControl {
  key: Key;
  /** Accessibility label: KEY_LABEL[key] (prototype aria-label). */
  label: string;
  /** Visible caption under the icon (prototype button text), translated on read. */
  caption: string;
  /** Vector icon (src/ui/icons); every simple key has one. */
  icon: IconName;
  power?: boolean;
}

function s(key: Key, caption: MessageKey, power?: boolean): SimpleControl {
  const c: SimpleControl = withCopy(
    { key, label: KEY_LABEL[key], caption: '', icon: KEY_ICON[key] ?? 'tv' },
    { caption, label: KEY_LABEL_KEY[key] },
  );
  if (power) c.power = true;
  return c;
}

/** Row order: [Power, Home], [Louder, Next channel], [Quieter, Previous channel]. */
export const SIMPLE_CONTROLS: readonly SimpleControl[] = [
  s('POWER', 'ui.remote.power', true),
  s('HOME', 'ui.simple.home'),
  s('VOL_UP', 'ui.simple.louder'),
  s('CH_UP', 'ui.simple.nextChannel'),
  s('VOL_DOWN', 'ui.simple.quieter'),
  s('CH_DOWN', 'ui.simple.previousChannel'),
];

export const SIMPLE_COLUMNS = 2;
/** Prototype `.simple .key { min-height: 84px }`. */
export const SIMPLE_KEY_MIN_HEIGHT = 84;

/** Prototype log line in simple mode (message keys: left and right half). */
export const SIMPLE_NOTE_KEYS = ['ui.simple.mode', 'ui.simple.turnOff'] as const satisfies readonly MessageKey[];

/**
 * Split controls into rows of SIMPLE_COLUMNS for rendering. Larger Text (T74) passes fewer columns
 * (gridColumns in src/core/textScale.ts) when the captions no longer fit two side by side.
 */
export function simpleRows(controls: readonly SimpleControl[] = SIMPLE_CONTROLS, columns: number = SIMPLE_COLUMNS): SimpleControl[][] {
  const n = Math.max(1, Math.floor(columns));
  const rows: SimpleControl[][] = [];
  for (let i = 0; i < controls.length; i += n) rows.push(controls.slice(i, i + n));
  return rows;
}
