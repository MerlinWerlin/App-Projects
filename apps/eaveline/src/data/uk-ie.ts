/**
 * United Kingdom and Ireland. Research 23 Nov 2026.
 * Sheets: Cladco 32/1000 box and 13/3 corrugated installation guide, Eternit Profile 6 fibre cement, Onduline Classic.
 * Tiles: Marley Modern (interlocking), Double Roman, Acme clay plain tile; natural slate coverage table; Cedral Rivendale
 * fibre cement slate (Irish page). Ridge: Marley segmental ridge (merchant listing). Gutters: FloPlast flows (BS EN 12056-3
 * design figures) and Approved Document H Table 2 / TGD H Table 17. Lead: Ecobat / BLM rolled lead.
 * Ireland: TGD H 2016 has its own pitch multipliers; product data is UK data where the same products are sold.
 */
import { DEFAULT_TERMS } from '../core/context';
import { s } from './src';
import type { Country, Drainage, GutterProduct, SheetProfile, Source, TileProduct } from './types';

const ADH = 'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/442889/BR_PDF_AD_H_2015.pdf';
const TGDH = 'https://assets.gov.ie/static/documents/technical-guidance-document-h-drainage-and-waste-water-disposal-2016-173-mb-19d692ac-3.pdf';
const FLOPLAST = 'https://cdn.shopify.com/s/files/1/0222/7290/1216/files/FloPlast-Rainwater-Brochure-2019-RS.pdf';
const CLADCO = 'https://cladco.co.uk/321000-installation';
const CLADCO_CORR = 'https://cladco.co.uk/corrugated-installation';

function sheets(v: (x: Source) => Source): SheetProfile[] {
  return [
    { id: 'box-32-1000', name: 'Box profile 32/1000', coverMm: 1000, minPitchDeg: 4, endLapMm: 250, fixEnd: null, fixMid: null,
      note: 'Fix in the trough with self-drilling, self-sealing screws. Purlins about 1.0 m (0.5 mm sheet) or 1.2 m (0.7 mm). Mastic tape and stitching screws at side laps.',
      brandNote: 'Cladco 32/1000', src: v(s('Profile sheet installation guide', CLADCO)) },
    { id: 'corrugated-13-3', name: 'Corrugated 13/3', coverMm: 990, minPitchDeg: 10, endLapMm: 250, fixEnd: null, fixMid: null,
      note: 'UK 13/3 covers about 990 mm (not 762). Fix through the crest. Purlins about 1.2 m (1.0 m for 0.5 mm sheet).',
      brandNote: 'Cladco 13/3', src: v(s('Profile sheet installation guide', CLADCO_CORR, 'secondary')) },
    { id: 'fibre-cement-p6', name: 'Fibre cement Profile 6', coverMm: 1016, minPitchDeg: 5, endLapMm: 150, fixEnd: 2, fixMid: 2,
      note: 'Two fixings per sheet per purlin. Purlins up to 1375 mm. End lap 150–300 mm and sealing depend on pitch and exposure.',
      brandNote: 'Eternit / Cedral Profile 6 (Big Six)', src: v(s('Fibre cement sheet maker’s guide', 'https://cdn.shopify.com/s/files/1/0242/1053/8577/files/Eternit_Installation_Guide.pdf')) },
    { id: 'bitumen-corrugated', name: 'Bitumen corrugated sheet (2 m)', coverMm: 855, minPitchDeg: 5, endLapMm: 170, fixEnd: null, fixMid: null,
      note: '20 fixings per sheet (25 at 10–15°). From 15°: purlins up to 610 mm, end lap 170 mm. 10–15°: 450 mm purlins, 200 mm lap. 5–10°: full deck, 300 mm lap.',
      brandNote: 'Onduline Classic', src: v(s('Bitumen sheet technical sheet', 'https://www.edecks.co.uk/uploads/manuals/Onduline%20Fixing%20Guide.pdf', 'secondary')) },
  ];
}

