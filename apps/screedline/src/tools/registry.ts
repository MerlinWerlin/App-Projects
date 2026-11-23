/**
 * Every calculator as data: its inputs (canonical metric defaults), which group it sits in, whether it is free,
 * and how its result is presented. The catalogues in pickers (bags, mesh, bars, pavers, blocks, bulk materials),
 * default values, standards named in notes and local terms come from the user's country (core/country.ts).
 * Screens render this; src/tools/registry.test.ts runs every tool's defaults for every country.
 * No React Native imports here.
 */
import type { Errors, Step } from '../core/calc.ts';
import { composite, footing, pier, premixBags, siteMix, slab, stairs, truckOrder, type MixRatio, type Shape } from '../core/concrete.ts';
import { COUNTRIES, type Catalogue, type CountryCode, type CountryProfile, profile } from '../core/country.ts';
import { falls, type FallMode } from '../core/falls.ts';
import { formwork } from '../core/formwork.ts';
import { bulk, convert, pavers } from '../core/landscape.ts';
import { bars, mesh, trenchMesh } from '../core/reo.ts';
import { retainingWall } from '../core/retaining.ts';
import type { FieldKind } from '../core/units.ts';
import { pourWeather } from '../core/weather.ts';

export type Value = number | string | null | Shape[] | (number | null)[];
export type Values = Record<string, Value>;

export interface NumField { type: 'num'; key: string; label: string; kind: FieldKind; def: number | null; help?: string; optional?: boolean; when?: (v: Values) => boolean }
export interface ChoiceField { type: 'choice'; key: string; label: string; options: { value: string; label: string }[]; def: string; help?: string; apply?: (value: string) => Values; when?: (v: Values) => boolean }
export interface ShapesField { type: 'shapes'; key: string; label: string; def: Shape[] }
export interface ListField { type: 'list'; key: string; label: string; kind: 'len'; def: number[]; help?: string; when?: (v: Values) => boolean }
export type Field = NumField | ChoiceField | ShapesField | ListField;

export type OutKind = 'vol' | 'svol' | 'len' | 'area' | 'kg' | 't' | 'count' | 'pct' | 'mm' | 'ratio' | 'kgph' | 'grade';
export interface Out { label: string; value: number; kind: OutKind; dp?: number }
export interface Headline extends Out { caption: string }
export type Run =
  | { ok: false; errors: Errors }
  | { ok: true; headline: Headline; outputs: Out[]; steps: Step[]; notes: string[]; table?: { title: string; head: [string, string]; rows: [Out, Out][] }; next?: { tool: string; label: string; values: Values }; tone?: 'good' | 'warn' | 'bad' };

export type Group = 'concrete' | 'steel' | 'ground' | 'pour';
export const GROUPS: { id: Group; title: string }[] = [
  { id: 'concrete', title: 'Concrete' },
  { id: 'steel', title: 'Steel & forms' },
  { id: 'ground', title: 'Ground & landscape' },
  { id: 'pour', title: 'Pour day' },
];

export interface Tool {
  id: string; group: Group; title: string; blurb: string;
  /** Icon name (Material Community name, mapped to an SF Symbol in src/ui/sf.ts). */
  icon: string;
  free: boolean;
  fields: Field[];
  run?: (v: Values) => Run;
  /** Tools with their own screen (the checklist). */
  screen?: string;
}

const n = (v: Values, k: string): number | null => {
  const x = v[k];
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
};
const s = (v: Values, k: string): string => (typeof v[k] === 'string' ? (v[k] as string) : '');
const opt = <T extends { id: string; label?: string; name?: string }>(list: T[]) => list.map(x => ({ value: x.id, label: x.label ?? x.name ?? x.id }));
const pick = <T extends { id: string }>(list: T[], id: string): T | undefined => list.find(x => x.id === id);

function volumeRun(c: ReturnType<typeof slab>): Run {
  if (!c.ok) return c;
  const r = c.value;
  return {
    ok: true,
    headline: { label: 'Concrete to order', value: r.total, kind: 'vol', dp: 2, caption: `includes ${r.wastePct} % waste` },
    outputs: [{ label: 'Net volume', value: r.net, kind: 'vol', dp: 3 }, ...(r.area !== undefined ? [{ label: 'Area', value: r.area, kind: 'area' as const, dp: 2 }] : [])],
    steps: c.steps, notes: c.notes,
    next: { tool: 'order', label: 'Order this concrete', values: { volume: r.total } },
  };
}

