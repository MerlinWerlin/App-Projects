/**
 * Every calculator as data: its inputs (canonical metric defaults), which group it sits in, whether it is free,
 * and how its result is presented. Screens render this; src/tools/registry.test.ts runs every tool's defaults.
 * No React Native imports here.
 */
import type { Errors, Step } from '../core/calc.ts';
import { composite, footing, pier, premixBags, siteMix, slab, stairs, truckOrder, type MixRatio, type Shape } from '../core/concrete.ts';
import { falls, type FallMode } from '../core/falls.ts';
import { formwork } from '../core/formwork.ts';
import { bulk, convert, MATERIALS, materialById, pavers } from '../core/landscape.ts';
import { BAR_SIZES, bars, mesh, trenchMesh } from '../core/reo.ts';
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

export type OutKind = 'vol' | 'len' | 'area' | 'kg' | 't' | 'count' | 'pct' | 'mm' | 'ratio' | 'kgph';
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
  /** MaterialCommunityIcons name. */
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
const waste: NumField = { type: 'num', key: 'waste', label: 'Waste allowance', kind: 'pct', def: 5, help: 'Spillage, uneven ground and form bulge. 5–10 % is usual.' };

function volumeRun(c: ReturnType<typeof slab>, extra: Out[] = []): Run {
  if (!c.ok) return c;
  const r = c.value;
  return {
    ok: true,
    headline: { label: 'Concrete to order', value: r.total, kind: 'vol', dp: 2, caption: `includes ${r.wastePct} % waste` },
    outputs: [{ label: 'Net volume', value: r.net, kind: 'vol', dp: 3 }, ...(r.area !== undefined ? [{ label: 'Area', value: r.area, kind: 'area' as const, dp: 2 }] : []), ...extra],
    steps: c.steps, notes: c.notes,
    next: { tool: 'order', label: 'Order this concrete', values: { volume: r.total } },
  };
}

const PAVERS: Record<string, [number, number, string]> = {
  '230x115': [0.23, 0.115, '230 × 115 (brick paver)'],
  '200x100': [0.2, 0.1, '200 × 100'],
  '300x300': [0.3, 0.3, '300 × 300'],
  '400x400': [0.4, 0.4, '400 × 400'],
  '600x300': [0.6, 0.3, '600 × 300'],
  '600x600': [0.6, 0.6, '600 × 600'],
};
const BLOCKS: Record<string, [number, number, number, string]> = {
  small: [0.3, 0.15, 0.2, 'Garden block 300 × 150 × 200'],
  medium: [0.4, 0.2, 0.3, 'Standard block 400 × 200 × 300'],
  large: [0.45, 0.19, 0.35, 'Large block 450 × 190 × 350'],
  sleeper: [2.4, 0.2, 0.075, 'Sleeper 2.4 m × 200 × 75'],
};
const BAGS: Record<string, [number, string]> = {
  '20kg': [20, '20 kg'], '25kg': [25, '25 kg'], '30kg': [30, '30 kg'],
  '40lb': [40 * 0.45359237, '40 lb'], '60lb': [60 * 0.45359237, '60 lb'], '80lb': [80 * 0.45359237, '80 lb'],
};