function tiles(v: (x: Source) => Source): TileProduct[] {
  return [
    { id: 'concrete-interlocking', name: 'Concrete interlocking tile (large format)', kind: 'tile', coverWidthMm: 292, maxGaugeMm: 345, tilesPerM2: 9.9, minPitchDeg: 17.5,
      note: 'Headlap 75 mm minimum (100 mm for 17.5°; smooth tiles 22.5° at 75 mm). 10.7 per m² at 100 mm headlap.', brandNote: 'Marley Modern',
      src: v(s('Tile maker’s product data', 'https://marley.co.uk/products/concrete-tiles/modern')) },
    { id: 'double-roman', name: 'Double Roman concrete tile', kind: 'tile', coverWidthMm: 300, maxGaugeMm: 345, tilesPerM2: 9.7, minPitchDeg: 22.5,
      note: '25° at 75 mm headlap, 22.5° at 100 mm. 10.4 per m² at 100 mm headlap.', src: v(s('Tile maker’s product data', 'https://www.marley.co.uk/products/concrete-tiles/double-roman')) },
    { id: 'plain-clay', name: 'Clay plain tile 265 × 165', kind: 'slate', coverWidthMm: 165, maxGaugeMm: 100, tilesPerM2: 60, lengthMm: 265, headlapMm: 65, minPitchDeg: 30,
      note: 'Double-lap: gauge = (length − headlap) ÷ 2. Many plain tiles need 35°.', brandNote: 'Marley Acme', src: v(s('Tile maker’s product data', 'https://www.marley.co.uk/products/clay-tiles/acme-single-camber')) },
    { id: 'slate-500x250', name: 'Natural slate 500 × 250', kind: 'slate', coverWidthMm: 255, maxGaugeMm: 200, tilesPerM2: 19.6, lengthMm: 500, headlapMm: 100, minPitchDeg: 27.5,
      note: '19.6 per m² at 100 mm headlap with 5 mm joints. Headlap rises as pitch falls (110 mm at 27.5° in severe exposure).',
      src: v(s('Slate headlap and coverage table', 'https://cdn.shopify.com/s/files/1/0242/1053/8577/files/Headlaps_Coverage_1.pdf', 'secondary')) },
    { id: 'fc-slate-600x300', name: 'Fibre cement slate 600 × 300', kind: 'slate', coverWidthMm: 300, maxGaugeMm: 250, tilesPerM2: 13.4, lengthMm: 600, headlapMm: 100, minPitchDeg: 25,
      note: '13.4 per m² at 250 mm gauge.', brandNote: 'Cedral Rivendale', src: s('Fibre cement slate maker’s page (Ireland)', 'https://cedral.world/en-ie/roofing/slates/rivendale') },
  ];
}

