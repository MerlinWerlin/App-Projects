/** What every calculation needs to word and format its working: units, pitch style and local trade words. */
import { feetInches, formatArea, formatLength, formatPitch, formatRun, num, type PitchStyle, type UnitSystem } from './units';

export interface Terms {
  gutter: string; // gutter / spouting / eavestrough
  gutters: string;
  downpipe: string; // downpipe / downspout
  downpipes: string;
  barge: string; // barge / verge / rake
  ridge: string; // ridge capping / ridge / ridge cap
  valley: string;
  batten: string;
  battens: string;
  purlin: string;
  purlins: string;
  underlay: string; // sarking / underlay / underlayment / building wrap
}

export const DEFAULT_TERMS: Terms = {
  gutter: 'gutter', gutters: 'gutters', downpipe: 'downpipe', downpipes: 'downpipes', barge: 'barge', ridge: 'ridge',
  valley: 'valley', batten: 'batten', battens: 'battens', purlin: 'purlin', purlins: 'purlins', underlay: 'underlay',
};

export interface Ctx {
  sys: UnitSystem;
  pitchStyle: PitchStyle;
  terms: Terms;
  len(mm: number): string;
  /** Building dimensions: metres (to the mm) or feet and inches. */
  dim(mm: number): string;
  run(mm: number): string;
  area(m2: number): string;
  pitch(deg: number): string;
}

export function makeCtx(sys: UnitSystem, pitchStyle: PitchStyle, terms: Terms = DEFAULT_TERMS): Ctx {
  return {
    sys, pitchStyle, terms,
    len: mm => formatLength(mm, sys),
    dim: mm => (sys === 'imperial' ? feetInches(mm) : `${num(mm / 1000, 3)} m`),
    run: mm => formatRun(mm, sys),
    area: m2 => formatArea(m2, sys),
    pitch: deg => formatPitch(deg, pitchStyle),
  };
}

/** One line of shown working: what it is, how it's worked out, and the answer. */
export interface Step { label: string; formula?: string; value: string }

export type Result<T> =
  | { ok: true; value: T; steps: Step[]; notes: string[] }
  | { ok: false; error: string };

export const fail = <T>(error: string): Result<T> => ({ ok: false, error });

export const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
