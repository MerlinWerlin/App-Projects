// Room heating and cooling load: a ROUGH sizing estimate for a quote or a sanity check, never a substitute for a
// proper heat-load calculation (e.g. AIRAH DA09 / CIBSE / ACCA Manual J). Volume method with simple modifiers,
// shown step by step so the tech can see and question every factor.

export type Insulation = 'good' | 'average' | 'poor';
export type Sun = 'shaded' | 'some' | 'full';
export type Climate = 'mild' | 'warm' | 'hot' | 'cool' | 'cold';

export type LoadInput = {
  areaM2: number;
  heightM: number;
  insulation: Insulation;
  sun: Sun;
  /** Outdoor design climate for cooling (mild/warm/hot) and heating (mild/cool/cold). */
  coolClimate: 'mild' | 'warm' | 'hot';
  heatClimate: 'mild' | 'cool' | 'cold';
  people: number;
  /** Extra internal gains, W (kitchen appliances, computers, lighting beyond normal). */
  extraW: number;
  /** Large west- or north-facing glass (south in the northern hemisphere). */
  bigGlass: boolean;
  topFloorOrUnderRoof: boolean;
};

export type LoadStep = { label: string; value: string };
export type LoadResult = { coolW: number; heatW: number; coolSteps: LoadStep[]; heatSteps: LoadStep[] } | { error: string };

// W per m³ of room volume before modifiers.
const COOL_W_M3: Record<LoadInput['coolClimate'], number> = { mild: 35, warm: 42, hot: 50 };
const HEAT_W_M3: Record<LoadInput['heatClimate'], number> = { mild: 30, cool: 40, cold: 52 };
const INSUL: Record<Insulation, number> = { good: 0.85, average: 1, poor: 1.25 };
const SUN: Record<Sun, number> = { shaded: 0.9, some: 1, full: 1.15 };
const PERSON_W = 120; // sensible + latent, seated / light activity

export function estimateLoad(i: LoadInput): LoadResult {
  if (!(i.areaM2 > 0) || !(i.heightM > 0)) return { error: 'Enter the floor area and the ceiling height.' };
  if (i.areaM2 > 2000 || i.heightM > 12) return { error: 'That is beyond a room estimate. Use a full heat-load calculation.' };
  const vol = i.areaM2 * i.heightM;
  const people = Math.max(0, Math.round(i.people || 0));
  const extra = Math.max(0, i.extraW || 0);
  const roof = i.topFloorOrUnderRoof ? 1.1 : 1;
  const glass = i.bigGlass ? 1.15 : 1;

  const base = vol * COOL_W_M3[i.coolClimate];
  const env = base * INSUL[i.insulation] * SUN[i.sun] * roof * glass;
  const peopleW = Math.max(0, people - 2) * PERSON_W; // the volume factor already covers two people
  const coolW = env + peopleW + extra;
  const coolSteps: LoadStep[] = [
    { label: `Volume ${fmt1(i.areaM2)} m² × ${fmt1(i.heightM)} m`, value: `${fmt1(vol)} m³` },
    { label: `× ${COOL_W_M3[i.coolClimate]} W/m³ (${i.coolClimate} summer)`, value: w(base) },
    { label: `× insulation ${INSUL[i.insulation]} × sun ${SUN[i.sun]}${roof > 1 ? ' × roof 1.1' : ''}${glass > 1 ? ' × glass 1.15' : ''}`, value: w(env) },
    ...(peopleW ? [{ label: `+ ${people - 2} extra people × ${PERSON_W} W`, value: w(peopleW) }] : []),
    ...(extra ? [{ label: '+ appliances / equipment', value: w(extra) }] : []),
    { label: 'Cooling estimate', value: w(coolW) },
  ];

  const hBase = vol * HEAT_W_M3[i.heatClimate];
  const heatW = hBase * INSUL[i.insulation] * roof * glass;
  const heatSteps: LoadStep[] = [
    { label: `Volume ${fmt1(vol)} m³ × ${HEAT_W_M3[i.heatClimate]} W/m³ (${i.heatClimate} winter)`, value: w(hBase) },
    { label: `× insulation ${INSUL[i.insulation]}${roof > 1 ? ' × roof 1.1' : ''}${glass > 1 ? ' × glass 1.15' : ''}`, value: w(heatW) },
    { label: 'Heating estimate (no credit for internal gains)', value: w(heatW) },
  ];
  return { coolW, heatW, coolSteps, heatSteps };
}

/** Common nominal split-system sizes (kW cooling); the next size up from a load. */
export const NOMINAL_KW = [2.0, 2.5, 3.5, 5.0, 6.0, 7.1, 8.0, 9.5, 10.0, 12.5, 14.0, 16.0];
export function nextSizeKw(w: number): number | null {
  const kw = w / 1000;
  return NOMINAL_KW.find((s) => s >= kw - 0.05) ?? null;
}

/** Common US / Canadian nominal sizes, BTU/h; the next size up from a load in watts. */
export const NOMINAL_BTU = [9000, 12000, 18000, 24000, 30000, 36000, 42000, 48000, 60000];
export function nextSizeBtu(w: number): number | null {
  const btu = w / 0.29307107017;
  return NOMINAL_BTU.find((s) => s >= btu - 100) ?? null;
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString();
const w = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} kW` : `${Math.round(n)} W`);