/** FloPlast BS EN 12056-3 design flows, end outlet, laid level (the conservative case). */
function gutters(v: (x: Source) => Source, adh: Source): GutterProduct[] {
  const fp = (verified: 'primary' | 'secondary') => v(s('Rainwater system brochure (BS EN 12056-3 flows)', FLOPLAST, verified));
  return [
    { id: 'half-round-112', name: 'Half-round 112 mm, 68 mm outlet', capacityLps: 0.82, stockLengthsMm: [2000, 3000, 4000], note: 'End outlet, level. Centre outlet about 1.62 L/s.', src: fp('primary') },
    { id: 'square-114', name: 'Square 114 mm, 65 mm outlet', capacityLps: 1.53, stockLengthsMm: [2000, 3000, 4000], note: 'End outlet, level. Centre outlet about 3.06 L/s.', src: fp('primary') },
    { id: 'deep-115', name: 'Deep-flow 115 mm, 68 mm outlet', capacityLps: 1.84, stockLengthsMm: [4000], note: 'End outlet, level. Centre outlet about 3.42 L/s.', src: fp('primary') },
    { id: 'ogee-110', name: 'Ogee 110 mm', capacityLps: 2.16, stockLengthsMm: [4000], note: 'End outlet, level. Row labels in the brochure were matched by order.', src: fp('secondary') },
    { id: 'adh-75', name: 'Half-round 75 mm, 50 mm outlet (AD H table)', capacityLps: 0.38, maxAreaM2: 18, stockLengthsMm: [], src: adh },
    { id: 'adh-100', name: 'Half-round 100 mm, 63 mm outlet (AD H table)', capacityLps: 0.78, maxAreaM2: 37, stockLengthsMm: [], src: adh },
    { id: 'adh-115', name: 'Half-round 115 mm, 63 mm outlet (AD H table)', capacityLps: 1.11, maxAreaM2: 53, stockLengthsMm: [], src: adh },
    { id: 'adh-125', name: 'Half-round 125 mm, 75 mm outlet (AD H table)', capacityLps: 1.37, maxAreaM2: 65, stockLengthsMm: [], src: adh },
    { id: 'adh-150', name: 'Half-round 150 mm, 89 mm outlet (AD H table)', capacityLps: 2.16, maxAreaM2: 103, stockLengthsMm: [], src: adh },
  ];
}

const downpipes = (v: (x: Source) => Source) => [
  { id: 'round-68', name: 'Round 68 mm', capacityLps: null, stockLengthsMm: [2500, 4000, 5500], src: v(s('Rainwater system brochure', FLOPLAST)) },
  { id: 'square-65', name: 'Square 65 mm', capacityLps: null, stockLengthsMm: [2500, 4000, 5500], src: v(s('Rainwater system brochure', FLOPLAST)) },
  { id: 'round-80', name: 'Round 80 mm', capacityLps: null, stockLengthsMm: [4000], src: v(s('Rainwater system brochure', FLOPLAST, 'secondary')) },
];

/** Piecewise-linear interpolation of a pitch multiplier table (0° → 1). Above 70° the elevation rule applies. */
export function interp(table: [number, number][], p: number): number {
  const t = [...table].sort((a, b) => a[0] - b[0]);
  if (p <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i]!;
    const [x0, y0] = t[i - 1]!;
    if (p <= x1) return y0 + ((y1 - y0) * (p - x0)) / (x1 - x0);
  }
  return t[t.length - 1]![1];
}

const ukDrainage = (adh: Source): Drainage => ({
  mode: 'flow',
  method: 'Approved Document H (England) effective area at 75 mm/h, outlet flow from the gutter table or maker’s BS EN 12056-3 figures',
  // AD H Table 1: 30° ×1.29, 45° ×1.50, 60° ×1.87 — exactly plan × (1 + ½·tan θ).
  slopeFactor: p => 1 + 0.5 * Math.tan((Math.min(Math.max(p, 0), 70) * Math.PI) / 180),
  slopeFactorNote: 'Approved Document H Table 1 effective area: plan area × 1.29 at 30°, 1.50 at 45°, 1.87 at 60° (plan × (1 + ½ tan θ)). Over 70°: half the elevation.',
  fallRatio: 350, fallNote: 'AD H tables assume gutters laid level, falling towards the outlet. Gutter makers recommend about 1:350 (some rate at 1:600).', fallSrc: s('Gutter maker’s guidance', 'https://media.wickes.co.uk/is/content/wickes/GPID_1000248165_TECH_1', 'secondary'),
  designIntensityMmPerHr: 75,
  intensityNote: 'Approved Document H design intensity for eaves gutters works out at 0.021 L/s per m² (about 75 mm/h); Diagram 1 maps site values.',
  cities: [],
  maxDownpipeSpacingMm: null,
  src: adh,
});

