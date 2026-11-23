/**
 * Countries: the user's country (asked at first launch) sets units, the products offered in pickers (what local
 * suppliers and hardware chains actually stock), standards named in notes, terms and drainage/stair guidance.
 *
 * Every value cites its source (checked 23 Nov 2026). Retailer and maker names appear here only as plain-text
 * sources, never in the UI, and imply no affiliation. A catalogue that could not be verified for a country is
 * listed in `generic`, uses the generic sizes, and the tool says so. Steps and truck sizes stay editable.
 */
import type { UnitSystem } from './units.ts';

export type CountryCode = 'AU' | 'NZ' | 'GB' | 'IE' | 'US' | 'CA' | 'XX';
export type Catalogue = 'bags' | 'mesh' | 'bars' | 'pavers' | 'blocks' | 'materials' | 'order' | 'falls' | 'stairs';

export interface Bag { id: string; label: string; kg: number; /** m³ per bag stated by the maker, if known. */ yieldM3?: number }
export interface MeshSheet { id: string; label: string; length: number; width: number; /** Default lap, m. */ lap: number }
export interface Bar { id: string; label: string; /** Nominal diameter, mm. */ d: number; /** Stock length, m. */ stock: number }
export interface Paver { id: string; label: string; length: number; width: number }
export interface Block { id: string; label: string; length: number; height: number; depth: number; /** Cap unit length, 0 = none listed. */ cap: number }
export interface BulkMaterial { id: string; name: string; density: number; compactPct: number }
export interface FallPreset { label: string; ratio: number; detail: string }
export interface StairRule { riser: [number, number]; going: [number, number]; twoRG?: [number, number]; code: string }

export interface CountryProfile {
  code: CountryCode;
  name: string;
  units: UnitSystem;
  /** Ready-mix: ordering step (m³) and largest common truck load (m³). */
  order: { increment: number; truck: number };
  bags: Bag[];
  mesh: MeshSheet[];
  bars: Bar[];
  trenchMesh?: { label: string; width: number; length: number; lap: number };
  pavers: Paver[];
  blocks: Block[];
  materials: BulkMaterial[];
  falls: { presets: FallPreset[]; buildingNote: string };
  stairs?: StairRule;
  standards: { readyMix: string; structural: string; residential: string; curing: string };
  readyMix?: { dischargeMinutes?: number; delivery?: { min: number; max: number } };
  wallNote?: string;
  terms: { barChairs: string; roadBase: string; agPipe: string; premix: string; formwork: string; mesh: string };
  /** Per-tool default values (canonical metric) that suit local practice, e.g. US slabs in feet and inches. */
  overrides: Record<string, Record<string, number | string>>;
  /** Catalogues that fell back to generic sizes because local availability could not be verified. */
  generic: Catalogue[];
  /** True for the six supported countries; false for "another country". */
  verified: boolean;
}

const FT = 0.3048, IN = 0.0254, LB = 0.45359237, FT3 = FT ** 3, YD3 = 27 * FT3, SHORT_TON = 2000 * LB;

