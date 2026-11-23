import { formatInches, formatMm } from '../core/units.ts';
import { useSettings } from '../state/settings.tsx';

/** Short lengths for marking out: to 0.1 mm in metric, inches and tape fractions (never feet) in imperial. */
export function useFine() {
  const { settings } = useSettings();
  return (mm: number) => (settings.units === 'metric' ? formatMm(mm, 1) : formatInches(mm, settings.denom));
}