const ieDrainage = (tgd: Source): Drainage => ({
  ...ukDrainage(tgd),
  method: 'TGD H (Ireland) effective area at 75 mm/h, outlet flow from Table 17 or the maker’s BS EN 12056-3 figures',
  slopeFactor: p => interp([[0, 1], [30, 1.15], [45, 1.4], [60, 2.0], [70, 2.0]], Math.min(Math.max(p, 0), 70)),
  slopeFactorNote: 'TGD H Table 16 effective area: plan × 1.15 at 30°, 1.40 at 45°, 2.00 at 60° (straight-line between). Add half the area of any wall draining onto the roof.',
  intensityNote: 'TGD H 1.1.3.2: rainfall intensity is taken as 75 mm per hour for roof drainage design.',
  fallNote: 'TGD H: gutters laid with any fall towards the nearest outlet (Table 17 assumes level). Gutter makers recommend about 1:350.',
});

const ukTerms = { ...DEFAULT_TERMS, barge: 'verge', underlay: 'underlay' };

const adhSrc = s('Approved Document H (2015)', ADH);
export const GB: Country = {
  code: 'GB', name: 'United Kingdom', guided: true, sys: 'metric', pitchStyle: 'deg', currency: 'GBP', spelling: 'en-GB',
  terms: ukTerms,
  standards: [
    { topic: 'Tile and slate roofing', name: 'BS 5534:2014+A2:2018 Slating and tiling for pitched roofs and vertical cladding', src: s('BSI', 'https://knowledge.bsigroup.com/products/slating-and-tiling-for-pitched-roofs-and-vertical-cladding-code-of-practice?version=standard') },
    { topic: 'Tile and slate roofing', name: 'BS 8000-6 Workmanship – Slating and tiling of roofs and walls', src: s('BSI', 'https://knowledge.bsigroup.com/products/workmanship-on-construction-sites-slating-and-tiling-of-roofs-and-walls-code-of-practice') },
    { topic: 'Roof drainage', name: 'Approved Document H (2015) H3 Rainwater drainage (England)', src: adhSrc },
    { topic: 'Roof drainage', name: 'BS EN 12056-3:2000 Gravity drainage – Roof drainage, layout and calculation', src: adhSrc },
    { topic: 'Lead', name: 'BS EN 12588 Rolled lead sheet (Code 4 = 1.80 mm, Code 5 = 2.24 mm)', src: s('BSI', 'https://knowledge.bsigroup.com/products/lead-and-lead-alloys-rolled-lead-sheet-for-building-purposes') },
    { topic: 'Working at height', name: 'Work at Height Regulations 2005; HSG33 Health and safety in roof work; CDM 2015', src: s('HSE', 'https://www.hse.gov.uk/construction/safetytopics/roofwork.htm') },
  ],
  safety: {
    regulator: 'HSE',
    text: 'Plan roof work under the Work at Height Regulations 2005 and CDM 2015 (HSG33): treat every roof as fragile until a competent person says otherwise, and provide edge protection.',
    src: s('HSE', 'https://www.hse.gov.uk/construction/safetytopics/roofwork.htm'),
  },
  sheets: sheets(x => x),
  tiles: tiles(x => x),
  shingles: [],
  caps: [{ id: 'ridge-segmental', name: 'Concrete half-round ridge (457 mm)', kind: 'ridgeTile', perMetre: 2.22,
    src: s('Builders’ merchant listing', 'https://www.travisperkins.co.uk/marley-segmental-ridge-roofing-tile-smooth-grey-pallet-of-120/p/817188', 'secondary') }],
  gutters: gutters(x => x, adhSrc),
  downpipes: downpipes(x => x),
  drainage: ukDrainage(adhSrc),
  battenStockMm: [3900, 4200, 4500, 4800, 5100],
  trimStockMm: [3000, 6000],
  defaults: { overhangMm: 50, maxSheetMm: 7000, purlinSpacingMm: 1200, eavesSetOutMm: 320, topSetOutMm: 40, wastePct: 5, trimStockMm: 3000, trimLapMm: 100, battenStockMm: 4800, screwBox: 100 },
  fixingsNote: {
    text: 'BS 5534:2014: mortar alone is no longer enough. Ridges, hips and verges need a mechanical fix, perimeter tiles at least two fixings, and the tile fixing schedule comes from a wind uplift calculation.',
    src: s('Tile maker’s BS 5534 guide', 'https://www.marley.co.uk/blog/what-are-the-fixing-requirements-of-bs-5534', 'secondary'),
  },
  notes: [
    '“Verge” is the gable edge of a tiled roof (the bargeboard is the timber).',
    'Battens: 25 × 38 mm for supports up to 450 mm centres, 25 × 50 mm up to 600 mm (interlocking tiles).',
    'Approved Document H values are England’s; Wales, Scotland and Northern Ireland publish their own guidance.',
  ],
  gaps: [
    'Metal sheet fixings per sheet per purlin are not published for box and 13/3 profiles: enter the pattern from the supplier.',
    'Downpipe bore areas are not published; capacity is taken from the gutter outlet.',
  ],
};

