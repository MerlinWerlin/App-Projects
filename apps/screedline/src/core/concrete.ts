/**
 * Concrete volumes and ordering. Inputs are metric (m, m³); see units.ts.
 *
 * Sources
 * - Volumes are plain solid geometry: prism L×W×D, cylinder πr²h, triangle ½bh.
 * - Steps: solid steps on the ground modelled as stacked blocks, step k (k = 1…n from the bottom) is one going
 *   deep and k risers high, so V = W × R × G × n(n+1)/2 (sum of k = n(n+1)/2). Same model as common
 *   published step calculators (e.g. calculator.net concrete calculator, "stairs"). No top landing: add it as a slab.
 * - Waste allowance: Cement Concrete & Aggregates Australia (CCAA) and suppliers advise ordering a margin for
 *   spillage, uneven sub-base and form deflection, typically 5–10 %. Default 5 %, editable.
 * - Bag yield: Australian 20 kg concrete mix bags state 108 bags per m³ (MaxPRO 20 kg Concrete Mix, Bunnings
 *   listing; Cement Australia quotes 110), i.e. 1 ÷ (108 × 20) = 0.000463 m³ per kg of dry mix. Quikrete's US
 *   figure (0.60 ft³ per 80 lb = 0.000468 m³/kg, Concrete Mix 1101 data sheet) agrees within 1 %. The bag label
 *   wins: the yield per bag is editable.
 * - Site mix: nominal volume-batched mixes (1:2:3, 1:2:4, 1:3:6). Dry-volume factor 1.54 (wet volume × 1.54 =
 *   dry loose materials) is an estimating rule of thumb, not a standard value. Cement loose bulk density
 *   1440 kg/m³ (Engineering ToolBox gives 1362–1522 for Portland cement). Nominal mixes are for
 *   non-structural work only.
 * - Agitator trucks: Australian rigid agitators carry up to about 6–7 m³ (often less on soft or steep sites);
 *   plants commonly sell in 0.2 m³ steps. Both are editable because they vary by plant and truck.
 */
import { type Calc, type Step, check, fail, hasErrors, ok, type Errors } from './calc.ts';
import { ceilCount, ceilTo, fmt } from './units.ts';

export const DEFAULT_WASTE_PCT = 5;
const m = (n: number) => `${fmt(n, 3)} m`;
const m2 = (n: number) => `${fmt(n, 3)} m²`;
const m3 = (n: number) => `${fmt(n, 3)} m³`;

export interface VolumeResult {
  /** Net volume of the shape(s), m³. */
  net: number;
  /** Volume including the waste allowance, m³. */
  total: number;
  wastePct: number;
  /** Plan area where it makes sense (slabs, custom shapes), m². */
  area?: number;
}

function addWaste(errors: Errors, net: number, wastePct: number | null | undefined, steps: Step[]): VolumeResult | null {
  const w = check(errors, 'waste', wastePct, { min: 0, exclusive: false, max: 100, label: 'Waste' });
  if (hasErrors(errors)) return null;
  const total = net * (1 + w / 100);
  steps.push({ label: `Add ${fmt(w, 0)} % waste`, working: `${m3(net)} × ${fmt(1 + w / 100, 2)}`, result: m3(total) });
  return { net, total, wastePct: w };
}

export interface SlabInput {
  length: number | null; width: number | null; depth: number | null; wastePct: number | null;
  /** Optional thickened edge (edge beam): its width and its total depth from the top of the slab. */
  edgeWidth?: number | null; edgeDepth?: number | null;
}

