/**
 * Turns the stocked-steel catalogue (catalogue.ts) into pickers: sizes in millimetres for the calculators, labels in
 * the country's own listing style (50 × 50 × 3, or 2 × 2 × 1/8"), and the usual stock lengths.
 */
import { CATALOGUES } from './catalogue.ts';
import type { Catalogue, Section } from './catalogueTypes.ts';
import type { CountryCode } from './country.ts';
import { fmt, inchFraction } from './units.ts';
import type { ShapeId } from './weight.ts';

export const FT_MM = 304.8; // 1 ft = 0.3048 m exactly
const IN_MM = 25.4;

export function catalogueFor(c: CountryCode): Catalogue | null {
  return c === 'OTHER' ? null : CATALOGUES[c];
}

/** One size in a picker: label as merchants write it, dims in mm in the order the weight calculator wants. */
export interface StockSize { label: string; dims: number[]; walls: { label: string; mm: number }[] }
export interface StockGroup { sizes: StockSize[]; verified: boolean; partial: boolean; src: string; note?: string }

/**
 * Merchants print fractional inches rounded to 3 places (3/16 as 0.188). Values within 0.00125 in of a sixteenth are
 * that fraction; gauge walls (0.065, 0.083, 0.109, 0.120...) are further away and stay as printed.
 */
export function snapInch(v: number): number {
  const s = v * 16;
  return Math.abs(s - Math.round(s)) < 0.02 ? Math.round(s) / 16 : v;
}

function toMm(v: number, unit: 'mm' | 'in'): number {
  return unit === 'in' ? snapInch(v) * IN_MM : v;
}

/** 0.125 -> 1/8, 0.065 -> 0.065 (gauge walls stay decimal), 50 -> 50. */
export function sizeLabel(v: number, unit: 'mm' | 'in'): string {
  if (unit === 'mm') return fmt(v, v % 1 ? 1 : 0);
  const snapped = snapInch(v);
  if (snapped !== v || Math.abs(v * 16 - Math.round(v * 16)) < 1e-9) return inchFraction(snapped).replace(' ', '-');
  return fmt(v, 3);
}

function sections(list: Section[], unit: 'mm' | 'in', kind: 'box' | 'flat'): StockSize[] {
  const u = unit === 'in' ? '"' : '';
  return list.map(s => ({
    label: kind === 'flat' ? `${sizeLabel(s.a, unit)}${u} wide` : `${sizeLabel(s.a, unit)} × ${sizeLabel(s.b, unit)}${u}`,
    dims: kind === 'flat' ? [toMm(s.a, unit)] : [toMm(s.a, unit), toMm(s.b, unit)],
    walls: s.walls.map(w => ({ label: `${sizeLabel(w, unit)}${u}`, mm: toMm(w, unit) })),
  }));
}

/**
 * Stocked sizes for a weight-calculator shape. SHS and RHS share the box picker. CHS falls back to the country's pipe
 * list when no structural CHS list was verified (pipe is sold and weighed the same way). Square bar has no list.
 */
export function stockFor(c: CountryCode, shape: ShapeId): StockGroup | null {
  const cat = catalogueFor(c);
  if (!cat) return null;
  const u = cat.unit;
  const g = (group: { verified: boolean; partial?: boolean; src: string; note?: string }, sizes: StockSize[]): StockGroup =>
    ({ sizes, verified: group.verified && sizes.length > 0, partial: !!group.partial, src: group.src, note: group.note });
  switch (shape) {
    case 'shs': {
      const both = [...sections(cat.shs.items, u, 'box'), ...sections(cat.rhs.items, u, 'box')];
      return g({ verified: cat.shs.verified || cat.rhs.verified, partial: !cat.rhs.verified, src: cat.shs.src }, both);
    }
    case 'chs': {
      if (cat.chs.verified && cat.chs.items.length) {
        return g(cat.chs, cat.chs.items.map(t => ({ label: `${sizeLabel(t.od, u)}${u === 'in' ? '"' : ''} OD`, dims: [toMm(t.od, u)], walls: t.walls.map(w => ({ label: `${sizeLabel(w, u)}${u === 'in' ? '"' : ''}`, mm: toMm(w, u) })) })));
      }
      const pipes = cat.pipe.sizes.map(p => ({
        label: p.name,
        dims: [toMm(p.od, u)],
        walls: Object.entries(p.walls).map(([n, w]) => ({ label: `${n.replace(/^Sch/, 'Sch ').replace('ExtraLight', 'Extra light')}`, mm: toMm(w, u) })),
      }));
      return g({ verified: pipes.length > 0, src: cat.pipe.src, note: 'Pipe sizes (no structural CHS list was verified for this country).' }, pipes);
    }
    case 'angle': return g(cat.angle, sections(cat.angle.items, u, 'box'));
    case 'flat': return g(cat.flat, sections(cat.flat.items, u, 'flat'));
    case 'plate': return g(cat.plate, cat.plate.items.map(t => ({ label: `${sizeLabel(t, u)}${u === 'in' ? '"' : ' mm'}`, dims: [toMm(t, u)], walls: [] })));
    case 'round': return g(cat.round, cat.round.items.map(d => ({ label: `${sizeLabel(d, u)}${u === 'in' ? '"' : ' mm'}`, dims: [toMm(d, u)], walls: [] })));
    default: return null;
  }
}

/** Usual stock lengths in mm: tube lengths for hollow sections, bar lengths for angle, flat and round. */
export function stockLengths(c: CountryCode, kind: 'tube' | 'bar'): number[] {
  const cat = catalogueFor(c);
  if (!cat) return [];
  const list = kind === 'tube' ? cat.lengths.tube : cat.lengths.bar;
  return list.map(v => (cat.lengths.unit === 'ft' ? v * FT_MM : v));
}
