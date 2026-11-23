/**
 * Materials catalogue per country: the pipe and fittings commonly stocked by the major trade suppliers and hardware
 * chains there, so the pickers only offer what a plumber can actually buy. Sources are listed per country below
 * (retailer names appear here in code docs only, never in the app). Where availability could not be verified the
 * country gets the generic list and materialsVerified = false, and the app says so.
 */
import { FITTINGS, PIPES, type FittingSpec, type PipeSize } from '../calc/reference';
import type { CountryCode } from '../state/data';

type Materials = { pipes: PipeSize[]; fittings: FittingSpec[]; materialsNote: string; materialsVerified: boolean };

const pick = (ids: string[]) => ids.map(id => {
  const p = PIPES.find(x => x.id === id);
  if (!p) throw new Error(`catalog: unknown pipe ${id}`);
  return p;
});
const fit = (prefix: string[]) => FITTINGS.filter(f => prefix.some(p => f.id.startsWith(p)));

/**
 * Australia. Copper Type B DN15/18/20/25 (also 32–100 by trade order) and Type A, sold in 6 m lengths; PVC-U DWV
 * DN40–150 in 6 m; PE-X 16/20/25/32 SDR 9 in coils and 6 m; galvanised medium steel by trade order.
 * Sources: MM Kembla AS 1432 brochure (D54/18) sizes; Reece Auspex manual (PE-X); Iplex/Vinidex DWV ranges; trade
 * supplier and hardware chain product listings (Reece, Tradelink, Bunnings) checked 23 Nov 2026.
 */
const AU: Materials = {
  pipes: pick([
    'cuB-15', 'cuB-18', 'cuB-20', 'cuB-25', 'cuB-32', 'cuB-40', 'cuB-50', 'cuB-65', 'cuB-80', 'cuB-100',
    'cuA-15', 'cuA-18', 'cuA-20', 'cuA-25',
    'pvc-40', 'pvc-50', 'pvc-65', 'pvc-80', 'pvc-100', 'pvc-150',
    'pex-16', 'pex-20', 'pex-25', 'pex-32',
    'st-15', 'st-20', 'st-25', 'st-32', 'st-40', 'st-50',
  ]),
  fittings: fit(['pvc-', 'cu-', 'mi-']),
  materialsNote: 'Sizes stocked by Australian plumbing suppliers. Fitting dimensions are typical: check your brand.',
  materialsVerified: true,
};

/** Generic: every pipe and fitting in the reference tables, flagged as not country-checked. */
const OTHER: Materials = {
  pipes: PIPES,
  fittings: FITTINGS,
  materialsNote: 'Generic sizes: not checked against what’s sold where you are. Add your own fittings if yours differ.',
  materialsVerified: false,
};

export const CATALOG: Record<CountryCode, Materials> = {
  AU, NZ: OTHER, GB: OTHER, IE: OTHER, US: OTHER, CA: OTHER, OTHER,
};
