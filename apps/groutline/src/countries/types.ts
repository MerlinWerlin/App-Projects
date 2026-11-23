/**
 * What a country sets in Groutline: units, words, standards named in notes, falls/stairs/waterproofing defaults and
 * the materials catalogue (sizes and pack sizes commonly stocked by that country's major tile suppliers and hardware
 * chains). Retailer and brand names live only in `src` / `docs` fields and code comments: they are never shown in the UI.
 * Every value carries a source URL. Values that could not be verified are left out (the generic fallback is used)
 * or marked `verified: false` with a note.
 */
import type { StairLimits } from '../core/stairs.ts';
import type { UnitSystem } from '../core/units.ts';

export type CountryCode = 'AU' | 'NZ' | 'GB' | 'IE' | 'US' | 'CA' | 'XX';

export interface Sourced { src: string; verified?: boolean; docs?: string }

export interface TileItem extends Sourced {
  id: string;
  /** As sold, e.g. "600 × 600" or "12 × 24 in". */
  label: string;
  /** Actual size for the sums (US nominal 24 in is often 23.5 in actual). */
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  use: 'floor' | 'wall' | 'both';
  perBox?: number;
  boxM2?: number;
  sheet?: boolean;
  note?: string;
}

export interface AdhesiveItem extends Sourced {
  id: string;
  label: string;
  bagKg: number;
  /** Maker's coverage by notch, kg/m² (conservative end of the published range). */
  coverage?: Array<{ notchMm: number; kgPerM2: number }>;
  lightweight?: boolean;
}

export interface GroutItem extends Sourced {
  id: string;
  label: string;
  bagKg: number;
  /** The grout factor K in the joint-volume formula, kg/L. */
  density: number;
  kind: 'cement' | 'sanded' | 'unsanded' | 'epoxy';
  /** Maker's figure already allows for site wastage, so default extra = 0. */
  includesWaste?: boolean;
}

export interface MembraneItem extends Sourced {
  id: string;
  label: string;
  packL: number;
  /** Per m² per coat, in the pack's unit (litres, or kg for products sold by weight). */
  litresPerM2PerCoat: number;
  coats: number;
  /** 'kg' for tanking sold by weight with coverage in m² per pack (no density published). Default litres. */
  packUnit?: 'L' | 'kg';
  note?: string;
}

export interface Standard extends Sourced { topic: 'installation' | 'waterproofing' | 'falls' | 'slip' | 'stairs' | 'materials'; name: string; note: string }

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  system: UnitSystem;
  currency: string;
  /** BCP-47 locale for number and money formatting. */
  locale: string;
  spelling: 'british' | 'american';
  terms: {
    waterproofing: string; // "Waterproofing" / "Tanking"
    membrane: string;
    adhesive: string; // "Tile adhesive" / "Thinset"
    trim: string;
    falls: string; // "Falls" / "Slope"
    waste: string; // "floor waste" / "drain"
    setOut: string; // "Set-out" / "Layout"
    box: string; // "box" / "carton" / "case"
    colour: string;
    backer: string;
  };
  falls: { min: number; max: number | null; label: string; target?: number; verified: boolean } & Sourced;
  membraneHeights: { showerWallMm: number; upturnMm: number; label: string; verified: boolean } & Sourced;
  stairs: (StairLimits & Sourced) | null;
  contactRule: string;
  trimStockMm: number[];
  /** Typical joint width defaults. */
  jointMm: { floor: number; wall: number };
  standards: Standard[];
  catalogue: { tiles: TileItem[]; adhesives: AdhesiveItem[]; grouts: GroutItem[]; membranes: MembraneItem[] };
  /** Primer coverage and tape roll length defaults for the waterproofing screen (null = not verified for this country). */
  extras: { primerM2PerLitre: number | null; tapeRollMm: number | null } & Sourced;
  /** False for the generic fallback: the UI says the guidance is generic. */
  guided: boolean;
}

/** Imperial helpers for catalogue entries. */
export const IN = 25.4;
export const sqFtToM2 = (v: number) => v * 0.09290304;
export const lbToKg = (v: number) => v * 0.45359237;
export const galToL = (v: number) => v * 3.785411784;
/** Convert "X sq ft per bag of B lb" into kg/m². */
export const kgPerM2FromSqFt = (bagLb: number, sqFt: number) => lbToKg(bagLb) / sqFtToM2(sqFt);
/** Convert "X sq ft per gallon" for the finished system into L/m² for that system. */
export const lPerM2FromSqFtPerGal = (sqFtPerGal: number) => galToL(1) / sqFtToM2(sqFtPerGal);