/** Generic catalogue: used for "another country" and for any slot listed in `generic`. */
const GENERIC = {
  // Round up to 0.25 m³ steps; trucks of about 6 m³ (common across the sources below).
  order: { increment: 0.25, truck: 6 },
  // About 0.0093–0.01 m³ per 20 kg of mix across AU, UK and US makers (Boral, Blue Circle, Quikrete).
  bags: [{ id: '20kg', label: '20 kg', kg: 20 }, { id: '25kg', label: '25 kg', kg: 25 }, { id: '30kg', label: '30 kg', kg: 30 }, { id: '40kg', label: '40 kg', kg: 40 }],
  mesh: [{ id: 'generic', label: '6.0 × 2.4 m sheet', length: 6, width: 2.4, lap: 0.225 }],
  bars: [10, 12, 16, 20].map(d => ({ id: `${d}`, label: `${d} mm`, d, stock: 6 })),
  pavers: [
    { id: '200x100', label: '200 × 100', length: 0.2, width: 0.1 },
    { id: '400x400', label: '400 × 400', length: 0.4, width: 0.4 },
    { id: '600x600', label: '600 × 600', length: 0.6, width: 0.6 },
  ],
  blocks: [{ id: 'std', label: 'Block 400 × 200 × 300', length: 0.4, height: 0.2, depth: 0.3, cap: 0 }],
  // Engineering ToolBox bulk densities (see landscape.ts).
  materials: [
    { id: 'crushed', name: 'Crushed rock base', density: 1.6, compactPct: 20 },
    { id: 'gravel', name: 'Gravel', density: 1.52, compactPct: 0 },
    { id: 'sandDry', name: 'Sand (dry)', density: 1.6, compactPct: 10 },
    { id: 'sandWet', name: 'Sand (damp)', density: 1.92, compactPct: 10 },
    { id: 'soil', name: 'Topsoil', density: 1.25, compactPct: 0 },
    { id: 'mulch', name: 'Mulch / wood chips', density: 0.38, compactPct: 0 },
    { id: 'concrete', name: 'Concrete (fresh)', density: 2.4, compactPct: 0 },
  ],
  falls: {
    presets: [
      { label: '1:50', ratio: 50, detail: '2 %, a common fall away from buildings' },
      { label: '1:60', ratio: 60, detail: 'about 1.7 %, paths and driveways' },
      { label: '1:100', ratio: 100, detail: '1 %, a common minimum for paving' },
    ],
    buildingNote: 'Ground and paving should fall away from buildings. Check your local building code for the minimum.',
  },
  standards: { readyMix: 'your local ready-mix standard', structural: 'your local concrete code', residential: 'your local building code', curing: 'your local concrete code' },
  terms: { barChairs: 'Bar chairs', roadBase: 'Crushed rock base', agPipe: 'Drain pipe', premix: 'Bagged concrete', formwork: 'Formwork', mesh: 'Mesh' },
  overrides: {},
};
const GENERIC_MATERIALS = GENERIC.materials;
const gen = (ids: string[]) => GENERIC_MATERIALS.filter(m => ids.includes(m.id));