/** [[size, count], …] largest first, e.g. [3.8, 3.6, 3.6] → [[3.8, 1], [3.6, 2]]. */
export function groupLoads(sizes: number[]): [number, number][] {
  const m = new Map<number, number>();
  for (const s of sizes) m.set(s, (m.get(s) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[0] - a[0]);
}

export function toolsFor(c: CountryProfile): Tool[] {
  const waste: NumField = { type: 'num', key: 'waste', label: 'Waste allowance', kind: 'pct', def: 5, help: 'Spillage, uneven ground and form bulge. 5–10 % is usual.' };
  const meshDef = c.mesh[0]!;
  const barDef = c.bars.find(b => Math.abs(b.d - 12) < 1.5) ?? c.bars[0]!;
  const blockDef = c.blocks.find(b => b.id === 'std') ?? c.blocks[0]!;
  const tm = c.trenchMesh ?? { label: 'Trench mesh', width: 0.3, length: 6, lap: 0.5 };
  const structural = `Check ${c.standards.structural === COUNTRIES.XX.standards.structural ? 'your engineer’s drawings' : `your engineer’s drawings and ${c.standards.structural}`}.`;
  const gnote = (cat: Catalogue) => (c.generic.includes(cat) ? [c.code === 'XX' ? 'Sizes here are generic. Use your supplier’s sizes.' : `We couldn’t confirm local ${cat === 'blocks' ? 'block' : cat === 'materials' ? 'material' : cat === 'order' ? 'ordering' : 'product'} sizes for ${c.name}, so these are generic. Use your supplier’s figures.`] : []);

  const tools: Tool[] = [
    // ---------------- concrete ----------------
    {
      id: 'slab', group: 'concrete', title: 'Slab', blurb: 'Slabs, paths and driveways, with an edge beam if you need one', icon: 'square-outline', free: true,
      fields: [
        { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 6 },
        { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 4 },
        { type: 'num', key: 'depth', label: 'Depth', kind: 'thick', def: 0.1 },
        { type: 'choice', key: 'edge', label: 'Thickened edge', def: 'no', options: [{ value: 'no', label: 'None' }, { value: 'yes', label: 'Edge beam' }] },
        { type: 'num', key: 'edgeWidth', label: 'Edge beam width', kind: 'thick', def: 0.3, when: v => v.edge === 'yes' },
        { type: 'num', key: 'edgeDepth', label: 'Edge beam depth (from top)', kind: 'thick', def: 0.4, when: v => v.edge === 'yes' },
        waste,
      ],
      run: v => volumeRun(slab({ length: n(v, 'length'), width: n(v, 'width'), depth: n(v, 'depth'), wastePct: n(v, 'waste'), ...(v.edge === 'yes' ? { edgeWidth: n(v, 'edgeWidth'), edgeDepth: n(v, 'edgeDepth') } : {}) })),
    },
    {
      id: 'footing', group: 'concrete', title: 'Footings', blurb: 'Strip footings and square pad footings', icon: 'view-sequential-outline', free: false,
      fields: [
        { type: 'choice', key: 'shape', label: 'Type', def: 'strip', options: [{ value: 'strip', label: 'Strip' }, { value: 'pads', label: 'Pads' }] },
        { type: 'num', key: 'count', label: 'Number of pads', kind: 'count', def: 4, when: v => v.shape === 'pads' },
        { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 12 },
        { type: 'num', key: 'width', label: 'Width', kind: 'thick', def: 0.45 },
        { type: 'num', key: 'depth', label: 'Depth', kind: 'thick', def: 0.5 },
        waste,
      ],
      run: v => volumeRun(footing({ count: v.shape === 'pads' ? n(v, 'count') : 1, length: n(v, 'length'), width: n(v, 'width'), depth: n(v, 'depth'), wastePct: n(v, 'waste') })),
    },
    {
      id: 'pier', group: 'concrete', title: 'Piers & columns', blurb: 'Round bored piers, post holes and columns', icon: 'circle-outline', free: false,
      fields: [
        { type: 'num', key: 'count', label: 'How many', kind: 'count', def: 6 },
        { type: 'num', key: 'diameter', label: 'Diameter', kind: 'thick', def: 0.45 },
        { type: 'num', key: 'depth', label: 'Depth', kind: 'len', def: 1.2 },
        waste,
      ],
      run: v => volumeRun(pier({ count: n(v, 'count'), diameter: n(v, 'diameter'), depth: n(v, 'depth'), wastePct: n(v, 'waste') })),
    },
    {
      id: 'steps', group: 'concrete', title: 'Steps', blurb: 'Solid steps on the ground', icon: 'stairs', free: false,
      fields: [
        { type: 'num', key: 'steps', label: 'Number of steps', kind: 'count', def: 3 },
        { type: 'num', key: 'rise', label: 'Rise (each step)', kind: 'thick', def: 0.17, help: c.stairs ? `${c.stairs.code}: ${c.stairs.riser[0] <= 0 ? `at most ${Math.round(c.stairs.riser[1] * 1000)} mm` : `${Math.round(c.stairs.riser[0] * 1000)}–${Math.round(c.stairs.riser[1] * 1000)} mm`}.` : undefined },
        { type: 'num', key: 'going', label: 'Going (tread depth)', kind: 'thick', def: 0.28, help: c.stairs ? `${c.stairs.code}: ${c.stairs.going[1] >= 5 ? `at least ${Math.round(c.stairs.going[0] * 1000)} mm` : `${Math.round(c.stairs.going[0] * 1000)}–${Math.round(c.stairs.going[1] * 1000)} mm`}.` : undefined },
        { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 1.2 },
        waste,
      ],
      run: v => {
        const r = volumeRun(stairs({ steps: n(v, 'steps'), rise: n(v, 'rise'), going: n(v, 'going'), width: n(v, 'width'), wastePct: n(v, 'waste'), rule: c.stairs }));
        return r.ok && !c.stairs ? { ...r, notes: [...r.notes, 'Check your local building code for step rise and going.'] } : r;
      },
    },
    {
      id: 'custom', group: 'concrete', title: 'Odd shapes', blurb: 'Add up rectangles, triangles and circles, minus cut-outs', icon: 'shape-outline', free: false,
      fields: [
        { type: 'shapes', key: 'shapes', label: 'Shapes', def: [{ kind: 'rect', a: 4, b: 3 }, { kind: 'tri', a: 3, b: 2 }] },
        { type: 'num', key: 'depth', label: 'Depth', kind: 'thick', def: 0.1 },
        waste,
      ],
      run: v => volumeRun(composite(Array.isArray(v.shapes) ? (v.shapes as Shape[]) : [], n(v, 'depth'), n(v, 'waste'))),
    },
    {
      id: 'order', group: 'concrete', title: 'Truck order', blurb: 'Round up to the plant’s step and split into loads', icon: 'truck-outline', free: true,
      fields: [
        { type: 'num', key: 'volume', label: 'Concrete needed', kind: 'vol', def: 2.52, help: 'Include your waste allowance.' },
        { type: 'num', key: 'increment', label: 'Plant sells in steps of', kind: 'vol', def: c.order.increment },
        { type: 'num', key: 'truckCapacity', label: 'Biggest load per truck', kind: 'vol', def: c.order.truck, help: 'Ask the plant. Soft or steep sites may need smaller loads.' },
      ],
      run: v => {
        const r0 = truckOrder({ volume: n(v, 'volume'), increment: n(v, 'increment'), truckCapacity: n(v, 'truckCapacity') });
        if (!r0.ok) return r0;
        const r = r0.value;
        const mins = c.readyMix?.dischargeMinutes;
        return {
          ok: true,
          headline: { label: 'Order', value: r.order, kind: 'vol', dp: 2, caption: r.loads === 1 ? 'one truck' : `${r.loads.toLocaleString('en-AU')} trucks` },
          outputs: [
            { label: 'Truck loads', value: r.loads, kind: 'count' },
            // Loads differ by at most one ordering step, so they group into one or two sizes.
            ...groupLoads(r.loadSizes).map(([size, count]) => ({ label: count === 1 ? (r.loads === 1 ? 'The truck' : 'One truck of') : `${count.toLocaleString('en-AU')} trucks of`, value: size, kind: 'vol' as const, dp: 2 })),
            { label: 'Spare over what you need', value: r.extra, kind: 'vol', dp: 2 },
          ],
          steps: r0.steps,
          notes: [...r0.notes, ...gnote('order'), ...(mins ? [`Ready-mix should be discharged within ${mins} minutes of batching (${c.standards.readyMix}). Check the docket time.`] : [])],
        };
      },
    },
    {
      id: 'bags', group: 'concrete', title: c.terms.premix, blurb: 'Bagged concrete for small jobs and post holes', icon: 'sack', free: true,
      fields: [
        { type: 'num', key: 'volume', label: 'Concrete needed', kind: 'vol', def: 0.1 },
        { type: 'choice', key: 'bag', label: 'Bag size', def: c.bags[0]!.id, options: opt(c.bags) },
        { type: 'num', key: 'yieldPerBag', label: 'Yield per bag (optional)', kind: 'svol', def: null, optional: true, help: `From the bag label, e.g. ${c.units === 'imperial' ? '0.6 ft³ for 80 lb' : '0.0093 m³ for 20 kg'}. Leave empty to use the maker’s figure.` },
      ],
      run: v => {
        const b = pick(c.bags, s(v, 'bag'));
        const r0 = premixBags({ volume: n(v, 'volume'), bagKg: b?.kg ?? null, yieldPerBag: n(v, 'yieldPerBag') ?? b?.yieldM3 ?? null });
        if (!r0.ok) return r0;
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Bags', value: r.bags, kind: 'count', caption: `${b?.label ?? ''} bags` },
          outputs: [{ label: 'Total weight', value: r.totalKg, kind: 'kg', dp: 0 }, { label: 'Yield per bag', value: r.yieldPerBag, kind: 'svol', dp: 4 }],
          steps: r0.steps, notes: [...r0.notes, ...gnote('bags')],
        };
      },
    },
    {
      id: 'sitemix', group: 'concrete', title: 'Site mix', blurb: 'Cement, sand and aggregate for a mixer', icon: 'rotate-3d-variant', free: false,
      fields: [
        { type: 'num', key: 'volume', label: 'Concrete needed', kind: 'vol', def: 0.5 },
        { type: 'choice', key: 'ratio', label: 'Mix (cement : sand : aggregate)', def: '1:2:3', options: [{ value: '1:2:3', label: '1:2:3' }, { value: '1:2:4', label: '1:2:4' }, { value: '1:3:6', label: '1:3:6' }], help: '1:2:3 general, 1:3:6 for blinding and bedding.' },
        { type: 'num', key: 'cementBagKg', label: 'Cement bag', kind: 'kg', def: c.code === 'US' ? 94 * 0.45359237 : c.code === 'GB' || c.code === 'IE' || c.code === 'NZ' ? 25 : 20 },
      ],
      run: v => {
        const r0 = siteMix({ volume: n(v, 'volume'), ratio: s(v, 'ratio') as MixRatio, cementBagKg: n(v, 'cementBagKg') });
        if (!r0.ok) return r0;
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Cement', value: r.cementBags, kind: 'count', caption: 'bags of cement' },
          outputs: [
            { label: 'Cement', value: r.cementKg, kind: 'kg', dp: 0 },
            { label: 'Sand', value: r.sandM3, kind: 'vol', dp: 2 }, { label: 'Sand (dry)', value: r.sandM3 * 1.6, kind: 't', dp: 2 },
            { label: 'Aggregate', value: r.aggregateM3, kind: 'vol', dp: 2 }, { label: 'Aggregate', value: r.aggregateM3 * 1.52, kind: 't', dp: 2 },
          ],
          steps: r0.steps, notes: r0.notes,
        };
      },
    },
    // ---------------- steel & forms ----------------
    {
      id: 'mesh', group: 'steel', title: `${c.terms.mesh} & ${c.terms.barChairs.toLowerCase()}`, blurb: `${c.terms.mesh} sheets with laps, and ${c.terms.barChairs.toLowerCase()} to hold them`, icon: 'grid', free: false,
      fields: [
        { type: 'num', key: 'length', label: 'Slab length', kind: 'len', def: 6 },
        { type: 'num', key: 'width', label: 'Slab width', kind: 'len', def: 4 },
        { type: 'choice', key: 'sheet', label: 'Sheet', def: meshDef.id, options: opt(c.mesh), apply: (id): Values => { const m = pick(c.mesh, id); return m ? { sheetLength: m.length, sheetWidth: m.width, lap: m.lap } : {}; } },
        { type: 'num', key: 'edge', label: 'Edge clearance (each side)', kind: 'thick', def: 0.05 },
        { type: 'num', key: 'lap', label: 'Lap', kind: 'thick', def: meshDef.lap, help: 'The two outer cross-wires of each sheet must overlap.' },
        { type: 'num', key: 'chairSpacing', label: `${c.terms.barChairs} spacing`, kind: 'thick', def: 0.8 },
        { type: 'num', key: 'sheetLength', label: 'Sheet length', kind: 'len', def: meshDef.length },
        { type: 'num', key: 'sheetWidth', label: 'Sheet width', kind: 'len', def: meshDef.width },
        { type: 'num', key: 'waste', label: 'Spare sheets', kind: 'pct', def: 0, optional: true },
      ],
      run: v => {
        const r0 = mesh({ length: n(v, 'length'), width: n(v, 'width'), edge: n(v, 'edge'), lap: n(v, 'lap'), sheetLength: n(v, 'sheetLength'), sheetWidth: n(v, 'sheetWidth'), chairSpacing: n(v, 'chairSpacing'), wastePct: n(v, 'waste') });
        if (!r0.ok) return r0;
        const r = r0.value;
        return {
          ok: true,
          headline: { label: `${c.terms.mesh} sheets`, value: r.sheets, kind: 'count', caption: `${pick(c.mesh, s(v, 'sheet'))?.id ?? ''} · ${r.along} × ${r.across} sheets`.replace(/^ · /, '') },
          outputs: [{ label: c.terms.barChairs, value: r.chairs, kind: 'count' }, { label: 'Mesh length', value: r.meshLength, kind: 'len', dp: 2 }, { label: 'Mesh width', value: r.meshWidth, kind: 'len', dp: 2 }],
          steps: r0.steps, notes: [...r0.notes, structural, ...gnote('mesh')],
        };
      },
    },
    {
      id: 'bars', group: 'steel', title: 'Bars & laps', blurb: 'Bar lengths, laps and weight', icon: 'reorder-horizontal', free: false,
      fields: [
        { type: 'num', key: 'runLength', label: 'Length of each run', kind: 'len', def: 12 },
        { type: 'num', key: 'runs', label: 'Number of runs', kind: 'count', def: 1 },
        { type: 'num', key: 'barsPerRun', label: 'Bars in each run', kind: 'count', def: 4 },
        { type: 'choice', key: 'bar', label: 'Bar size', def: barDef.id, options: opt(c.bars), apply: (id): Values => { const b = pick(c.bars, id); return b ? { lap: Math.ceil((40 * b.d) / 10) / 100, stockLength: b.stock } : {}; } },
        { type: 'num', key: 'lap', label: 'Lap length', kind: 'thick', def: Math.ceil((40 * barDef.d) / 10) / 100, help: 'Use the lap on the drawings. Pre-filled with 40 × bar size, a rule of thumb only.' },
        { type: 'num', key: 'stockLength', label: 'Stock bar length', kind: 'len', def: barDef.stock },
      ],
      run: v => {
        const b = pick(c.bars, s(v, 'bar'));
        const r0 = bars({ runLength: n(v, 'runLength'), runs: n(v, 'runs'), barsPerRun: n(v, 'barsPerRun'), stockLength: n(v, 'stockLength'), lap: n(v, 'lap'), diameter: b?.d ?? null, label: b?.label });
        if (!r0.ok) return r0;
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Stock bars', value: r.stockBars, kind: 'count', caption: `${b?.label ?? ''} bars` },
          outputs: [{ label: 'Laps', value: r.laps, kind: 'count' }, { label: 'Bar bought', value: r.totalBarLength, kind: 'len', dp: 1 }, { label: 'Weight', value: r.massKg, kind: 'kg', dp: 0 }],
          steps: r0.steps, notes: [...r0.notes, structural],
        };
      },
    },
    {
      id: 'trench', group: 'steel', title: 'Trench mesh', blurb: 'Mesh lengths for strip footings', icon: 'view-stream-outline', free: false,
      fields: [
        { type: 'num', key: 'totalLength', label: 'Total footing length', kind: 'len', def: 30 },
        { type: 'num', key: 'corners', label: 'Corners and T-junctions', kind: 'count', def: 4, optional: true },
        { type: 'num', key: 'lines', label: 'Layers (top and bottom = 2)', kind: 'count', def: 1 },
        { type: 'num', key: 'meshWidth', label: 'Mesh width', kind: 'thick', def: tm.width },
        { type: 'num', key: 'lap', label: 'End lap', kind: 'thick', def: tm.lap },
        { type: 'num', key: 'stockLength', label: 'Length of each piece', kind: 'len', def: tm.length },
      ],
      run: v => {
        const r0 = trenchMesh({ totalLength: n(v, 'totalLength'), corners: n(v, 'corners') ?? 0, lines: n(v, 'lines'), meshWidth: n(v, 'meshWidth'), lap: n(v, 'lap'), stockLength: n(v, 'stockLength') });
        if (!r0.ok) return r0;
        return { ok: true, headline: { label: 'Trench mesh', value: r0.value.pieces, kind: 'count', caption: 'lengths' }, outputs: [{ label: 'End laps', value: r0.value.laps, kind: 'count' }], steps: r0.steps, notes: [...r0.notes, ...(c.trenchMesh ? [] : ['Check whether trench mesh is sold where you are; footings may use loose bars instead.'])] };
      },
    },
    {
      id: 'formwork', group: 'steel', title: `${c.terms.formwork} & pegs`, blurb: 'Edge boards, joints and pegs', icon: 'border-outside', free: false,
      fields: [
        { type: 'choice', key: 'outline', label: 'Outline', def: 'rect', options: [{ value: 'rect', label: 'Rectangle' }, { value: 'custom', label: 'Custom sides' }] },
        { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 6, when: v => v.outline !== 'custom' },
        { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 4, when: v => v.outline !== 'custom' },
        { type: 'list', key: 'sides', label: 'Side lengths', kind: 'len', def: [6, 4, 6, 4], help: 'Each side that needs a form, separated by commas. Leave out edges against existing concrete.', when: v => v.outline === 'custom' },
        { type: 'num', key: 'boardLength', label: 'Board length', kind: 'len', def: c.units === 'imperial' ? 16 * 0.3048 : 4.8 },
        { type: 'num', key: 'pegSpacing', label: 'Peg spacing', kind: 'len', def: c.units === 'imperial' ? 3 * 0.3048 : 1 },
        { type: 'num', key: 'depth', label: 'Edge depth', kind: 'thick', def: 0.1, optional: true },
      ],
      run: v => {
        const sides = v.outline === 'custom' ? (Array.isArray(v.sides) ? (v.sides as (number | null)[]) : []) : [n(v, 'length'), n(v, 'width'), n(v, 'length'), n(v, 'width')];
        const r0 = formwork({ sides, boardLength: n(v, 'boardLength'), pegSpacing: n(v, 'pegSpacing'), depth: n(v, 'depth') });
        if (!r0.ok) {
          const e: Errors = {};
          for (const [k, msg] of Object.entries(r0.errors)) {
            if (v.outline === 'custom' && /^side\d+$/.test(k)) e.sides = e.sides ?? `${msg} Check the list of sides.`;
            else if (k === 'side0') e.length = msg.replace('Side 1', 'Length');
            else if (k === 'side1') e.width = msg.replace('Side 2', 'Width');
            else if (!/^side\d+$/.test(k)) e[k] = msg;
          }
          return { ok: false, errors: e };
        }
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Form boards', value: r.boards, kind: 'count', caption: 'boards' },
          outputs: [{ label: 'Pegs', value: r.pegs, kind: 'count' }, { label: 'Perimeter', value: r.perimeter, kind: 'len', dp: 2 }, { label: 'Board joints', value: r.joints, kind: 'count' }],
          steps: r0.steps, notes: r0.notes,
        };
      },
    },
    // ---------------- ground ----------------
    {
      id: 'falls', group: 'ground', title: 'Falls & gradients', blurb: 'Percent, 1 : n and drop, with peg heights', icon: 'slope-downhill', free: true,
      fields: [
        { type: 'num', key: 'run', label: 'Run', kind: 'len', def: 10 },
        { type: 'choice', key: 'preset', label: 'Common falls', def: c.falls.presets[0]!.label, options: [...c.falls.presets.map(p => ({ value: p.label, label: p.label })), { value: 'custom', label: 'Other' }], apply: (p): Values => { const f = c.falls.presets.find(x => x.label === p); return f ? { mode: 'ratio', ratio: f.ratio } : {}; } },
        { type: 'choice', key: 'mode', label: 'I know the', def: 'ratio', options: [{ value: 'ratio', label: 'Ratio' }, { value: 'pct', label: 'Percent' }, { value: 'drop', label: 'Drop' }], when: v => v.preset === 'custom' },
        { type: 'num', key: 'ratio', label: 'Ratio 1 :', kind: 'num', def: c.falls.presets[0]!.ratio, when: v => v.preset === 'custom' && v.mode === 'ratio' },
        { type: 'num', key: 'pct', label: 'Fall', kind: 'pct', def: 1, when: v => v.preset === 'custom' && v.mode === 'pct' },
        { type: 'num', key: 'drop', label: 'Drop over the run', kind: 'thick', def: 0.1, when: v => v.preset === 'custom' && v.mode === 'drop' },
        { type: 'num', key: 'station', label: 'Peg every', kind: 'len', def: c.units === 'imperial' ? 5 * 0.3048 : 2, optional: true, help: 'Shows how far below the high end each peg sits.' },
      ],
      run: v => {
        const preset = c.falls.presets.find(p => p.label === v.preset);
        const mode = (preset ? 'ratio' : s(v, 'mode') || 'ratio') as FallMode;
        const raw = preset ? preset.ratio : mode === 'ratio' ? n(v, 'ratio') : mode === 'pct' ? n(v, 'pct') : n(v, 'drop');
        const r0 = falls({ run: n(v, 'run'), mode, value: raw, station: n(v, 'station') });
        if (!r0.ok) {
          const e = { ...r0.errors };
          if (e.value) { e[mode] = e.value; delete e.value; }
          return { ok: false, errors: e };
        }
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Drop', value: r.drop, kind: 'mm', dp: 0, caption: `over the run · 1 : ${r.ratio >= 100 ? Math.round(r.ratio) : r.ratio.toFixed(1)}` },
          outputs: [{ label: 'Fall', value: r.pct, kind: 'pct', dp: 2 }, { label: 'Ratio 1 :', value: r.ratio, kind: 'ratio', dp: r.ratio >= 100 ? 0 : 1 }, { label: c.units === 'imperial' ? 'Per foot' : 'Per metre', value: r.mmPerM / 1000, kind: 'grade', dp: 1 }],
          steps: r0.steps, notes: [...r0.notes, ...(preset ? [`${preset.label}: ${preset.detail}.`] : []), c.falls.buildingNote],
          table: r.stations.length ? { title: 'Peg heights below the high end', head: ['From high end', 'Below'], rows: r.stations.map(st => [{ label: '', value: st.at, kind: 'len', dp: 2 }, { label: '', value: st.below, kind: 'mm', dp: 0 }]) } : undefined,
        };
      },
    },
    {
      id: 'pavers', group: 'ground', title: 'Pavers', blurb: `Pavers, bedding sand and ${c.terms.roadBase.toLowerCase()}`, icon: 'view-grid-outline', free: false,
      fields: [
        { type: 'num', key: 'area', label: 'Area', kind: 'area', def: 20 },
        { type: 'choice', key: 'size', label: 'Paver size', def: c.pavers[0]!.id, options: opt(c.pavers), apply: (id): Values => { const p = pick(c.pavers, id); return p ? { paverLength: p.length, paverWidth: p.width } : {}; } },
        { type: 'num', key: 'paverLength', label: 'Paver length', kind: 'size', def: c.pavers[0]!.length },
        { type: 'num', key: 'paverWidth', label: 'Paver width', kind: 'size', def: c.pavers[0]!.width },
        { type: 'num', key: 'joint', label: 'Joint', kind: 'size', def: 0.003, help: '2–5 mm.' },
        { type: 'num', key: 'waste', label: 'Waste', kind: 'pct', def: 5, help: '5 % straight lay, 10 % or more for herringbone.' },
        { type: 'num', key: 'beddingDepth', label: 'Bedding sand', kind: 'thick', def: 0.03, optional: true },
        { type: 'num', key: 'baseDepth', label: `${c.terms.roadBase} depth`, kind: 'thick', def: 0.1, optional: true, help: '100 mm for paths; driveways need more.' },
        { type: 'num', key: 'baseCompactPct', label: 'Base compaction allowance', kind: 'pct', def: 20 },
      ],
      run: v => {
        const base = c.materials.find(m => m.compactPct > 0 && /base|type|clause|crush|gap|ap4|run/i.test(m.id + m.name)) ?? c.materials[0]!;
        const r0 = pavers({ area: n(v, 'area'), paverLength: n(v, 'paverLength'), paverWidth: n(v, 'paverWidth'), joint: n(v, 'joint'), wastePct: n(v, 'waste'), beddingDepth: n(v, 'beddingDepth') ?? 0, baseDepth: n(v, 'baseDepth') ?? 0, baseCompactPct: n(v, 'baseCompactPct'), baseDensity: base.density });
        if (!r0.ok) return r0;
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Pavers', value: r.pavers, kind: 'count', caption: `${r.perM2.toFixed(1)} per m² plus waste` },
          outputs: [
            { label: 'Bedding sand', value: r.beddingM3, kind: 'vol', dp: 2 }, { label: 'Bedding sand', value: r.beddingT, kind: 't', dp: 2 },
            { label: c.terms.roadBase, value: r.baseM3, kind: 'vol', dp: 2 }, { label: c.terms.roadBase, value: r.baseT, kind: 't', dp: 2 },
          ],
          steps: r0.steps, notes: [...r0.notes, ...gnote('pavers')],
        };
      },
    },
    {
      id: 'bulk', group: 'ground', title: 'Gravel, soil & sand', blurb: 'Volume and tonnes of bulk material', icon: 'dump-truck', free: false,
      fields: [
        { type: 'choice', key: 'material', label: 'Material', def: c.materials[0]!.id, options: opt(c.materials), apply: (id): Values => { const m = pick(c.materials, id); return m ? { density: m.density, compactPct: m.compactPct } : {}; } },
        { type: 'choice', key: 'by', label: 'Area from', def: 'lw', options: [{ value: 'lw', label: 'Length × width' }, { value: 'area', label: 'Area' }] },
        { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 5, when: v => v.by !== 'area' },
        { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 4, when: v => v.by !== 'area' },
        { type: 'num', key: 'area', label: 'Area', kind: 'area', def: 20, when: v => v.by === 'area' },
        { type: 'num', key: 'depth', label: 'Depth', kind: 'thick', def: 0.1 },
        { type: 'num', key: 'density', label: 'Density', kind: 'density', def: c.materials[0]!.density, help: 'Use your supplier’s figure if they give one.' },
        { type: 'num', key: 'compactPct', label: 'Compaction allowance', kind: 'pct', def: c.materials[0]!.compactPct },
      ],
      run: v => {
        const L = n(v, 'length'), W = n(v, 'width');
        const area = v.by === 'area' ? n(v, 'area') : L != null && W != null ? L * W : null;
        const r0 = bulk({ area, depth: n(v, 'depth'), density: n(v, 'density'), compactPct: n(v, 'compactPct') });
        if (!r0.ok) {
          const e = { ...r0.errors };
          if (e.area && v.by !== 'area') { if (!(L != null && L > 0)) e.length = 'Length must be more than 0.'; if (!(W != null && W > 0)) e.width = 'Width must be more than 0.'; delete e.area; }
          return { ok: false, errors: e };
        }
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Order', value: r.tonnes, kind: 't', dp: 2, caption: pick(c.materials, s(v, 'material'))?.name ?? 'material' },
          outputs: [{ label: 'Loose volume', value: r.looseVolume, kind: 'vol', dp: 2 }, { label: 'Finished volume', value: r.volume, kind: 'vol', dp: 2 }, ...(area ? [{ label: 'Area', value: area, kind: 'area' as const, dp: 2 }] : [])],
          steps: r0.steps, notes: [...r0.notes, ...gnote('materials')],
        };
      },
    },
    {
      id: 'convert', group: 'ground', title: 'Weight ↔ volume', blurb: 'Convert tonnes and volume by material', icon: 'scale-balance', free: true,
      fields: [
        { type: 'choice', key: 'material', label: 'Material', def: c.materials[0]!.id, options: opt(c.materials), apply: id => ({ density: pick(c.materials, id)?.density ?? 1.6 }) },
        { type: 'choice', key: 'from', label: 'Convert', def: 'm3', options: [{ value: 'm3', label: 'Volume → weight' }, { value: 't', label: 'Weight → volume' }] },
        { type: 'num', key: 'm3', label: 'Volume', kind: 'vol', def: 2, when: v => v.from !== 't' },
        { type: 'num', key: 't', label: 'Tonnes', kind: 'num', def: 3, when: v => v.from === 't' },
        { type: 'num', key: 'density', label: 'Density', kind: 'density', def: c.materials[0]!.density },
      ],
      run: v => {
        const from = v.from === 't' ? 't' : 'm3';
        const r0 = convert({ value: n(v, from), from, density: n(v, 'density') });
        if (!r0.ok) { const e = { ...r0.errors }; if (e.value) { e[from] = e.value; delete e.value; } return { ok: false, errors: e }; }
        return from === 'm3'
          ? { ok: true, headline: { label: 'Weight', value: r0.value.t, kind: 't', dp: 2, caption: 'metric tonnes' }, outputs: [], steps: r0.steps, notes: r0.notes }
          : { ok: true, headline: { label: 'Volume', value: r0.value.m3, kind: 'vol', dp: 2, caption: 'loose volume' }, outputs: [], steps: r0.steps, notes: r0.notes };
      },
    },
    {
      id: 'retaining', group: 'ground', title: 'Retaining wall', blurb: `Blocks, caps, drainage gravel and ${c.terms.agPipe.toLowerCase()}`, icon: 'wall', free: false,
      fields: [
        { type: 'num', key: 'length', label: 'Wall length', kind: 'len', def: 10 },
        { type: 'num', key: 'height', label: 'Height above ground', kind: 'thick', def: 0.6 },
        { type: 'num', key: 'buried', label: 'Buried depth', kind: 'thick', def: 0.15, help: 'Bury at least the first course.' },
        { type: 'choice', key: 'block', label: 'Block', def: blockDef.id, options: opt(c.blocks), apply: (id): Values => { const b = pick(c.blocks, id); return b ? { blockLength: b.length, blockHeight: b.height, blockDepth: b.depth, capLength: b.cap || null } : {}; } },
        { type: 'num', key: 'blockLength', label: 'Block length', kind: 'size', def: blockDef.length },
        { type: 'num', key: 'blockHeight', label: 'Block height', kind: 'size', def: blockDef.height },
        { type: 'num', key: 'blockDepth', label: 'Block depth', kind: 'size', def: blockDef.depth },
        { type: 'num', key: 'capLength', label: 'Cap length (empty for none)', kind: 'size', def: blockDef.cap || null, optional: true },
        { type: 'num', key: 'drainWidth', label: 'Drainage gravel width', kind: 'thick', def: 0.3 },
        { type: 'num', key: 'waste', label: 'Waste', kind: 'pct', def: 5 },
      ],
      run: v => {
        const r0 = retainingWall({ length: n(v, 'length'), height: n(v, 'height'), buried: n(v, 'buried'), blockLength: n(v, 'blockLength'), blockHeight: n(v, 'blockHeight'), blockDepth: n(v, 'blockDepth'), capLength: n(v, 'capLength') ?? 0, wastePct: n(v, 'waste'), drainWidth: n(v, 'drainWidth'), approvalNote: c.wallNote });
        if (!r0.ok) return r0;
        const r = r0.value;
        return {
          ok: true,
          headline: { label: 'Blocks', value: r.blocks, kind: 'count', caption: `${r.courses} courses × ${r.perCourse} + waste` },
          outputs: [
            ...(r.caps ? [{ label: 'Capping units', value: r.caps, kind: 'count' as const }] : []),
            { label: 'Drainage gravel', value: r.drainM3, kind: 'vol', dp: 2 }, { label: 'Drainage gravel', value: r.drainT, kind: 't', dp: 2 },
            { label: 'Levelling pad', value: r.padM3, kind: 'vol', dp: 2 }, { label: c.terms.agPipe, value: r.agPipe, kind: 'len', dp: 0 },
          ],
          steps: r0.steps, notes: [...r0.notes, ...gnote('blocks')],
        };
      },
    },
    // ---------------- pour day ----------------
    {
      id: 'weather', group: 'pour', title: 'Pour weather', blurb: 'Evaporation and cracking risk for the conditions', icon: 'weather-windy', free: false,
      fields: [
        { type: 'num', key: 'airC', label: 'Air temperature', kind: 'temp', def: 28 },
        { type: 'num', key: 'concreteC', label: 'Concrete temperature', kind: 'temp', def: 28, help: 'On the docket, or about air temperature.' },
        { type: 'num', key: 'humidityPct', label: 'Humidity', kind: 'pct', def: 40 },
        { type: 'num', key: 'windKmh', label: 'Wind', kind: 'speed', def: 15 },
      ],
      run: v => {
        const d = c.readyMix?.delivery;
        const r0 = pourWeather({ airC: n(v, 'airC'), concreteC: n(v, 'concreteC'), humidityPct: n(v, 'humidityPct'), windKmh: n(v, 'windKmh'), delivery: d ? { ...d, source: c.standards.readyMix } : undefined });
        if (!r0.ok) return r0;
        const r = r0.value;
        const label = r.risk === 'high' ? 'High cracking risk' : r.risk === 'moderate' ? 'Take precautions' : 'Low risk';
        return {
          ok: true,
          headline: { label: 'Evaporation', value: r.evaporation, kind: 'kgph', dp: 2, caption: label },
          outputs: [], steps: r0.steps, notes: [...r.warnings, ...r0.notes],
          tone: r.risk === 'high' ? 'bad' : r.risk === 'moderate' ? 'warn' : 'good',
        };
      },
    },
    { id: 'checklist', group: 'pour', title: 'Pour & curing checklist', blurb: 'Tick off pour day, from forms to curing', icon: 'clipboard-check-outline', free: true, fields: [], screen: '/checklist' },
  ];

  // Local defaults (e.g. US slabs in feet and inches) replace the metric ones.
  for (const t of tools) {
    const o = c.overrides[t.id];
    if (!o) continue;
    t.fields = t.fields.map(f => (f.key in o && (f.type === 'num' || f.type === 'choice') ? ({ ...f, def: o[f.key] } as Field) : f));
  }
  return tools;
}

const cache = new Map<CountryCode, Tool[]>();
export function toolsForCode(code: CountryCode | null | undefined): Tool[] {
  const p = profile(code);
  let t = cache.get(p.code);
  if (!t) { t = toolsFor(p); cache.set(p.code, t); }
  return t;
}

/** Australian tools: the default before a country is chosen, and for tests that don't care about the country. */
export const TOOLS: Tool[] = toolsForCode('AU');
export const toolById = (id: string, code: CountryCode | null = 'AU') => toolsForCode(code).find(t => t.id === id);

export function defaults(tool: Tool, overrides: Values = {}): Values {
  const v: Values = {};
  for (const f of tool.fields) v[f.key] = f.def as Value;
  return { ...v, ...overrides };
}

/** Field visible for these values? */
export const visible = (f: Field, v: Values) => !('when' in f) || !f.when || f.when(v);
