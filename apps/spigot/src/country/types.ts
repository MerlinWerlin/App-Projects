import type { UnitSystem } from '../calc/units';
import type { CountryCode } from '../state/data';
import type { FittingSpec, PipeSize } from '../calc/reference';

export type { CountryCode };

export interface GradeRule {
  /** Pipe size label as the local trade says it ("DN100", "4 in", "100 mm"). */
  size: string;
  /** Minimum grade as 1:N. */
  n: number;
  note?: string;
}

export interface VelocityRule { service: string; max: number }

export interface Terms {
  /** "Fall" (AU/NZ/UK/IE) or "Slope" (US/CA). */
  fall: string;
  /** Lower-case form for sentences. */
  fallLower: string;
  /** "centre" or "center". */
  centre: string;
  /** "Take-off" everywhere we could confirm; kept per country so it can differ. */
  takeoff: string;
}

export interface CountryProfile {
  code: CountryCode;
  name: string;
  /** BCP-47 locale for dates and numbers. */
  locale: string;
  defaultUnit: UnitSystem;
  currency: string;
  terms: Terms;
  /** The plumbing and drainage code people work to, named as locals name it. Cited in notes and limits. */
  codeName: string;
  /** Short reminder shown under results: "Check against … and the manufacturer's data". */
  checkNote: string;
  /** Minimum drain grades, or null when we could not verify them (the app then shows generic guidance). */
  minGrades: { rules: GradeRule[]; source: string } | null;
  /** `code` names the limit in warnings ("the NCC (B1P2)"); a rule whose service says cold drives the flow warning. */
  maxVelocity: { rules: VelocityRule[]; source: string; code: string } | null;
  /** Show flow in US gallons and ft/s when units are imperial (US only; Canada keeps litres, as its code does). */
  usGallons: boolean;
  /** Chip labels for the Fall tool when the trade speaks in inches per foot (US). */
  gradeLabel?: (n: number) => string;
  /** Grade chips offered in the Fall tool (1:N). */
  commonGrades: number[];
  /** Usual stock length for cut lists, mm. */
  stockLengthMm: number;
  /** Pipes a local trade supplier or hardware chain actually stocks (ids in the catalogue); empty = generic list. */
  pipes: PipeSize[];
  fittings: FittingSpec[];
  /** Where the materials list came from, for docs and the in-app note (no retailer names in the UI). */
  materialsNote: string;
  materialsVerified: boolean;
}