export const COUNTRIES: Record<CountryCode, CountryProfile> = {
  AU: {
    ...GENERIC,
    code: 'AU', name: 'Australia', units: 'metric', verified: true, generic: [],
    // Mini-mix delivers from 0.2 m³ (iseekplant, Brookvale Mini-Crete); standard agitator 6 m³ (Boral Sydney
    // contract, FWC AN120071; agitators 6–8 m³, iseekplant). Holcim SEQ: 1.0 m³ minimum single load.
    order: { increment: 0.2, truck: 6 },
    // Boral Concrete Mix: "108 x 20kg bags equates to one cubic metre" (boral.com.au/media/13251). 20 kg is the
    // standard hardware-chain bag (Bunnings, MaxPRO 20 kg).
    bags: [{ id: '20kg', label: '20 kg', kg: 20, yieldM3: 1 / 108 }],
    // InfraBuild Reinforcing Product Guide 2023: SL62–SL102 at 200 mm pitch, effective 5.8 × 2.4 m (6 m long with
    // non-structural fly ends). Effective size used so laps are counted on the wires. Lap 225 mm (RMIT guide).
    mesh: ['SL82', 'SL72', 'SL92', 'SL62', 'SL102'].map(id => ({ id, label: `${id} (6 m sheet)`, length: 5.8, width: 2.4, lap: 0.225 })),
    // InfraBuild guide: D500N bar commonly stocked in 6, 9 or 12 m lengths.
    bars: [10, 12, 16].map(d => ({ id: `N${d}`, label: `N${d}`, d, stock: 6 })),
    // Trench mesh 6 m lengths; 500 mm end laps (NCC 2019 Vol. 2 Table 3.2.3.1).
    trenchMesh: { label: '3-bar trench mesh (300 mm)', width: 0.3, length: 6, lap: 0.5 },
    // Bunnings: Adbri 400 × 400 × 40 paver; National Masonry Drivepave 230 × 115 × 50 (nuway.com.au).
    pavers: [
      { id: '230x115', label: '230 × 115 (driveway paver)', length: 0.23, width: 0.115 },
      { id: '400x400', label: '400 × 400', length: 0.4, width: 0.4 },
    ],
    // Bunnings: Adbri Versawall standard block 400 × 200 × 215 mm (L × H × D); max unreinforced 800 mm + cap.
    blocks: [{ id: 'std', label: 'Wall block 400 × 200 × 215', length: 0.4, height: 0.2, depth: 0.215, cap: 0 }],
    // Nuway (Logan) price list: road base ≈1.6, washed sand and brickies loam ≈1.5 t/m³.
    // ANL figures (via whatsthedamage.com.au): blue metal 1.45, river gravel 1.55, turf underlay 1.4 t/m³.
    materials: [
      { id: 'roadbase', name: 'Road base', density: 1.6, compactPct: 20 },
      { id: 'bluemetal', name: 'Blue metal (20 mm)', density: 1.45, compactPct: 0 },
      { id: 'rivergravel', name: 'River gravel', density: 1.55, compactPct: 0 },
      { id: 'washedsand', name: 'Washed sand', density: 1.5, compactPct: 10 },
      { id: 'loam', name: 'Brickies loam', density: 1.5, compactPct: 10 },
      { id: 'underlay', name: 'Turf underlay / garden soil', density: 1.4, compactPct: 0 },
      ...gen(['mulch', 'concrete']),
    ],
    falls: {
      presets: [
        { label: '1:20', ratio: 20, detail: '50 mm over the first 1 m away from a building (NCC)' },
        { label: '1:60', ratio: 60, detail: '1.7 %, paths and driveways' },
        { label: '1:100', ratio: 100, detail: '1 %, common minimum for paving' },
      ],
      // ABCB Housing Provisions 2022 cl. 3.3.3(1).
      buildingNote: 'NCC: ground next to a building falls at least 50 mm over the first 1 m (25 mm for paving in low-rainfall areas).',
    },
    // ABCB Housing Provisions 2022 cl. 11.2.2, Table 11.2.2a.
    stairs: { riser: [0.115, 0.19], going: [0.24, 0.355], twoRG: [0.55, 0.7], code: 'NCC' },
    standards: { readyMix: 'AS 1379', structural: 'AS 3600', residential: 'AS 2870 and the NCC', curing: 'AS 3600' },
    // AS 1379 cl. 4.2.5 (90 min, via Austroads ATS 5335); 5–35 °C at delivery (Holcim data sheet DS2004).
    readyMix: { dischargeMinutes: 90, delivery: { min: 5, max: 35 } },
    // Council fact sheets: NSW exempt development to 600 mm; Qld approval over 1 m.
    wallNote: 'Walls over about 600 mm (NSW) to 1 m (Qld and elsewhere), or near boundaries, buildings or loads, may need council approval and an engineer’s design. Check with your council.',
    terms: { barChairs: 'Bar chairs', roadBase: 'Road base', agPipe: 'Ag pipe', premix: 'Premix bags', formwork: 'Formwork', mesh: 'Mesh' },
  },
  NZ: {
    ...GENERIC,
    code: 'NZ', name: 'New Zealand', units: 'metric', verified: true, generic: ['order', 'falls'],
    // Firth: 6-wheel trucks carry 5 m³, 8-wheel 6.4 m³, 10-wheel 7 m³; small-load fee at 3 m³ or less.
    // Ordering step not verified: generic 0.25 m³.
    order: { increment: 0.25, truck: 6.4 },
    // Firth Dricon brochure 2020: 25 kg bag makes 0.012 m³, 40 kg makes 0.019 m³ (Mitre 10 stocks 25 kg).
    bags: [{ id: '25kg', label: '25 kg', kg: 25, yieldM3: 0.012 }, { id: '40kg', label: '40 kg', kg: 40, yieldM3: 0.019 }],
    // Steel & Tube spec sheets (Aug 2025): SE62, SE72 at 200 mm pitch, 6040 × 2440 mm. Mitre 10: 665 large sheet
    // 6.06 × 2.42 m, small 4.56 × 1.97 m. Lap: generic 225 mm (check NZS 3604 / your engineer).
    mesh: [
      { id: 'SE62', label: 'SE62 (6.04 × 2.44 m)', length: 6.04, width: 2.44, lap: 0.225 },
      { id: 'SE72', label: 'SE72 (6.04 × 2.44 m)', length: 6.04, width: 2.44, lap: 0.225 },
      { id: '665L', label: '665 large (6.06 × 2.42 m)', length: 6.06, width: 2.42, lap: 0.225 },
      { id: '665S', label: '665 small (4.56 × 1.97 m)', length: 4.56, width: 1.97, lap: 0.225 },
    ],
    // Mitre 10 D12-300 6 m; Bunnings NZ D12 500 HD 6 m (AS/NZS 4671 nominal mass).
    bars: [
      { id: 'D10', label: 'D10', d: 10, stock: 6 }, { id: 'D12', label: 'D12', d: 12, stock: 6 }, { id: 'D16', label: 'D16', d: 16, stock: 6 },
      { id: 'HD12', label: 'HD12', d: 12, stock: 6 }, { id: 'HD16', label: 'HD16', d: 16, stock: 6 },
    ],
    trenchMesh: undefined,
    // Bunnings NZ: Firth Holland 200 × 100, WestStone 230 × 115, 400 × 400.
    pavers: [
      { id: '200x100', label: '200 × 100 (Holland)', length: 0.2, width: 0.1 },
      { id: '230x115', label: '230 × 115', length: 0.23, width: 0.115 },
      { id: '400x400', label: '400 × 400', length: 0.4, width: 0.4 },
    ],
    // Firth Keystone Compac III tech flyer (Oct 2025): 457 L × 200 H × 305 D mm; cap 455 mm long.
    blocks: [{ id: 'std', label: 'Wall block 457 × 200 × 305', length: 0.457, height: 0.2, depth: 0.305, cap: 0.455 }],
    // Hirock quarry price list (Jul 2026): GAP20/GAP40/GAP65 and AP40 1.70 t/m³ loose; sand, chip and drainage stone
    // 1.4–1.8 t/m³ (1.6 used). Topsoil and mulch not verified: generic.
    materials: [
      { id: 'gap40', name: 'GAP40 / AP40 basecourse', density: 1.7, compactPct: 20 },
      { id: 'gap65', name: 'GAP65', density: 1.7, compactPct: 20 },
      { id: 'sand', name: 'Sand', density: 1.6, compactPct: 10 },
      { id: 'drainage', name: 'Drainage chip', density: 1.6, compactPct: 0 },
      ...gen(['soil', 'mulch', 'concrete']),
    ],
    falls: {
      // BRANZ level-threshold article uses 1:40 for patio paving. No general ground-fall figure verified.
      presets: [
        { label: '1:40', ratio: 40, detail: '2.5 %, patio paving falling from the house (BRANZ)' },
        { label: '1:60', ratio: 60, detail: 'about 1.7 %, paths and driveways' },
        { label: '1:100', ratio: 100, detail: '1 %' },
      ],
      // Placemakers summary of E1/AS1 and E2/AS1 clearances.
      buildingNote: 'NZ Building Code: keep the floor at least 150 mm above finished ground (E1/AS1); E2/AS1 slab clearances are 100–150 mm above paving. Fall paving away from the house.',
    },
    // BRANZ (external stairs for houses), D1/AS1 main private stair: riser at most 190 mm, tread at least 280 mm.
    stairs: { riser: [0, 0.19], going: [0.28, 9], code: 'NZBC D1/AS1' },
    standards: { readyMix: 'NZS 3104', structural: 'NZS 3101', residential: 'NZS 3604', curing: 'NZS 3109' },
    terms: { barChairs: 'Bar chairs', roadBase: 'Basecourse', agPipe: 'Drain coil', premix: 'Bagged concrete', formwork: 'Boxing', mesh: 'Mesh' },
  },
  GB: {
    ...GENERIC,
    code: 'GB', name: 'United Kingdom', units: 'metric', verified: true, generic: ['blocks', 'order'],
    // Heidelberg Materials: six and eight cubic metre trucks; Tarmac: 0.5 or 1 m³ minimum. Step not verified.
    order: { increment: 0.5, truck: 6 },
    // Travis Perkins (Blue Circle): "20kg bag = 0.01 m3"; 20 kg at Wickes and B&Q.
    bags: [{ id: '20kg', label: '20 kg', kg: 20, yieldM3: 0.01 }],
    // BS 4483 fabric, 200 mm pitch, 4.8 × 2.4 m: A142 (Jewson), A193 (MKM), A393 (Selco); A252 (Irish merchants).
    mesh: ['A193', 'A142', 'A252', 'A393'].map(id => ({ id, label: `${id} (4.8 × 2.4 m)`, length: 4.8, width: 2.4, lap: 0.225 })),
    // Travis Perkins: T12 6 m × 12 mm = 5.328 kg (0.888 kg/m); Jewson BS 4449 B500C.
    bars: [10, 12, 16].map(d => ({ id: `H${d}`, label: `H${d}`, d, stock: 6 })),
    trenchMesh: undefined,
    // Wickes: Marshalls block paving 200 × 100 × 50 (488 = 9.76 m²); Toolstation: 600 × 600 slabs.
    pavers: [
      { id: '200x100', label: '200 × 100 block paving', length: 0.2, width: 0.1 },
      { id: '600x600', label: '600 × 600 slab', length: 0.6, width: 0.6 },
    ],
    // MOT Type 1: 850 kg bulk bag covers about 5 m² at 100 mm (Mainland Aggregates) = 1.7 t per compacted m³.
    materials: [
      { id: 'type1', name: 'MOT Type 1 sub-base', density: 1.7, compactPct: 0 },
      ...gen(['gravel', 'sandDry', 'soil', 'mulch', 'concrete']),
    ],
    falls: {
      presets: [
        { label: '1:60', ratio: 60, detail: 'normally adequate for domestic paving' },
        { label: '1:40', ratio: 40, detail: '2.5 %, steeper end of the usual range' },
        { label: '1:80', ratio: 80, detail: 'flattest of the usual range' },
      ],
      // Approved Document H (LABC summary); pavingexpert.com drainage guidance.
      buildingNote: 'Approved Document H: lay paving to a fall that avoids ponding. Keep paving at least 150 mm below the damp-proof course.',
    },
    // Approved Document K Table 1.1, private stair.
    stairs: { riser: [0.15, 0.22], going: [0.22, 0.3], twoRG: [0.55, 0.7], code: 'Approved Document K' },
    standards: { readyMix: 'BS 8500 / BS EN 206', structural: 'BS EN 1992', residential: 'the Building Regulations', curing: 'BS 8500' },
    terms: { barChairs: 'Chairs', roadBase: 'Sub-base', agPipe: 'Land drain', premix: 'Bagged concrete', formwork: 'Formwork', mesh: 'Mesh' },
  },
  IE: {
    ...GENERIC,
    code: 'IE', name: 'Ireland', units: 'metric', verified: true, generic: ['blocks', 'order', 'falls', 'stairs'],
    // Roadstone: minimum order 1 m³, minimum-load charge under 6 m³. Step not verified.
    order: { increment: 0.5, truck: 6 },
    // B&Q Ireland: Kilsaran KPRO Crete 25 kg. Its yield (≈0.01 m³) was seen only in a search extract and is well below
    // every other maker's per-kg figure, so the standard 0.000463 m³/kg yield is used (≈0.0116 m³ per bag).
    bags: [{ id: '25kg', label: '25 kg', kg: 25 }],
    // McMahons: A142, A252, A393 at 4.8 × 2.4 m; Ganly's A252 8 mm at 200 mm.
    mesh: ['A252', 'A142', 'A393'].map(id => ({ id, label: `${id} (4.8 × 2.4 m)`, length: 4.8, width: 2.4, lap: 0.225 })),
    // McMahons 6 m bars 10/12/16 mm; Capital Reinforcing 6.0 m stock lengths, BS 4449.
    bars: [10, 12, 16].map(d => ({ id: `${d}mm`, label: `${d} mm (B500)`, d, stock: 6 })),
    trenchMesh: undefined,
    // McMahons: Kilsaran Slane 200 × 100 × 50, 50 per m².
    pavers: [{ id: '200x100', label: '200 × 100 block paving', length: 0.2, width: 0.1 }],
    // Roadstone Clause 804: one tonne covers about 10–12 m² at 50 mm = 1.7–2.0 t per compacted m³ (1.8 used).
    materials: [
      { id: 'c804', name: 'Clause 804 sub-base', density: 1.8, compactPct: 0 },
      ...gen(['gravel', 'sandDry', 'soil', 'mulch', 'concrete']),
    ],
    falls: { ...GENERIC.falls, buildingNote: 'No fixed fall in the guidance we checked. Fall paving away from the house and keep it at least 150 mm below the damp-proof course; check TGD H and C.' },
    stairs: undefined,
    standards: { readyMix: 'I.S. EN 206', structural: 'I.S. EN 1992', residential: 'the Building Regulations (TGDs)', curing: 'I.S. EN 206' },
    terms: { barChairs: 'Chairs', roadBase: 'Sub-base', agPipe: 'Land drain', premix: 'Bagged concrete', formwork: 'Formwork', mesh: 'Mesh' },
  },
  US: {
    ...GENERIC,
    code: 'US', name: 'United States', units: 'imperial', verified: true, generic: [],
    // Concrete Supply Co: "ordered in ½ yard increments"; NRMCA: truck mixers hold 8–12 yd³ (10 used).
    order: { increment: 0.5 * YD3, truck: 10 * YD3 },
    // Quikrete Concrete Mix 1101 data sheet: 80 lb 0.60 ft³, 60 lb 0.45, 50 lb 0.37, 40 lb 0.30.
    bags: [
      { id: '80lb', label: '80 lb', kg: 80 * LB, yieldM3: 0.6 * FT3 },
      { id: '60lb', label: '60 lb', kg: 60 * LB, yieldM3: 0.45 * FT3 },
      { id: '50lb', label: '50 lb', kg: 50 * LB, yieldM3: 0.37 * FT3 },
      { id: '40lb', label: '40 lb', kg: 40 * LB, yieldM3: 0.3 * FT3 },
    ],
    // Home Depot remesh 5 × 10 ft and 42 × 84 in; Ernest Maier 6x6 W1.4/W1.4 in 5 × 10 ft sheets.
    // Lap: one cross-wire spacing plus 2 in = 8 in (ACI 318 plain wire reinforcement splice rule; editable).
    mesh: [
      { id: '6x6-W1.4', label: '6×6 W1.4 (5 × 10 ft)', length: 10 * FT, width: 5 * FT, lap: 8 * IN },
      { id: 'remesh-42x84', label: 'Remesh 42 × 84 in', length: 84 * IN, width: 42 * IN, lap: 8 * IN },
    ],
    // Home Depot: #3 rebar 10 ft, #4 rebar 20 ft (13.36 lb = 0.668 lb/ft, matches nominal ½ in bar).
    bars: [
      { id: '#3', label: '#3 (3/8 in)', d: 9.525, stock: 10 * FT },
      { id: '#4', label: '#4 (1/2 in)', d: 12.7, stock: 20 * FT },
      { id: '#5', label: '#5 (5/8 in)', d: 15.875, stock: 20 * FT },
    ],
    trenchMesh: undefined,
    // Home Depot: Holland 4 × 8 in paver; Pavestone 12 × 12 in step stone.
    pavers: [
      { id: '4x8', label: '4 × 8 in (Holland)', length: 8 * IN, width: 4 * IN },
      { id: '12x12', label: '12 × 12 in', length: 12 * IN, width: 12 * IN },
    ],
    // Lowe's Pavestone 12 L × 4 H × 7 D in; Home Depot RockWall small 11.75 × 4 × 6.75 in.
    blocks: [
      { id: 'std', label: 'Wall block 12 × 4 × 7 in', length: 12 * IN, height: 4 * IN, depth: 7 * IN, cap: 0 },
      { id: 'small', label: 'Wall block 11¾ × 4 × 6¾ in', length: 11.75 * IN, height: 4 * IN, depth: 6.75 * IN, cap: 0 },
    ],
    // hellogravel.com: #57 stone ≈ 2,800 lb/yd³ (1.4 tons); Do it Best: #57 limestone 1.25 tons/yd³.
    materials: [
      { id: '57stone', name: '#57 stone', density: (1.4 * SHORT_TON) / 1000 / YD3, compactPct: 0 },
      { id: '57lime', name: '#57 limestone', density: (1.25 * SHORT_TON) / 1000 / YD3, compactPct: 0 },
      ...gen(['crushed', 'sandDry', 'soil', 'mulch', 'concrete']),
    ],
    falls: {
      presets: [
        { label: '1:20', ratio: 20, detail: '6 in within the first 10 ft away from the house (IRC R401.3)' },
        { label: '1:50', ratio: 50, detail: '2 %, paving within 10 ft of the house (IRC R401.3)' },
        { label: '1:100', ratio: 100, detail: '1 %, flattest common paving fall' },
      ],
      buildingNote: 'IRC R401.3: grade falls at least 6 in within the first 10 ft; paving next to the house at least 2 %.',
    },
    // IRC R311.7.5: riser at most 7¾ in, tread at least 10 in.
    stairs: { riser: [0, 7.75 * IN], going: [10 * IN, 9], code: 'IRC R311.7.5' },
    standards: { readyMix: 'ASTM C94', structural: 'ACI 318', residential: 'the IRC', curing: 'ACI 308' },
    terms: { barChairs: 'Rebar chairs', roadBase: 'Gravel base', agPipe: 'Perforated drain pipe', premix: 'Bagged concrete', formwork: 'Forms', mesh: 'Wire mesh' },
    overrides: {
      slab: { length: 20 * FT, width: 12 * FT, depth: 4 * IN, edgeWidth: 12 * IN, edgeDepth: 12 * IN },
      footing: { length: 40 * FT, width: 16 * IN, depth: 12 * IN },
      pier: { diameter: 12 * IN, depth: 4 * FT },
      steps: { rise: 7 * IN, going: 11 * IN, width: 4 * FT },
      custom: { depth: 4 * IN },
      order: { volume: 3 * YD3 },
      bags: { volume: 0.5 * YD3 },
      sitemix: { volume: 0.5 * YD3 },
      mesh: { length: 20 * FT, width: 12 * FT, edge: 2 * IN, chairSpacing: 3 * FT },
      bars: { runLength: 40 * FT },
      formwork: { length: 20 * FT, width: 12 * FT, depth: 4 * IN },
      falls: { run: 10 * FT },
      pavers: { area: 200 * FT * FT, joint: 0.125 * IN, beddingDepth: 1 * IN, baseDepth: 4 * IN },
      bulk: { length: 10 * FT, width: 10 * FT, depth: 4 * IN },
      retaining: { length: 20 * FT, height: 2 * FT, buried: 4 * IN, drainWidth: 12 * IN },
      weather: { airC: 29, concreteC: 29, windKmh: 16 },
    },
  },
  CA: {
    ...GENERIC,
    code: 'CA', name: 'Canada', units: 'metric', verified: true, generic: [],
    // Home Depot Canada ready-mix: from ½ m³ in ¼ m³ increments, up to 9 m³. Truck 8 m³ (secondary guides 6–8 m³).
    order: { increment: 0.25, truck: 8 },
    // Sakrete Concrete Mix 30 kg PDS: "yields approximately 0.014 m³ (1/2 ft³)".
    bags: [{ id: '30kg', label: '30 kg', kg: 30, yieldM3: 0.014 }],
    // RONA: 10-gauge wire mesh, 6 × 6 in opening, 4 × 8 ft sheet. Lap 8 in (one spacing + 2 in, as US).
    mesh: [{ id: '6x6-10ga', label: '6 × 6 in, 10 ga (4 × 8 ft)', length: 8 * FT, width: 4 * FT, lap: 8 * IN }],
    // Home Depot Canada 15M × 20 ft Grade 400W; RONA 10 mm × 20 ft. CSA G30.18 nominal 10M 11.3 mm, 15M 16.0 mm.
    bars: [
      { id: '10M', label: '10M', d: 11.3, stock: 20 * FT },
      { id: '15M', label: '15M', d: 16.0, stock: 20 * FT },
    ],
    trenchMesh: undefined,
    // Home Depot Canada: Oldcastle Holland 60 mm, 8 × 4 in.
    pavers: [{ id: '8x4', label: '8 × 4 in (Holland 60 mm)', length: 8 * IN, width: 4 * IN }],
    // Home Depot Canada: Oldcastle Beltis 12 × 7 × 4 in.
    blocks: [{ id: 'std', label: 'Wall block 12 × 7 × 4 in', length: 12 * IN, height: 4 * IN, depth: 7 * IN, cap: 0 }],
    // Natural Resources Canada: 1 cubic yard of stone = 1.35 tonnes.
    materials: [
      { id: 'crush', name: '3/4 in crushed stone', density: 1.35 / YD3, compactPct: 0 },
      ...gen(['crushed', 'sandDry', 'soil', 'mulch', 'concrete']),
    ],
    falls: {
      // NBC 9.14.6.1 is qualitative; Toronto infill lot grading: side yards at least 1.5 %.
      presets: [
        { label: '1:50', ratio: 50, detail: '2 %, a common fall away from the house' },
        { label: '1:67', ratio: 66.7, detail: '1.5 %, Toronto infill side-yard minimum' },
        { label: '1:100', ratio: 100, detail: '1 %' },
      ],
      buildingNote: 'NBC 9.14.6.1: grade so water does not collect at or near the building. Check your municipality’s lot-grading rules.',
    },
    // NBC Part 9 table (BC Building Code 2018 copy), private stairs: rise 125–200 mm, run 255–355 mm.
    stairs: { riser: [0.125, 0.2], going: [0.255, 0.355], code: 'NBC Part 9' },
    standards: { readyMix: 'CSA A23.1', structural: 'CSA A23.3', residential: 'NBC Part 9', curing: 'CSA A23.1' },
    terms: { barChairs: 'Rebar chairs', roadBase: 'Granular base', agPipe: 'Weeping tile', premix: 'Bagged concrete', formwork: 'Forms', mesh: 'Wire mesh' },
  },
  XX: { ...GENERIC, code: 'XX', name: 'Another country', units: 'metric', verified: false, generic: ['bags', 'mesh', 'bars', 'pavers', 'blocks', 'materials', 'order', 'falls', 'stairs'] },
};

export const COUNTRY_ORDER: CountryCode[] = ['AU', 'NZ', 'GB', 'IE', 'US', 'CA', 'XX'];

/** Device region (ISO 3166 alpha-2) → supported country, else the generic profile. */
export function countryFromRegion(region: string | null | undefined): CountryCode {
  const r = (region ?? '').toUpperCase();
  if (r === 'UK') return 'GB';
  return (['AU', 'NZ', 'GB', 'IE', 'US', 'CA'] as const).find(c => c === r) ?? 'XX';
}

export const profile = (c: CountryCode | null | undefined): CountryProfile => COUNTRIES[c ?? 'AU'] ?? COUNTRIES.XX;
