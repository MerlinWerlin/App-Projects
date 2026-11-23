// Full system check: both sides of the manifold at once. Superheat and subcooling are each compared with a target
// band, and the pair is read against the standard superheat / subcooling fault pattern taught for TXV / EEV systems
// (the "nine-box" chart in trade training). The result is "likely causes to check", never a verdict: airflow, load,
// non-condensables and the manufacturer's own charging chart can all change the picture.
import { subcooling, superheat, type Prefs, type Step } from './charge.ts';

export type Band = 'low' | 'ok' | 'high';
export type Pattern = { id: string; title: string; causes: string[]; tone: 'ok' | 'warn' };

export type CheckInput = {
  refrigerant: string;
  suctionReading: number;
  suctionLineTemp: number;
  liquidReading: number;
  liquidLineTemp: number;
  /** Target superheat at the measuring point (K). TXV systems: often 5–8 K at the evaporator outlet. */
  targetShK: number;
  /** Target subcooling (K), from the data plate. */
  targetScK: number;
  /** ± band around each target counted as "on target" (K). */
  bandK?: number;
};

export type CheckResult =
  | {
      ok: true;
      shK: number;
      scK: number;
      evapC: number;
      condC: number;
      shBand: Band;
      scBand: Band;
      pattern: Pattern;
      steps: Step[];
      notes: string[];
    }
  | { ok: false; error: string };

export function band(value: number, target: number, width: number): Band {
  if (value < target - width) return 'low';
  if (value > target + width) return 'high';
  return 'ok';
}

const P = (id: string, title: string, causes: string[], tone: 'ok' | 'warn' = 'warn'): Pattern => ({ id, title, causes, tone });

/** The nine-box pattern: [superheat band][subcooling band]. */
export const PATTERNS: Record<Band, Record<Band, Pattern>> = {
  low: {
    low: P('overfeed', 'Evaporator overfed', ['Metering device overfeeding (TXV bulb loose or uninsulated, EEV fault)', 'Low indoor airflow or a frozen coil', 'Compressor not pumping (worn valves): check amps and pressures']),
    ok: P('low-airflow', 'Low load on the evaporator', ['Low indoor airflow: filter, dirty coil, fan speed', 'TXV bulb position or contact', 'Low return air temperature']),
    high: P('overcharge', 'Likely overcharge', ['Too much refrigerant: weigh out to the nameplate charge', 'Check the condenser is clean and its fan runs']),
  },
  ok: {
    low: P('slight-under', 'Slightly low charge', ['Small undercharge or a slow leak: leak test before adding', 'Flash gas in the liquid line']),
    ok: P('normal', 'Charge looks right', ['Superheat and subcooling are both on target', 'Still confirm airflow and temperature split across the coil'], 'ok'),
    high: P('high-head', 'High subcooling', ['Slight overcharge', 'Non-condensables in the system', 'Dirty condenser or condenser fan fault']),
  },
  high: {
    low: P('undercharge', 'Likely undercharge', ['Low refrigerant charge: find and fix the leak, then weigh in', 'Do not top up a zeotropic blend after a big leak: recover and recharge']),
    ok: P('starved', 'Evaporator starved', ['Partial restriction at the metering device or filter-drier', 'TXV underfeeding (bulb, superheat setting)', 'High load: check return air temperature']),
    high: P('restriction', 'Likely liquid line restriction', ['Blocked filter-drier, kinked or crushed liquid line', 'Metering device restricted or stuck closed', 'Feel for a temperature drop across the drier or the restriction']),
  },
};

export function systemCheck(i: CheckInput, p: Prefs): CheckResult {
  const width = i.bandK ?? 2;
  const sh = superheat(i.refrigerant, i.suctionReading, i.suctionLineTemp, p);
  if (!sh.ok) return { ok: false, error: `Low side: ${sh.error}` };
  const sc = subcooling(i.refrigerant, i.liquidReading, i.liquidLineTemp, p);
  if (!sc.ok) return { ok: false, error: `High side: ${sc.error}` };
  if (!Number.isFinite(i.targetShK) || !Number.isFinite(i.targetScK)) return { ok: false, error: 'Enter the target superheat and subcooling.' };
  const notes: string[] = [];
  if (sc.satC <= sh.satC) return { ok: false, error: 'The high side reads below the low side. Check the hoses aren’t swapped and the readings are gauge on both sides.' };
  if (sh.note) notes.push(sh.note);
  if (sc.note) notes.push(sc.note);
  const shBand = band(sh.valueK, i.targetShK, width);
  const scBand = band(sc.valueK, i.targetScK, width);
  return {
    ok: true,
    shK: sh.valueK,
    scK: sc.valueK,
    evapC: sh.satC,
    condC: sc.satC,
    shBand,
    scBand,
    pattern: PATTERNS[shBand][scBand],
    steps: [...sh.steps, ...sc.steps],
    notes,
  };
}
