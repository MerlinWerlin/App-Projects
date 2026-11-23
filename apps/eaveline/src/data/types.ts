/**
 * Country catalogue types. Every number carries a source; `verified` says how good that source is:
 *   primary    — read from the maker's data sheet, the standard/code text or the regulator's page
 *   secondary  — from a reputable secondary page (supplier listing, code-commentary site, search extract)
 *   unverified — not confirmed; the app shows a "check locally" tag and uses it only as a starting value
 * Brand and retailer names appear in `brandNote` (code docs only). The UI shows only generic `name`s.
 */
import type { Terms } from '../core/context';
import type { PitchStyle, UnitSystem } from '../core/units';

export type Verified = 'primary' | 'secondary' | 'unverified';
export interface Source { label: string; url: string; verified: Verified }

export interface SheetProfile {
  id: string;
  name: string;
  coverMm: number;
  minPitchDeg: number | null;
  endLapMm: number | null; // null: maker gives none / end laps not allowed (see note)
  fixEnd: number | null; // fasteners per sheet at end supports
  fixMid: number | null; // fasteners per sheet at intermediate supports
  note?: string;
  brandNote?: string;
  src: Source;
}

export interface TileProduct {
  id: string;
  name: string;
  kind: 'tile' | 'slate';
  coverWidthMm: number | null;
  maxGaugeMm: number | null;
  tilesPerM2: number | null;
  lengthMm?: number; // slates / plain tiles: gauge = (length − headlap) ÷ 2
  headlapMm?: number;
  minPitchDeg: number | null;
  fixingsPerTile?: number | null;
  note?: string;
  brandNote?: string;
  src: Source;
}

export interface ShingleProduct {
  id: string;
  name: string;
  bundlesPerSquare: number;
  shinglesPerSquare: number;
  nailsPerShingle: number;
  minPitchDeg: number | null;
  note?: string;
  brandNote?: string;
  src: Source;
}

export interface CapProduct {
  id: string;
  name: string;
  perMetre?: number;
  effectiveLengthMm?: number;
  ftPerBundle?: number;
  kind: 'ridgeTile' | 'shingleCap' | 'starter';
  src: Source;
}

export interface GutterProduct {
  id: string;
  name: string;
  /** Flow one gutter run can carry to one outlet, L/s (null if the local method is table-based on area). */
  capacityLps: number | null;
  /** Maximum effective roof area for this gutter with one end outlet (UK Approved Document H style). */
  maxAreaM2?: number | null;
  effectiveAreaMm2?: number | null;
  stockLengthsMm: number[];
  note?: string;
  src: Source;
}

export interface DownpipeProduct {
  id: string;
  name: string;
  capacityLps: number | null;
  /** Rule-of-thumb roof area one downpipe serves, when that is all the source gives. */
  ruleAreaM2?: number | null;
  /** Table of maximum plan roof area per downpipe by pitch (NZ E1/AS1 Table 5 style). */
  maxAreaByPitch?: { maxPitchDeg: number; m2: number }[];
  stockLengthsMm: number[];
  note?: string;
  src: Source;
}

export interface CityRain { name: string; mmPerHr: number; basis: string; src: Source }

export interface Drainage {
  /** flow: Q vs L/s per outlet · areaTable: downpipe table by pitch · areaPerDownpipe: user reads area from the standard's chart */
  mode: 'flow' | 'areaTable' | 'areaPerDownpipe';
  /** areaPerDownpipe mode: a worked value to start from, with where it came from. */
  areaPerDownpipeExample?: { m2: number; text: string };
  method: string; // shown with every estimate
  /** Catchment multiplier on plan area by pitch; return 1 where the method uses plan area. */
  slopeFactor: (pitchDeg: number) => number;
  slopeFactorNote: string;
  fallRatio: number; // default gradient 1 in N
  fallNote: string;
  fallSrc: Source;
  designIntensityMmPerHr: number | null; // national design value where one exists (e.g. UK 75 mm/h)
  intensityNote: string;
  cities: CityRain[];
  maxDownpipeSpacingMm: number | null;
  spacingNote?: string;
  src: Source;
}

export interface Standard { topic: string; name: string; src: Source }

export interface Defaults {
  overhangMm: number; // sheet into gutter
  maxSheetMm: number;
  purlinSpacingMm: number;
  eavesSetOutMm: number;
  topSetOutMm: number;
  wastePct: number;
  trimStockMm: number;
  trimLapMm: number;
  battenStockMm: number;
  screwBox: number;
}

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  guided: boolean;
  sys: UnitSystem;
  pitchStyle: PitchStyle;
  currency: string;
  spelling: 'en-AU' | 'en-GB' | 'en-US';
  terms: Terms;
  standards: Standard[];
  safety: { regulator: string; text: string; src: Source };
  sheets: SheetProfile[];
  tiles: TileProduct[];
  shingles: ShingleProduct[];
  caps: CapProduct[];
  gutters: GutterProduct[];
  downpipes: DownpipeProduct[];
  drainage: Drainage;
  battenStockMm: number[];
  trimStockMm: number[];
  defaults: Defaults;
  fixingsNote: { text: string; src: Source } | null;
  notes: string[];
  /** Shown in Settings › Sources: what could not be verified and fell back to generic values. */
  gaps: string[];
}
