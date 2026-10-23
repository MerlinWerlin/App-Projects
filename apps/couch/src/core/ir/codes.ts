/**
 * Candidate infrared code sets per TV brand. Each set maps canonical Keys to protocol + address +
 * command. Values are widely published protocol facts, written out here by hand (sources and licence
 * note in CODES.md); no LIRC / IRDB / other database file was copied.
 *
 * EVERY SET IS UNVERIFIED ON HARDWARE. The setup flow exists precisely because a set may not work:
 * the user taps Volume up and says whether the TV reacted.
 */
import { t } from '../../i18n/core';
import type { Key } from '../keys';
import type { IrCode, IrProtocol } from './protocols';

export const IR_BRANDS = ['Samsung', 'LG', 'Sony', 'Hisense', 'TCL', 'Panasonic', 'Philips'] as const;
export type IrBrand = (typeof IR_BRANDS)[number];
export const NOT_SURE = 'Not sure' as const;
export type IrBrandChoice = IrBrand | typeof NOT_SURE;

/** What the brand grid shows for a choice: brand names are data; "Not sure" is translated. */
export function irBrandChoiceLabel(choice: IrBrandChoice): string {
  return choice === NOT_SURE ? t('core.ir.notSure') : choice;
}

/** Brand grid order, as in the prototype. */
export const IR_BRAND_CHOICES: readonly IrBrandChoice[] = [...IR_BRANDS, NOT_SURE];

export interface IrCodeSet {
  /** Stable id, e.g. 'samsung32-07'. */
  id: string;
  /** Short description for diagnostics. */
  label: string;
  protocol: IrProtocol;
  address: number;
  keys: Partial<Record<Key, number>>;
  /** Free-text caveat shown in diagnostics / CODES.md. */
  note?: string;
}

function digits(fn: (n: number) => number): Partial<Record<Key, number>> {
  const out: Partial<Record<Key, number>> = {};
  for (let n = 0; n <= 9; n++) out[`NUM_${n}` as Key] = fn(n);
  return out;
}

/** Samsung32, address 0x07 (the "E0E0..." codes). */
const SAMSUNG_07: IrCodeSet = {
  id: 'samsung32-07',
  label: 'Samsung32 address 0x07',
  protocol: 'samsung32',
  address: 0x07,
  keys: {
    POWER: 0x02,
    VOL_UP: 0x07,
    VOL_DOWN: 0x0b,
    MUTE: 0x0f,
    CH_UP: 0x12,
    CH_DOWN: 0x10,
    SOURCE: 0x01,
    MENU: 0x1a,
    UP: 0x60,
    DOWN: 0x61,
    LEFT: 0x65,
    RIGHT: 0x62,
    OK: 0x68,
    BACK: 0x58,
    HOME: 0x79,
    ...{ NUM_1: 0x04, NUM_2: 0x05, NUM_3: 0x06, NUM_4: 0x08, NUM_5: 0x09, NUM_6: 0x0a, NUM_7: 0x0c, NUM_8: 0x0d, NUM_9: 0x0e, NUM_0: 0x11 },
  },
};

/** NEC, address 0x04 (the "20DF..." codes). */
const LG_04: IrCodeSet = {
  id: 'nec-04',
  label: 'NEC address 0x04',
  protocol: 'nec',
  address: 0x04,
  keys: {
    POWER: 0x08,
    VOL_UP: 0x02,
    VOL_DOWN: 0x03,
    MUTE: 0x09,
    CH_UP: 0x00,
    CH_DOWN: 0x01,
    SOURCE: 0x0b,
    SETTINGS: 0x43,
    UP: 0x40,
    DOWN: 0x41,
    LEFT: 0x07,
    RIGHT: 0x06,
    OK: 0x44,
    BACK: 0x28,
    HOME: 0x7c,
    ...digits((n) => 0x10 + n),
  },
};

/** Sony SIRC 12-bit, address 1 (TV). */
const SONY_1: IrCodeSet = {
  id: 'sirc12-01',
  label: 'Sony SIRC 12-bit address 1',
  protocol: 'sirc12',
  address: 1,
  keys: {
    POWER: 21,
    VOL_UP: 18,
    VOL_DOWN: 19,
    MUTE: 20,
    CH_UP: 16,
    CH_DOWN: 17,
    SOURCE: 37,
    UP: 116,
    DOWN: 117,
    LEFT: 52,
    RIGHT: 51,
    OK: 101,
    HOME: 96,
    ...digits((n) => (n === 0 ? 9 : n - 1)),
  },
};

