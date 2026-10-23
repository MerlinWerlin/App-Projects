/**
 * Catalogue integrity (owner-1016 R3). Non-English catalogues are machine translations awaiting
 * native review (docs/I18N.md). Strict now: no unknown keys, same {placeholders} as English, plural
 * messages have 'other', and (since run 31, T52 complete) every English key exists in every locale.
 */
import { CATALOGUES, en, type MessageKey } from '../src/i18n/catalog';
import type { Msg } from '../src/i18n/catalog/types';
import { t } from '../src/i18n/core';
import { LOCALE_CODES, type LocaleCode } from '../src/i18n/locales';

const STRICT_MISSING = true;

const enKeys = Object.keys(en) as MessageKey[];
const others = LOCALE_CODES.filter((c): c is Exclude<LocaleCode, 'en'> => c !== 'en');

function forms(m: Msg): string[] {
  return typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
}

function placeholders(m: Msg): string[] {
  const set = new Set<string>();
  for (const f of forms(m)) for (const x of f.matchAll(/\{(\w+)\}/g)) set.add(x[1]!);
  return [...set].sort();
}

describe('message catalogues', () => {
  it('ships a catalogue for every locale', () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...LOCALE_CODES].sort());
  });

  it('English plural messages have other', () => {
    for (const k of enKeys) {
      const m = en[k] as Msg;
      if (typeof m !== 'string') expect({ k, other: typeof m.other }).toEqual({ k, other: 'string' });
    }
  });

  describe.each(others)('%s', (code) => {
    const cat = CATALOGUES[code];

    it('has no keys that English lacks', () => {
      const extra = Object.keys(cat).filter((k) => !Object.prototype.hasOwnProperty.call(en, k));
      expect(extra).toEqual([]);
    });

    it('keeps the English {placeholders} for every key', () => {
      for (const [k, m] of Object.entries(cat) as Array<[MessageKey, Msg | undefined]>) {
        if (m === undefined || !Object.prototype.hasOwnProperty.call(en, k)) continue;
        expect({ k, ph: placeholders(m) }).toEqual({ k, ph: placeholders(en[k] as Msg) });
      }
    });

    it('plural messages have other', () => {
      for (const [k, m] of Object.entries(cat) as Array<[string, Msg | undefined]>) {
        if (m !== undefined && typeof m !== 'string') expect({ k, other: typeof m.other }).toEqual({ k, other: 'string' });
      }
    });

    it('missing keys (reported, not yet enforced)', () => {
      const missing = enKeys.filter((k) => cat[k] === undefined);
      if (missing.length > 0) console.log(`[i18n] ${code}: ${missing.length}/${enKeys.length} keys missing (English fallback)`);
      if (STRICT_MISSING) expect(missing).toEqual([]);
    });
  });
});

describe('pseudo-locale', () => {
  /** Short distinctive values so growth is measured on the copy, not the params. */
  function sampleParams(m: Msg): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const p of placeholders(m)) out[p] = p === 'count' ? 7 : `Q${p.length}`;
    return out;
  }

  it('every English message is accented, bracketed, at least 1.3x longer and keeps param values', () => {
    for (const k of enKeys) {
      const params = sampleParams(en[k] as Msg);
      const base = t(k, params, 'en');
      const ps = t(k, params, 'pseudo');
      expect({ k, long: ps.length >= Math.ceil(base.length * 1.3) }).toEqual({ k, long: true });
      expect({ k, bracketed: ps.startsWith('[') && ps.endsWith(']') }).toEqual({ k, bracketed: true });
      for (const v of Object.values(params)) expect({ k, has: ps.includes(String(v)) }).toEqual({ k, has: true });
      if (/[A-Za-z]/.test(base.replace(/Q\d/g, ''))) expect({ k, accented: /[\u00C0-\u024F\u1E00-\u1EFF]/.test(ps) }).toEqual({ k, accented: true });
    }
  });
});