export function slab(i: SlabInput): Calc<VolumeResult> {
  const e: Errors = {};
  const L = check(e, 'length', i.length, { label: 'Length', max: 1000 });
  const W = check(e, 'width', i.width, { label: 'Width', max: 1000 });
  const D = check(e, 'depth', i.depth, { label: 'Depth', max: 5 });
  const useEdge = (i.edgeWidth ?? 0) > 0 || (i.edgeDepth ?? 0) > 0;
  let bw = 0, bd = 0;
  if (useEdge) {
    bw = check(e, 'edgeWidth', i.edgeWidth, { label: 'Edge beam width' });
    bd = check(e, 'edgeDepth', i.edgeDepth, { label: 'Edge beam depth', max: 5 });
    if (!hasErrors(e)) {
      if (bd <= D) e.edgeDepth = 'Edge beam depth is measured from the top of the slab, so it must be deeper than the slab.';
      if (2 * bw >= Math.min(L, W)) e.edgeWidth = 'Edge beams on both sides would meet. Make them narrower than half the slab width.';
    }
  }
  if (hasErrors(e)) return fail(e);
  const area = L * W;
  const steps: Step[] = [
    { label: 'Plan area', working: `${m(L)} × ${m(W)}`, result: m2(area) },
    { label: 'Slab volume', working: `${m2(area)} × ${m(D)}`, result: m3(area * D) },
  ];
  let net = area * D;
  if (useEdge) {
    // Ring of edge beam inside the slab footprint: L·W − (L − 2bw)(W − 2bw) = 2bw(L + W) − 4bw².
    const ring = L * W - (L - 2 * bw) * (W - 2 * bw);
    const extra = ring * (bd - D);
    steps.push({ label: 'Edge beam plan area', working: `${m(L)} × ${m(W)} − ${m(L - 2 * bw)} × ${m(W - 2 * bw)}`, result: m2(ring) });
    steps.push({ label: 'Edge beam extra depth', working: `${m2(ring)} × (${m(bd)} − ${m(D)})`, result: m3(extra) });
    net += extra;
    steps.push({ label: 'Net volume', working: `${m3(area * D)} + ${m3(extra)}`, result: m3(net) });
  }
  const r = addWaste(e, net, i.wastePct, steps);
  if (!r) return fail(e);
  return ok({ ...r, area }, steps);
}

export interface BoxInput { count: number | null; length: number | null; width: number | null; depth: number | null; wastePct: number | null }

/** Strip footings (count 1, long length) and square/rectangular pad footings (count n). */
export function footing(i: BoxInput): Calc<VolumeResult> {
  const e: Errors = {};
  const n = check(e, 'count', i.count, { label: 'Number', int: true, max: 10000 });
  const L = check(e, 'length', i.length, { label: 'Length', max: 10000 });
  const W = check(e, 'width', i.width, { label: 'Width', max: 100 });
  const D = check(e, 'depth', i.depth, { label: 'Depth', max: 20 });
  if (hasErrors(e)) return fail(e);
  const one = L * W * D;
  const net = one * n;
  const steps: Step[] = [{ label: 'One footing', working: `${m(L)} × ${m(W)} × ${m(D)}`, result: m3(one) }];
  if (n !== 1) steps.push({ label: `${n} footings`, working: `${m3(one)} × ${n}`, result: m3(net) });
  const r = addWaste(e, net, i.wastePct, steps);
  return r ? ok(r, steps) : fail(e);
}

export interface PierInput { count: number | null; diameter: number | null; depth: number | null; wastePct: number | null }

/** Round piers, bored piers and round columns: V = π (d/2)² h. */
export function pier(i: PierInput): Calc<VolumeResult> {
  const e: Errors = {};
  const n = check(e, 'count', i.count, { label: 'Number', int: true, max: 10000 });
  const d = check(e, 'diameter', i.diameter, { label: 'Diameter', max: 10 });
  const h = check(e, 'depth', i.depth, { label: 'Depth', max: 100 });
  if (hasErrors(e)) return fail(e);
  const area = Math.PI * (d / 2) ** 2;
  const one = area * h;
  const net = one * n;
  const steps: Step[] = [
    { label: 'Circle area', working: `π × (${m(d)} ÷ 2)²`, result: m2(area) },
    { label: 'One pier', working: `${m2(area)} × ${m(h)}`, result: m3(one) },
  ];
  if (n !== 1) steps.push({ label: `${n} piers`, working: `${m3(one)} × ${n}`, result: m3(net) });
  const r = addWaste(e, net, i.wastePct, steps);
  return r ? ok(r, steps) : fail(e);
}

export interface StepsInput { steps: number | null; rise: number | null; going: number | null; width: number | null; wastePct: number | null }

export function stairs(i: StepsInput): Calc<VolumeResult> {
  const e: Errors = {};
  const n = check(e, 'steps', i.steps, { label: 'Number of steps', int: true, max: 100 });
  const R = check(e, 'rise', i.rise, { label: 'Rise', max: 1 });
  const G = check(e, 'going', i.going, { label: 'Going', max: 3 });
  const W = check(e, 'width', i.width, { label: 'Width', max: 50 });
  if (hasErrors(e)) return fail(e);
  const tri = (n * (n + 1)) / 2;
  const net = W * R * G * tri;
  const steps: Step[] = [
    { label: 'Riser-heights stacked', working: `${n} × (${n} + 1) ÷ 2`, result: fmt(tri, 0) },
    { label: 'Solid steps', working: `${m(W)} × ${m(R)} × ${m(G)} × ${fmt(tri, 0)}`, result: m3(net) },
  ];
  const notes: string[] = [];
  // Comfortable domestic stairs: 2R + G between 550 and 700 mm (NCC 2022 Vol. 2 / Housing Provisions 11.2.2).
  const rule = 2 * R + G;
  if (rule < 0.55 || rule > 0.7) notes.push(`2 × rise + going is ${fmt(rule * 1000, 0)} mm. The NCC asks for 550–700 mm on stairs to buildings.`);
  const r = addWaste(e, net, i.wastePct, steps);
  return r ? ok(r, steps, notes) : fail(e);
}