const tgd = s('Technical Guidance Document H (2016)', TGDH);
const ieV = (x: Source): Source => ({ ...x, verified: x.verified === 'primary' ? 'secondary' : x.verified, label: `${x.label} (UK product data)` });
export const IE: Country = {
  code: 'IE', name: 'Ireland', guided: true, sys: 'metric', pitchStyle: 'deg', currency: 'EUR', spelling: 'en-GB',
  terms: { ...DEFAULT_TERMS, underlay: 'underlay' },
  standards: [
    { topic: 'Tile and slate roofing', name: 'S.R. 82:2017 Slating and tiling – Code of practice (NSAI)', src: s('NSAI', 'https://www.nsai.ie/about/news/revised-code-of-practice-for-slating-and-tiling/') },
    { topic: 'Roof drainage', name: 'Technical Guidance Document H (2016) Drainage and Waste Water Disposal', src: tgd },
    { topic: 'Roof drainage', name: 'I.S. EN 12056-3:2000 Gravity drainage – Roof drainage, layout and calculation', src: tgd },
    { topic: 'Working at height', name: 'Safety, Health and Welfare at Work (General Application) Regulations 2007, Part 4 Work at Height', src: s('Irish Statute Book', 'https://www.irishstatutebook.ie/eli/2007/si/299/made/en/print') },
  ],
  safety: {
    regulator: 'Health and Safety Authority (HSA)',
    text: 'Roof work at height falls under Part 4 (Work at Height) of the 2007 General Application Regulations: plan it, use edge protection and treat fragile surfaces with care.',
    src: s('Irish Statute Book', 'https://www.irishstatutebook.ie/eli/2007/si/299/made/en/print'),
  },
  sheets: sheets(ieV),
  tiles: tiles(ieV),
  shingles: [],
  caps: [],
  gutters: gutters(ieV, tgd),
  downpipes: downpipes(ieV),
  drainage: ieDrainage(tgd),
  battenStockMm: [4800],
  trimStockMm: [3000, 6000],
  defaults: { overhangMm: 50, maxSheetMm: 7000, purlinSpacingMm: 1200, eavesSetOutMm: 320, topSetOutMm: 40, wastePct: 5, trimStockMm: 3000, trimLapMm: 100, battenStockMm: 4800, screwBox: 100 },
  fixingsNote: null,
  notes: [
    'TGD H uses different pitch multipliers from England (30° ×1.15, 45° ×1.40, 60° ×2.00) but the same gutter table.',
    'S.R. 82 batten sizes (47 mm wide) differ from BS 5534: do not reuse UK batten sizes.',
  ],
  gaps: [
    'Tile, sheet and gutter values are UK product data where the same products are sold in Ireland; Irish ranges may differ.',
    'S.R. 82 headlap and fixing tables were not verified; batten lengths are starting values.',
  ],
};