/** Panasonic Kaseikyo (vendor 0x2002), TV address 0x008. */
const PANASONIC_008: IrCodeSet = {
  id: 'kaseikyo-008',
  label: 'Panasonic Kaseikyo address 0x008',
  protocol: 'kaseikyo',
  address: 0x008,
  keys: {
    POWER: 0x3d,
    VOL_UP: 0x20,
    VOL_DOWN: 0x21,
    MUTE: 0x32,
    CH_UP: 0x34,
    CH_DOWN: 0x35,
  },
};

/** Philips RC5, system 0 (TV). */
const PHILIPS_RC5_0: IrCodeSet = {
  id: 'rc5-00',
  label: 'Philips RC5 system 0',
  protocol: 'rc5',
  address: 0,
  keys: {
    POWER: 12,
    VOL_UP: 16,
    VOL_DOWN: 17,
    MUTE: 13,
    CH_UP: 32,
    CH_DOWN: 33,
    ...digits((n) => n),
  },
  note: 'Older Philips TVs. Newer Philips TVs use RC6, which is not implemented yet.',
};

/** NEC extended address 0xC7EA: the IR remote of Roku TV models (sold under Hisense, TCL and others). */
const ROKU_TV_C7EA: IrCodeSet = {
  id: 'nec-c7ea',
  label: 'NEC extended address 0xC7EA (Roku TV models)',
  protocol: 'nec',
  address: 0xc7ea,
  keys: {
    POWER: 0x17,
    VOL_UP: 0x0f,
    VOL_DOWN: 0x30,
    MUTE: 0x20,
  },
  note: 'Lower confidence than the other sets. Covers Roku TV models only; these brands\' own remotes are not covered yet.',
};

/** Candidate sets per brand, most likely first. */
export const IR_CODE_SETS: Readonly<Record<IrBrand, readonly IrCodeSet[]>> = {
  Samsung: [SAMSUNG_07],
  LG: [LG_04],
  Sony: [SONY_1],
  Hisense: [ROKU_TV_C7EA],
  TCL: [ROKU_TV_C7EA],
  Panasonic: [PANASONIC_008],
  Philips: [PHILIPS_RC5_0],
};

export interface IrCandidate {
  /** Brand that owns the set (for "Not sure" this is the brand it was listed under). */
  brand: IrBrand;
  /** 1-based position within that brand's list; (brand, set) identifies the code set. */
  set: number;
  codeSet: IrCodeSet;
}

/** Sets to try for a brand choice. "Not sure" = every brand's sets in order, each set once. */
export function candidatesFor(choice: IrBrandChoice): IrCandidate[] {
  const brands: readonly IrBrand[] = choice === NOT_SURE ? IR_BRANDS : [choice];
  const seen = new Set<string>();
  const out: IrCandidate[] = [];
  for (const brand of brands) {
    (IR_CODE_SETS[brand] ?? []).forEach((codeSet, i) => {
      if (seen.has(codeSet.id)) return;
      seen.add(codeSet.id);
      out.push({ brand, set: i + 1, codeSet });
    });
  }
  return out;
}

/** The code set saved on a TV as (irBrand, irSet), or null when it no longer exists. */
export function codeSetFor(brand: string, set: number): IrCodeSet | null {
  if (!(IR_BRANDS as readonly string[]).includes(brand)) return null;
  return IR_CODE_SETS[brand as IrBrand][set - 1] ?? null;
}

export function isIrBrandChoice(v: unknown): v is IrBrandChoice {
  return typeof v === 'string' && (IR_BRAND_CHOICES as readonly string[]).includes(v);
}

/** The IrCode for a key in a set, or undefined when the set has no such key. */
export function codeFor(set: IrCodeSet, key: Key): IrCode | undefined {
  const command = set.keys[key];
  return command === undefined ? undefined : { protocol: set.protocol, address: set.address, command };
}