export type ShapeKind = 'rect' | 'tri' | 'circle';
export interface Shape { kind: ShapeKind; a: number | null; b?: number | null; subtract?: boolean }

export function shapeArea(s: Shape): number {
  const a = s.a ?? NaN;
  const b = s.b ?? NaN;
  if (s.kind === 'rect') return a * b;
  if (s.kind === 'tri') return 0.5 * a * b;
  return Math.PI * (a / 2) ** 2;
}

/** Irregular areas built from rectangles, triangles (base × height) and circles, with cut-outs. */
export function composite(shapes: Shape[], depth: number | null, wastePct: number | null): Calc<VolumeResult> {
  const e: Errors = {};
  if (!shapes.length) e.shapes = 'Add at least one shape.';
  shapes.forEach((s, k) => {
    check(e, `s${k}a`, s.a, { label: s.kind === 'circle' ? 'Diameter' : s.kind === 'tri' ? 'Base' : 'Length', max: 1000 });
    if (s.kind !== 'circle') check(e, `s${k}b`, s.b, { label: s.kind === 'tri' ? 'Height' : 'Width', max: 1000 });
  });
  const D = check(e, 'depth', depth, { label: 'Depth', max: 5 });
  if (hasErrors(e)) return fail(e);
  const steps: Step[] = [];
  let area = 0;
  shapes.forEach((s, k) => {
    const A = shapeArea(s);
    const sign = s.subtract ? -1 : 1;
    area += sign * A;
    const working = s.kind === 'rect' ? `${m(s.a!)} × ${m(s.b!)}` : s.kind === 'tri' ? `½ × ${m(s.a!)} × ${m(s.b!)}` : `π × (${m(s.a!)} ÷ 2)²`;
    const name = s.kind === 'rect' ? 'Rectangle' : s.kind === 'tri' ? 'Triangle' : 'Circle';
    steps.push({ label: `${s.subtract ? 'Minus ' : ''}${name} ${k + 1}`, working, result: `${s.subtract ? '−' : ''}${m2(A)}` });
  });
  if (area <= 1e-9) return fail({ shapes: 'The cut-outs are as big as the shapes. The area must be more than 0.' });
  steps.push({ label: 'Total area', working: 'sum of the shapes', result: m2(area) });
  const net = area * D;
  steps.push({ label: 'Volume', working: `${m2(area)} × ${m(D)}`, result: m3(net) });
  const r = addWaste(e, net, wastePct, steps);
  return r ? ok({ ...r, area }, steps) : fail(e);
}

export interface TruckInput { volume: number | null; increment: number | null; truckCapacity: number | null }
export interface TruckResult { order: number; loads: number; loadSizes: number[]; extra: number }

/** Ready-mix order: round up to the plant's ordering step, then split into truck loads. */
export function truckOrder(i: TruckInput): Calc<TruckResult> {
  const e: Errors = {};
  const v = check(e, 'volume', i.volume, { label: 'Volume', max: 10000 });
  const step = check(e, 'increment', i.increment, { label: 'Order step', max: 5 });
  const cap = check(e, 'truckCapacity', i.truckCapacity, { label: 'Truck size', max: 20 });
  if (hasErrors(e)) return fail(e);
  if (cap < step) return fail({ truckCapacity: 'Truck size must be at least the order step.' });
  const order = ceilTo(v, step);
  const loads = ceilCount(order / cap);
  // Even loads, each a multiple of the order step (plants batch whole steps), largest first.
  const unitsTotal = Math.round(order / step);
  const base = Math.floor(unitsTotal / loads);
  const rem = unitsTotal - base * loads;
  const loadSizes = Array.from({ length: loads }, (_, k) => Number(((base + (k < rem ? 1 : 0)) * step).toFixed(6)));
  const steps: Step[] = [
    { label: `Round up to ${fmt(step, 1)} m³ steps`, working: `${m3(v)} → next ${fmt(step, 1)} m³`, result: `${fmt(order, 1)} m³` },
    { label: 'Truck loads', working: `${fmt(order, 1)} m³ ÷ ${fmt(cap, 1)} m³ per truck, rounded up`, result: `${loads}` },
  ];
  const notes: string[] = [];
  if (order < 3) notes.push('Small loads often carry a short-load fee. Ask the plant.');
  notes.push('Ready-mix should be discharged within 90 minutes of batching (AS 1379). Check the docket time.');
  return ok({ order, loads, loadSizes, extra: order - v }, steps, notes);
}