export const TOOLS: Tool[] = [
  // ---------------- concrete ----------------
  {
    id: 'slab', group: 'concrete', title: 'Slab', blurb: 'Slabs, paths and driveways, with an edge beam if you need one', icon: 'square-outline', free: true,
    fields: [
      { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 6 },
      { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 4 },
      { type: 'num', key: 'depth', label: 'Depth', kind: 'thick', def: 0.1, help: '100 mm is typical for paths and driveways.' },
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
      { type: 'num', key: 'rise', label: 'Rise (each step)', kind: 'thick', def: 0.17, help: 'NCC stairs: 115–190 mm.' },
      { type: 'num', key: 'going', label: 'Going (tread depth)', kind: 'thick', def: 0.28, help: 'NCC stairs: 240–355 mm.' },
      { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 1.2 },
      waste,
    ],
    run: v => volumeRun(stairs({ steps: n(v, 'steps'), rise: n(v, 'rise'), going: n(v, 'going'), width: n(v, 'width'), wastePct: n(v, 'waste') })),
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
      { type: 'num', key: 'increment', label: 'Plant sells in steps of', kind: 'vol', def: 0.2 },
      { type: 'num', key: 'truckCapacity', label: 'Biggest load per truck', kind: 'vol', def: 6, help: 'Ask the plant. Soft or steep sites may need smaller loads.' },
    ],
    run: v => {
      const c = truckOrder({ volume: n(v, 'volume'), increment: n(v, 'increment'), truckCapacity: n(v, 'truckCapacity') });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Order', value: r.order, kind: 'vol', dp: 1, caption: r.loads === 1 ? 'one truck' : `${r.loads} trucks` },
        outputs: [
          { label: 'Truck loads', value: r.loads, kind: 'count' },
          ...r.loadSizes.map((x, k) => ({ label: `Truck ${k + 1}`, value: x, kind: 'vol' as const, dp: 1 })),
          { label: 'Spare over what you need', value: r.extra, kind: 'vol', dp: 2 },
        ],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  {
    id: 'bags', group: 'concrete', title: 'Premix bags', blurb: 'Bagged concrete for small jobs and post holes', icon: 'sack', free: true,
    fields: [
      { type: 'num', key: 'volume', label: 'Concrete needed', kind: 'vol', def: 0.1 },
      { type: 'choice', key: 'bag', label: 'Bag size', def: '20kg', options: Object.entries(BAGS).map(([value, [, label]]) => ({ value, label })) },
      { type: 'num', key: 'yieldPerBag', label: 'Yield per bag (m³, optional)', kind: 'num', def: null, optional: true, help: 'From the bag label, e.g. 0.01. Leave empty for 108 × 20 kg bags per m³.' },
    ],
    run: v => {
      const kg = BAGS[s(v, 'bag')]?.[0] ?? null;
      const c = premixBags({ volume: n(v, 'volume'), bagKg: kg, yieldPerBag: n(v, 'yieldPerBag') });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Bags', value: r.bags, kind: 'count', caption: `${BAGS[s(v, 'bag')]?.[1] ?? ''} bags` },
        outputs: [{ label: 'Total weight', value: r.totalKg, kind: 'kg', dp: 0 }, { label: 'Yield per bag', value: r.yieldPerBag, kind: 'vol', dp: 4 }],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  {
    id: 'sitemix', group: 'concrete', title: 'Site mix', blurb: 'Cement, sand and aggregate for a mixer', icon: 'rotate-3d-variant', free: false,
    fields: [
      { type: 'num', key: 'volume', label: 'Concrete needed', kind: 'vol', def: 0.5 },
      { type: 'choice', key: 'ratio', label: 'Mix (cement : sand : aggregate)', def: '1:2:3', options: [{ value: '1:2:3', label: '1:2:3' }, { value: '1:2:4', label: '1:2:4' }, { value: '1:3:6', label: '1:3:6' }], help: '1:2:3 general, 1:3:6 for blinding and bedding.' },
      { type: 'num', key: 'cementBagKg', label: 'Cement bag', kind: 'kg', def: 20 },
    ],
    run: v => {
      const c = siteMix({ volume: n(v, 'volume'), ratio: s(v, 'ratio') as MixRatio, cementBagKg: n(v, 'cementBagKg') });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Cement', value: r.cementBags, kind: 'count', caption: 'bags of cement' },
        outputs: [
          { label: 'Cement', value: r.cementKg, kind: 'kg', dp: 0 },
          { label: 'Sand', value: r.sandM3, kind: 'vol', dp: 2 }, { label: 'Sand (dry)', value: r.sandM3 * 1.6, kind: 't', dp: 2 },
          { label: 'Aggregate', value: r.aggregateM3, kind: 'vol', dp: 2 }, { label: 'Aggregate', value: r.aggregateM3 * 1.52, kind: 't', dp: 2 },
        ],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  // ---------------- steel & forms ----------------
  {
    id: 'mesh', group: 'steel', title: 'Mesh & bar chairs', blurb: 'SL mesh sheets with laps, and chairs to hold them', icon: 'grid', free: false,
    fields: [
      { type: 'num', key: 'length', label: 'Slab length', kind: 'len', def: 6 },
      { type: 'num', key: 'width', label: 'Slab width', kind: 'len', def: 4 },
      { type: 'num', key: 'edge', label: 'Edge clearance (each side)', kind: 'thick', def: 0.05 },
      { type: 'num', key: 'lap', label: 'Lap', kind: 'thick', def: 0.225, help: 'The two outer cross-wires of each sheet must overlap. 225 mm is a common minimum.' },
      { type: 'num', key: 'chairSpacing', label: 'Chair spacing', kind: 'thick', def: 0.8 },
      { type: 'num', key: 'sheetLength', label: 'Sheet length', kind: 'len', def: 6 },
      { type: 'num', key: 'sheetWidth', label: 'Sheet width', kind: 'len', def: 2.4 },
      { type: 'num', key: 'waste', label: 'Spare sheets', kind: 'pct', def: 0, optional: true },
    ],
    run: v => {
      const c = mesh({ length: n(v, 'length'), width: n(v, 'width'), edge: n(v, 'edge'), lap: n(v, 'lap'), sheetLength: n(v, 'sheetLength'), sheetWidth: n(v, 'sheetWidth'), chairSpacing: n(v, 'chairSpacing'), wastePct: n(v, 'waste') });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Mesh sheets', value: r.sheets, kind: 'count', caption: `${r.along} × ${r.across} sheets` },
        outputs: [{ label: 'Bar chairs', value: r.chairs, kind: 'count' }, { label: 'Mesh length', value: r.meshLength, kind: 'len', dp: 2 }, { label: 'Mesh width', value: r.meshWidth, kind: 'len', dp: 2 }],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  {
    id: 'bars', group: 'steel', title: 'Bars & laps', blurb: 'N-bar lengths, laps and weight', icon: 'reorder-horizontal', free: false,
    fields: [
      { type: 'num', key: 'runLength', label: 'Length of each run', kind: 'len', def: 12 },
      { type: 'num', key: 'runs', label: 'Number of runs', kind: 'count', def: 1 },
      { type: 'num', key: 'barsPerRun', label: 'Bars in each run', kind: 'count', def: 4 },
      { type: 'choice', key: 'bar', label: 'Bar size', def: '12', options: BAR_SIZES.filter(d => d <= 32).map(d => ({ value: String(d), label: `N${d}` })), apply: d => ({ lap: (40 * Number(d)) / 1000 }) },
      { type: 'num', key: 'lap', label: 'Lap length', kind: 'thick', def: 0.48, help: 'Use the lap on the drawings. Pre-filled with 40 × bar size, a rule of thumb only.' },
      { type: 'num', key: 'stockLength', label: 'Stock bar length', kind: 'len', def: 6 },
    ],
    run: v => {
      const c = bars({ runLength: n(v, 'runLength'), runs: n(v, 'runs'), barsPerRun: n(v, 'barsPerRun'), stockLength: n(v, 'stockLength'), lap: n(v, 'lap'), diameter: Number(s(v, 'bar')) || null });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Stock bars', value: r.stockBars, kind: 'count', caption: `N${s(v, 'bar')} bars` },
        outputs: [{ label: 'Laps', value: r.laps, kind: 'count' }, { label: 'Bar bought', value: r.totalBarLength, kind: 'len', dp: 1 }, { label: 'Weight', value: r.massKg, kind: 'kg', dp: 0 }],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  {
    id: 'trench', group: 'steel', title: 'Trench mesh', blurb: 'Trench mesh lengths for strip footings', icon: 'view-stream-outline', free: false,
    fields: [
      { type: 'num', key: 'totalLength', label: 'Total footing length', kind: 'len', def: 30 },
      { type: 'num', key: 'corners', label: 'Corners and T-junctions', kind: 'count', def: 4, optional: true },
      { type: 'num', key: 'lines', label: 'Layers (top and bottom = 2)', kind: 'count', def: 1 },
      { type: 'num', key: 'meshWidth', label: 'Mesh width', kind: 'thick', def: 0.3 },
      { type: 'num', key: 'lap', label: 'End lap', kind: 'thick', def: 0.5 },
      { type: 'num', key: 'stockLength', label: 'Length of each piece', kind: 'len', def: 6 },
    ],
    run: v => {
      const c = trenchMesh({ totalLength: n(v, 'totalLength'), corners: n(v, 'corners') ?? 0, lines: n(v, 'lines'), meshWidth: n(v, 'meshWidth'), lap: n(v, 'lap'), stockLength: n(v, 'stockLength') });
      if (!c.ok) return c;
      return { ok: true, headline: { label: 'Trench mesh', value: c.value.pieces, kind: 'count', caption: 'lengths' }, outputs: [{ label: 'End laps', value: c.value.laps, kind: 'count' }], steps: c.steps, notes: c.notes };
    },
  },
  {
    id: 'formwork', group: 'steel', title: 'Formwork & pegs', blurb: 'Edge boards, joints and pegs', icon: 'border-outside', free: false,
    fields: [
      { type: 'choice', key: 'outline', label: 'Outline', def: 'rect', options: [{ value: 'rect', label: 'Rectangle' }, { value: 'custom', label: 'Custom sides' }] },
      { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 6, when: v => v.outline !== 'custom' },
      { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 4, when: v => v.outline !== 'custom' },
      { type: 'list', key: 'sides', label: 'Side lengths', kind: 'len', def: [6, 4, 6, 4], help: 'Each side that needs a form, separated by commas. Leave out edges against existing concrete.', when: v => v.outline === 'custom' },
      { type: 'num', key: 'boardLength', label: 'Board length', kind: 'len', def: 4.8 },
      { type: 'num', key: 'pegSpacing', label: 'Peg spacing', kind: 'len', def: 1 },
      { type: 'num', key: 'depth', label: 'Edge depth', kind: 'thick', def: 0.1, optional: true },
    ],
    run: v => {
      const sides = v.outline === 'custom' ? (Array.isArray(v.sides) ? (v.sides as (number | null)[]) : []) : [n(v, 'length'), n(v, 'width'), n(v, 'length'), n(v, 'width')];
      const c = formwork({ sides, boardLength: n(v, 'boardLength'), pegSpacing: n(v, 'pegSpacing'), depth: n(v, 'depth') });
      if (!c.ok) {
        const e: Errors = {};
        for (const [k, msg] of Object.entries(c.errors)) {
          if (v.outline === 'custom' && /^side\d+$/.test(k)) e.sides = e.sides ?? `${msg} Check the list of sides.`;
          else if (k === 'side0') e.length = msg.replace('Side 1', 'Length');
          else if (k === 'side1') e.width = msg.replace('Side 2', 'Width');
          else if (!/^side\d+$/.test(k)) e[k] = msg;
        }
        return { ok: false, errors: e };
      }
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Form boards', value: r.boards, kind: 'count', caption: 'boards' },
        outputs: [{ label: 'Pegs', value: r.pegs, kind: 'count' }, { label: 'Perimeter', value: r.perimeter, kind: 'len', dp: 2 }, { label: 'Board joints', value: r.joints, kind: 'count' }],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  // ---------------- ground ----------------
  {
    id: 'falls', group: 'ground', title: 'Falls & gradients', blurb: 'Percent, 1 : n and mm drop, with peg heights', icon: 'slope-downhill', free: true,
    fields: [
      { type: 'num', key: 'run', label: 'Run', kind: 'len', def: 10 },
      { type: 'choice', key: 'mode', label: 'I know the', def: 'ratio', options: [{ value: 'ratio', label: 'Ratio' }, { value: 'pct', label: 'Percent' }, { value: 'drop', label: 'Drop' }] },
      { type: 'num', key: 'ratio', label: 'Ratio 1 :', kind: 'num', def: 100, when: v => v.mode === 'ratio' },
      { type: 'num', key: 'pct', label: 'Fall', kind: 'pct', def: 1, when: v => v.mode === 'pct' },
      { type: 'num', key: 'drop', label: 'Drop over the run', kind: 'thick', def: 0.1, when: v => v.mode === 'drop' },
      { type: 'num', key: 'station', label: 'Peg every', kind: 'len', def: 2, optional: true, help: 'Shows how far below the high end each peg sits.' },
    ],
    run: v => {
      const mode = (s(v, 'mode') || 'ratio') as FallMode;
      const raw = mode === 'ratio' ? n(v, 'ratio') : mode === 'pct' ? n(v, 'pct') : n(v, 'drop');
      const c = falls({ run: n(v, 'run'), mode, value: raw, station: n(v, 'station') });
      if (!c.ok) {
        const e = { ...c.errors };
        if (e.value) { e[mode] = e.value; delete e.value; }
        return { ok: false, errors: e };
      }
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Drop', value: r.drop, kind: 'mm', dp: 0, caption: `over the run · 1 : ${r.ratio >= 100 ? Math.round(r.ratio) : r.ratio.toFixed(1)}` },
        outputs: [{ label: 'Fall', value: r.pct, kind: 'pct', dp: 2 }, { label: 'Ratio 1 :', value: r.ratio, kind: 'ratio', dp: r.ratio >= 100 ? 0 : 1 }, { label: 'Per metre', value: r.mmPerM, kind: 'mm', dp: 1 }],
        steps: c.steps, notes: c.notes,
        table: r.stations.length ? { title: 'Peg heights below the high end', head: ['From high end', 'Below'], rows: r.stations.map(st => [{ label: '', value: st.at, kind: 'len', dp: 2 }, { label: '', value: st.below, kind: 'mm', dp: 0 }]) } : undefined,
      };
    },
  },
  {
    id: 'pavers', group: 'ground', title: 'Pavers', blurb: 'Pavers, bedding sand and road base', icon: 'view-grid-outline', free: false,
    fields: [
      { type: 'num', key: 'area', label: 'Area', kind: 'area', def: 20 },
      { type: 'choice', key: 'size', label: 'Paver size (mm)', def: '230x115', options: Object.entries(PAVERS).map(([value, [, , label]]) => ({ value, label })), apply: k => ({ paverLength: PAVERS[k]![0], paverWidth: PAVERS[k]![1] }) },
      { type: 'num', key: 'paverLength', label: 'Paver length', kind: 'size', def: 0.23 },
      { type: 'num', key: 'paverWidth', label: 'Paver width', kind: 'size', def: 0.115 },
      { type: 'num', key: 'joint', label: 'Joint', kind: 'size', def: 0.003, help: '2–5 mm.' },
      { type: 'num', key: 'waste', label: 'Waste', kind: 'pct', def: 5, help: '5 % straight lay, 10 % or more for herringbone.' },
      { type: 'num', key: 'beddingDepth', label: 'Bedding sand', kind: 'thick', def: 0.03, optional: true },
      { type: 'num', key: 'baseDepth', label: 'Road base depth', kind: 'thick', def: 0.1, optional: true, help: '100 mm for paths; driveways need more.' },
      { type: 'num', key: 'baseCompactPct', label: 'Base compaction allowance', kind: 'pct', def: 20 },
    ],
    run: v => {
      const c = pavers({ area: n(v, 'area'), paverLength: n(v, 'paverLength'), paverWidth: n(v, 'paverWidth'), joint: n(v, 'joint'), wastePct: n(v, 'waste'), beddingDepth: n(v, 'beddingDepth') ?? 0, baseDepth: n(v, 'baseDepth') ?? 0, baseCompactPct: n(v, 'baseCompactPct') });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Pavers', value: r.pavers, kind: 'count', caption: `${r.perM2.toFixed(1)} per m² plus waste` },
        outputs: [
          { label: 'Bedding sand', value: r.beddingM3, kind: 'vol', dp: 2 }, { label: 'Bedding sand', value: r.beddingT, kind: 't', dp: 2 },
          { label: 'Road base', value: r.baseM3, kind: 'vol', dp: 2 }, { label: 'Road base', value: r.baseT, kind: 't', dp: 2 },
        ],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  {
    id: 'bulk', group: 'ground', title: 'Gravel, soil & sand', blurb: 'Cubic metres and tonnes of bulk material', icon: 'dump-truck', free: false,
    fields: [
      { type: 'choice', key: 'material', label: 'Material', def: 'roadbase', options: MATERIALS.map(m => ({ value: m.id, label: m.name })), apply: (id): Values => { const m = materialById(id); return m ? { density: m.density, compactPct: m.compactPct } : {}; } },
      { type: 'choice', key: 'by', label: 'Area from', def: 'lw', options: [{ value: 'lw', label: 'Length × width' }, { value: 'area', label: 'Area' }] },
      { type: 'num', key: 'length', label: 'Length', kind: 'len', def: 5, when: v => v.by !== 'area' },
      { type: 'num', key: 'width', label: 'Width', kind: 'len', def: 4, when: v => v.by !== 'area' },
      { type: 'num', key: 'area', label: 'Area', kind: 'area', def: 20, when: v => v.by === 'area' },
      { type: 'num', key: 'depth', label: 'Depth', kind: 'thick', def: 0.1 },
      { type: 'num', key: 'density', label: 'Density', kind: 'density', def: 1.6, help: 'Use your supplier’s figure if they give one.' },
      { type: 'num', key: 'compactPct', label: 'Compaction allowance', kind: 'pct', def: 20 },
    ],
    run: v => {
      const L = n(v, 'length'), W = n(v, 'width');
      const area = v.by === 'area' ? n(v, 'area') : L != null && W != null ? L * W : null;
      const c = bulk({ area, depth: n(v, 'depth'), density: n(v, 'density'), compactPct: n(v, 'compactPct') });
      if (!c.ok) {
        const e = { ...c.errors };
        if (e.area && v.by !== 'area') { if (!(L != null && L > 0)) e.length = 'Length must be more than 0.'; if (!(W != null && W > 0)) e.width = 'Width must be more than 0.'; delete e.area; }
        return { ok: false, errors: e };
      }
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Order', value: r.tonnes, kind: 't', dp: 2, caption: `${materialById(s(v, 'material'))?.name ?? 'material'}` },
        outputs: [{ label: 'Loose volume', value: r.looseVolume, kind: 'vol', dp: 2 }, { label: 'Finished volume', value: r.volume, kind: 'vol', dp: 2 }, ...(area ? [{ label: 'Area', value: area, kind: 'area' as const, dp: 2 }] : [])],
        steps: c.steps, notes: c.notes,
      };
    },
  },
  {
    id: 'convert', group: 'ground', title: 'Tonnes ↔ m³', blurb: 'Convert by material density', icon: 'scale-balance', free: true,
    fields: [
      { type: 'choice', key: 'material', label: 'Material', def: 'roadbase', options: MATERIALS.map(m => ({ value: m.id, label: m.name })), apply: id => ({ density: materialById(id)?.density ?? 1.6 }) },
      { type: 'choice', key: 'from', label: 'Convert', def: 'm3', options: [{ value: 'm3', label: 'm³ → tonnes' }, { value: 't', label: 'Tonnes → m³' }] },
      { type: 'num', key: 'm3', label: 'Volume', kind: 'vol', def: 2, when: v => v.from !== 't' },
      { type: 'num', key: 't', label: 'Tonnes', kind: 'num', def: 3, when: v => v.from === 't' },
      { type: 'num', key: 'density', label: 'Density', kind: 'density', def: 1.6 },
    ],
    run: v => {
      const from = v.from === 't' ? 't' : 'm3';
      const c = convert({ value: n(v, from), from, density: n(v, 'density') });
      if (!c.ok) { const e = { ...c.errors }; if (e.value) { e[from] = e.value; delete e.value; } return { ok: false, errors: e }; }
      return from === 'm3'
        ? { ok: true, headline: { label: 'Weight', value: c.value.t, kind: 't', dp: 2, caption: 'tonnes' }, outputs: [], steps: c.steps, notes: c.notes }
        : { ok: true, headline: { label: 'Volume', value: c.value.m3, kind: 'vol', dp: 2, caption: 'loose volume' }, outputs: [], steps: c.steps, notes: c.notes };
    },
  },
  {
    id: 'retaining', group: 'ground', title: 'Retaining wall', blurb: 'Blocks, caps, drainage gravel and ag pipe', icon: 'wall', free: false,
    fields: [
      { type: 'num', key: 'length', label: 'Wall length', kind: 'len', def: 10 },
      { type: 'num', key: 'height', label: 'Height above ground', kind: 'thick', def: 0.6 },
      { type: 'num', key: 'buried', label: 'Buried depth', kind: 'thick', def: 0.15, help: 'Bury at least the first course.' },
      { type: 'choice', key: 'block', label: 'Block', def: 'medium', options: Object.entries(BLOCKS).map(([value, [, , , label]]) => ({ value, label })), apply: k => ({ blockLength: BLOCKS[k]![0], blockHeight: BLOCKS[k]![1], blockDepth: BLOCKS[k]![2], capLength: k === 'sleeper' ? 0 : BLOCKS[k]![0] }) },
      { type: 'num', key: 'blockLength', label: 'Block length', kind: 'size', def: 0.4 },
      { type: 'num', key: 'blockHeight', label: 'Block height', kind: 'size', def: 0.2 },
      { type: 'num', key: 'blockDepth', label: 'Block depth', kind: 'size', def: 0.3 },
      { type: 'num', key: 'capLength', label: 'Cap length (empty for none)', kind: 'size', def: 0.4, optional: true },
      { type: 'num', key: 'drainWidth', label: 'Drainage gravel width', kind: 'thick', def: 0.3 },
      { type: 'num', key: 'waste', label: 'Waste', kind: 'pct', def: 5 },
    ],
    run: v => {
      const c = retainingWall({ length: n(v, 'length'), height: n(v, 'height'), buried: n(v, 'buried'), blockLength: n(v, 'blockLength'), blockHeight: n(v, 'blockHeight'), blockDepth: n(v, 'blockDepth'), capLength: n(v, 'capLength') ?? 0, wastePct: n(v, 'waste'), drainWidth: n(v, 'drainWidth') });
      if (!c.ok) return c;
      const r = c.value;
      return {
        ok: true,
        headline: { label: 'Blocks', value: r.blocks, kind: 'count', caption: `${r.courses} courses × ${r.perCourse} + waste` },
        outputs: [
          ...(r.caps ? [{ label: 'Capping units', value: r.caps, kind: 'count' as const }] : []),
          { label: 'Drainage gravel', value: r.drainM3, kind: 'vol', dp: 2 }, { label: 'Drainage gravel', value: r.drainT, kind: 't', dp: 2 },
          { label: 'Levelling pad', value: r.padM3, kind: 'vol', dp: 2 }, { label: 'Ag pipe', value: r.agPipe, kind: 'len', dp: 0 },
        ],
        steps: c.steps, notes: c.notes,
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
      const c = pourWeather({ airC: n(v, 'airC'), concreteC: n(v, 'concreteC'), humidityPct: n(v, 'humidityPct'), windKmh: n(v, 'windKmh') });
      if (!c.ok) return c;
      const r = c.value;
      const label = r.risk === 'high' ? 'High cracking risk' : r.risk === 'moderate' ? 'Take precautions' : 'Low risk';
      return {
        ok: true,
        headline: { label: 'Evaporation', value: r.evaporation, kind: 'kgph', dp: 2, caption: label },
        outputs: [], steps: c.steps, notes: [...r.warnings, ...c.notes],
        tone: r.risk === 'high' ? 'bad' : r.risk === 'moderate' ? 'warn' : 'good',
      };
    },
  },
  { id: 'checklist', group: 'pour', title: 'Pour & curing checklist', blurb: 'Tick off pour day, from forms to curing', icon: 'clipboard-check-outline', free: true, fields: [], screen: '/checklist' },
];

export const toolById = (id: string) => TOOLS.find(t => t.id === id);

export function defaults(tool: Tool, overrides: Values = {}): Values {
  const v: Values = {};
  for (const f of tool.fields) v[f.key] = f.def as Value;
  return { ...v, ...overrides };
}

/** Field visible for these values? */
export const visible = (f: Field, v: Values) => !('when' in f) || !f.when || f.when(v);