/** m³ of mixed concrete per kg of dry bagged mix (108 × 20 kg bags per m³, Australian bag labels). */
export const BAG_YIELD_M3_PER_KG = 1 / (108 * 20);

export interface BagsInput { volume: number | null; bagKg: number | null; yieldPerBag?: number | null }
export interface BagsResult { bags: number; yieldPerBag: number; totalKg: number; bagsPerM3: number }

export function premixBags(i: BagsInput): Calc<BagsResult> {
  const e: Errors = {};
  const v = check(e, 'volume', i.volume, { label: 'Volume', max: 50 });
  const kg = check(e, 'bagKg', i.bagKg, { label: 'Bag size', max: 100 });
  const custom = i.yieldPerBag != null && Number.isFinite(i.yieldPerBag) && i.yieldPerBag > 0;
  if (i.yieldPerBag != null && !custom && i.yieldPerBag !== 0) e.yieldPerBag = 'Yield must be more than 0.';
  if (hasErrors(e)) return fail(e);
  const y = custom ? i.yieldPerBag! : kg * BAG_YIELD_M3_PER_KG;
  const bags = ceilCount(v / y);
  const steps: Step[] = [
    custom
      ? { label: 'Yield per bag (from the bag)', working: 'as entered', result: `${fmt(y, 4)} m³` }
      : { label: 'Yield per bag', working: `${fmt(kg, 0)} kg × 0.000463 m³/kg (108 × 20 kg bags per m³)`, result: `${fmt(y, 4)} m³` },
    { label: 'Bags', working: `${m3(v)} ÷ ${fmt(y, 4)} m³, rounded up`, result: `${bags}` },
  ];
  const notes = ['Bag yields vary by brand. Check the yield printed on the bag.'];
  if (v > 1) notes.push('Over about 1 m³, a ready-mix truck is usually cheaper and gives a more even pour.');
  return ok({ bags, yieldPerBag: y, totalKg: bags * kg, bagsPerM3: 1 / y }, steps, notes);
}

export type MixRatio = '1:2:3' | '1:2:4' | '1:3:6';
export const MIX_PARTS: Record<MixRatio, [number, number, number]> = { '1:2:3': [1, 2, 3], '1:2:4': [1, 2, 4], '1:3:6': [1, 3, 6] };
export const DRY_VOLUME_FACTOR = 1.54;
export const CEMENT_BULK_DENSITY = 1440; // kg/m³

export interface SiteMixInput { volume: number | null; ratio: MixRatio; cementBagKg: number | null }
export interface SiteMixResult { cementKg: number; cementBags: number; sandM3: number; aggregateM3: number; dryVolume: number }

export function siteMix(i: SiteMixInput): Calc<SiteMixResult> {
  const e: Errors = {};
  const v = check(e, 'volume', i.volume, { label: 'Volume', max: 50 });
  const bag = check(e, 'cementBagKg', i.cementBagKg, { label: 'Cement bag size', max: 100 });
  const parts = MIX_PARTS[i.ratio];
  if (!parts) e.ratio = 'Pick a mix.';
  if (hasErrors(e)) return fail(e);
  const [c, s, a] = parts;
  const sum = c + s + a;
  const dry = v * DRY_VOLUME_FACTOR;
  const cementM3 = (dry * c) / sum;
  const cementKg = cementM3 * CEMENT_BULK_DENSITY;
  const cementBags = ceilCount(cementKg / bag);
  const sandM3 = (dry * s) / sum;
  const aggregateM3 = (dry * a) / sum;
  const steps: Step[] = [
    { label: 'Dry materials', working: `${m3(v)} × ${DRY_VOLUME_FACTOR}`, result: m3(dry) },
    { label: 'Cement', working: `${m3(dry)} × ${c}/${sum} × 1440 kg/m³`, result: `${fmt(cementKg, 0)} kg` },
    { label: 'Cement bags', working: `${fmt(cementKg, 0)} kg ÷ ${fmt(bag, 0)} kg, rounded up`, result: `${cementBags}` },
    { label: 'Sand', working: `${m3(dry)} × ${s}/${sum}`, result: m3(sandM3) },
    { label: 'Aggregate', working: `${m3(dry)} × ${a}/${sum}`, result: m3(aggregateM3) },
  ];
  return ok({ cementKg, cementBags, sandM3, aggregateM3, dryVolume: dry }, steps, [
    'Nominal site mixes are for paths, post holes and other non-structural work. Structural concrete is ordered by strength class (e.g. N25) from a plant.',
  ]);
}
