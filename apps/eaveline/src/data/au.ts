/**
 * Australia. Research 23 Nov 2026 (cited per value).
 * Sheet profiles: Lysaght data sheets / Roofing & Walling Installation Manual (CUSTOM ORB = corrugated, TRIMDEK = 5-rib,
 * SPANDEK = wide-pan, KLIP-LOK 700 = concealed-fix, LONGLINE 305 = standing seam). Stramit, Metroll and Fielders roll
 * equivalent profiles. Tiles: Monier (Atura, Marseille, Urban) and Bristile data. Gutters: Lysaght effective areas
 * (Quad, Sheerline, Trimline) per AS/NZS 3500.3. Rainfall: Lysaght Table 6.2.1 extract of NCC values.
 */
import { DEFAULT_TERMS } from '../core/context';
import { s } from './src';
import type { Country } from './types';

const MANUAL = 'https://lysaght.com/document/dcs-download/1690';
const manual = s('Sheet roofing installation manual (AU maker)', MANUAL);
const lysaghtRain = (city: string, mmPerHr: number, hundred: number) => ({
  name: city, mmPerHr, basis: `5-minute, 20-year ARI (100-year: ${hundred} mm/h)`, src: s('NCC design rainfall table, via a roofing maker’s manual', MANUAL, 'secondary'),
});

export const AU: Country = {
  code: 'AU', name: 'Australia', guided: true, sys: 'metric', pitchStyle: 'deg', currency: 'AUD', spelling: 'en-AU',
  terms: { ...DEFAULT_TERMS, ridge: 'ridge capping', underlay: 'sarking' },
  standards: [
    { topic: 'Metal roofing', name: 'AS 1562.1:2018 Design and installation of sheet roof and wall cladding – Metal', src: manual },
    { topic: 'Metal roofing', name: 'SA HB 39:2015 Installation code for metal roof and wall cladding', src: manual },
    { topic: 'Tile roofing', name: 'AS 2050:2018 Installation of roof tiles', src: s('Standards Australia', 'https://store.standards.org.au/product/as-2050-2018') },
    { topic: 'Tile roofing', name: 'NCC Housing Provisions Part 7.3 Roof tiles and shingles', src: s('ABCB', 'https://abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/7-roof-and-wall-cladding/part-73-roof-tiles-and-shingles') },
    { topic: 'Roof drainage', name: 'AS/NZS 3500.3:2021 Plumbing and drainage – Stormwater drainage', src: manual },
    { topic: 'Roof drainage', name: 'AS/NZS 2179.1:2014 Rainwater goods, accessories and fasteners', src: manual },
    { topic: 'Roof drainage', name: 'HB 114:1998 Guidelines for the design of eaves and box gutters', src: manual },
    { topic: 'Wind and fixing', name: 'AS/NZS 1170.2:2021 Wind actions; AS 3566.1 Self-drilling screws', src: manual },
    { topic: 'Bushfire', name: 'AS 3959:2018 Construction of buildings in bushfire-prone areas', src: manual },
    { topic: 'Working at heights', name: 'Model Code of Practice: Managing the risk of falls at workplaces', src: s('Safe Work Australia', 'https://www.safeworkaustralia.gov.au/sites/default/files/2022-10/model-cop-managing-the-risk-of-falls-at-workplaces%2021102022.docx') },
  ],
  safety: {
    regulator: 'Safe Work Australia and your state or territory WHS regulator',
    text: 'Construction work with a risk of falling more than 2 m is high-risk construction work and needs a Safe Work Method Statement before work starts. Falls must be managed at any height.',
    src: s('Safe Work Australia', 'https://safeworkaustralia.gov.au/duties-tool/construction/hazards-information/high-risk-construction-work-requiring-swms'),
  },
  sheets: [
    { id: 'corrugated', name: 'Corrugated (wave profile)', coverMm: 762, minPitchDeg: 5, endLapMm: 150, fixEnd: 5, fixMid: 3,
      note: 'Side lap 1½ corrugations. Crest-fixed. End laps 200 mm below 15°, 150 mm from 15°.', brandNote: 'Lysaght CUSTOM ORB, Stramit Corrugated',
      src: s('Maker’s corrugated roofing data sheet', 'https://cdn.dcs.lysaght.com/download/custom-orb-and-custom-blue-orb-brochure') },
    { id: 'trapezoidal-5rib', name: '5-rib trapezoidal', coverMm: 762, minPitchDeg: 2, endLapMm: 150, fixEnd: 4, fixMid: 4,
      note: 'Crest-fixed every rib. Turn sheet ends up/down at 5° or less.', brandNote: 'Lysaght TRIMDEK, Stramit Monoclad',
      src: s('Maker’s 5-rib data sheet', 'https://lysaght.com/document/dcs-download/3709') },
    { id: 'wide-pan', name: 'Wide-pan trapezoidal (700 mm)', coverMm: 700, minPitchDeg: 2, endLapMm: 150, fixEnd: 4, fixMid: 3,
      brandNote: 'Lysaght SPANDEK', src: s('Maker’s wide-pan data sheet', 'https://lysaght.com/document/dcs-download/3707') },
    { id: 'concealed-700', name: 'Concealed-fix clip-lock (700 mm)', coverMm: 700, minPitchDeg: 1, endLapMm: null, fixEnd: 1, fixMid: 1, edgeClip: true,
      note: 'Fixed with one clip per sheet per support (counted here as clips). Avoid end laps.', brandNote: 'Lysaght KLIP-LOK 700',
      src: s('Maker’s concealed-fix data sheet', 'https://lysaght.com/document/dcs-download/3710') },
    { id: 'standing-seam-305', name: 'Standing seam, narrow pan (305 mm)', coverMm: 305, minPitchDeg: 1, endLapMm: null, fixEnd: 1, fixMid: 1, edgeClip: true,
      note: 'Concealed clips, one screw per clip (counted as clips).', brandNote: 'Lysaght LONGLINE 305',
      src: s('Maker’s standing seam page', 'https://www.lysaght.com/products/longline-305', 'secondary') },
  ],
  tiles: [
    { id: 'concrete-profiled', name: 'Concrete profiled tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 9.26, minPitchDeg: 15,
      note: '15° minimum with sarking. Batten gauge is not published on the data sheet: enter it from the maker’s set-out.', brandNote: 'Monier Atura / Bristile',
      src: s('Concrete tile data sheet', 'https://archipro.co.nz/assets/MemberUploads/Concreterooftile-2020.pdf') },
    { id: 'concrete-flat', name: 'Concrete flat tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 9.26, minPitchDeg: 20,
      note: '20° minimum with sarking.', src: s('Concrete tile data sheet', 'https://archipro.co.nz/assets/MemberUploads/Concreterooftile-2020.pdf') },
    { id: 'terracotta-marseille', name: 'Terracotta tile (Marseille pattern)', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 13, minPitchDeg: 15,
      note: '15° with sarking, 20° without.', brandNote: 'Monier Marseille',
      src: s('Terracotta tile data sheet', 'https://www.csrassetlibrary.com/celum/2018_yConnect_Document_Monier%20Marseille%20Data%20Sheet.pdf') },
    { id: 'terracotta-shingle', name: 'Terracotta shingle tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 13, minPitchDeg: 18,
      note: 'Must be sarked.', brandNote: 'Monier Urban', src: s('Terracotta tile page', 'https://www.monier.com.au/roof-tiles/terracotta/urban/') },
  ],
  shingles: [],
  caps: [
    { id: 'tile-ridge', name: 'Tile ridge cap (510 mm piece)', kind: 'ridgeTile', effectiveLengthMm: undefined,
      src: s('Terracotta tile data sheet (piece length only; laid length varies)', 'https://www.csrassetlibrary.com/celum/2018_yConnect_Document_Monier%20Marseille%20Data%20Sheet.pdf', 'unverified') },
  ],
  gutters: [
    { id: 'quad-115', name: 'Quad 115 mm hi-front (unslotted)', capacityLps: null, effectiveAreaMm2: 5809, stockLengthsMm: [6000],
      note: 'Worked example in the maker’s manual: 37 m² catchment per downpipe at 151 mm/h.', src: manual },
    { id: 'quad-115-slotted', name: 'Quad 115 mm hi-front (slotted)', capacityLps: null, effectiveAreaMm2: 5225, stockLengthsMm: [6000], src: manual },
    { id: 'square-front', name: 'Square-front (unslotted)', capacityLps: null, effectiveAreaMm2: 7800, stockLengthsMm: [], src: manual },
    { id: 'square-front-slotted', name: 'Square-front (slotted)', capacityLps: null, effectiveAreaMm2: 6244, stockLengthsMm: [], src: manual },
    { id: 'square-line', name: 'Square-line (unslotted)', capacityLps: null, effectiveAreaMm2: 8370, stockLengthsMm: [], src: manual },
    { id: 'square-line-slotted', name: 'Square-line (slotted)', capacityLps: null, effectiveAreaMm2: 7600, stockLengthsMm: [], src: manual },
  ],
  downpipes: [
    { id: 'round-90', name: 'Round 90 mm', capacityLps: null, stockLengthsMm: [], src: manual },
    { id: 'round-100', name: 'Round 100 mm', capacityLps: null, stockLengthsMm: [], src: manual },
    { id: 'rect-100x50', name: 'Rectangular 100 × 50 mm', capacityLps: null, stockLengthsMm: [], src: manual },
    { id: 'rect-100x75', name: 'Rectangular 100 × 75 mm', capacityLps: null, stockLengthsMm: [], src: manual },
  ],
  drainage: {
    mode: 'areaPerDownpipe',
    areaPerDownpipeExample: { m2: 37, text: 'Read it from the AS/NZS 3500.3 chart for your gutter and rainfall. Example only: a quad 115 mm hi-front gutter (5809 mm²) at 151 mm/h gives 37 m² per downpipe.' },
    method: 'AS/NZS 3500.3 eaves gutter method (catchment per downpipe read from the standard’s chart for your gutter and rainfall)',
    slopeFactor: p => 1 + 0.01 * Math.min(Math.max(p, 0), 36),
    slopeFactorNote: 'Plan area plus about 1% per degree of pitch, up to 36° (roofing maker’s rule of thumb for AS/NZS 3500.3).',
    fallRatio: 500, fallNote: '1:500 minimum for eaves gutters (the gradient AS/NZS 3500.3 design charts assume).', fallSrc: manual,
    designIntensityMmPerHr: null,
    intensityNote: 'Use the 5-minute, 20-year ARI intensity for eaves gutters (100-year for box gutters). Bureau of Meteorology design rainfall (IFD) data for the exact site may differ from these table values.',
    cities: [
      lysaghtRain('Adelaide', 124, 184), lysaghtRain('Alice Springs', 166, 239), lysaghtRain('Brisbane', 234, 305), lysaghtRain('Cairns', 229, 278),
      lysaghtRain('Canberra', 143, 193), lysaghtRain('Darwin', 233, 274), lysaghtRain('Hobart', 85, 116), lysaghtRain('Melbourne', 132, 187),
      lysaghtRain('Newcastle', 226, 316), lysaghtRain('Perth', 130, 172), lysaghtRain('Sydney', 200, 262), lysaghtRain('Townsville', 235, 300),
    ],
    maxDownpipeSpacingMm: null,
    src: manual,
  },
  battenStockMm: [4800, 5400, 6000],
  trimStockMm: [3000, 6000, 8000],
  defaults: { overhangMm: 50, maxSheetMm: 12000, purlinSpacingMm: 900, eavesSetOutMm: 320, topSetOutMm: 40, wastePct: 5, trimStockMm: 6000, trimLapMm: 150, battenStockMm: 6000, screwBox: 500 },
  fixingsNote: {
    text: 'Crest-fix pierce-fixed roofing: into timber, 12-11 × 50 Type 17 hex-head screws; into steel battens up to 1 mm, M6-11 × 50 roofing screws; into steel up to 3 mm, 12-14 × 35 self-drilling. Class 3 or 4 to AS 3566 depending on the environment.',
    src: s('Maker’s corrugated roofing data sheet', 'https://cdn.dcs.lysaght.com/download/custom-orb-and-custom-blue-orb-brochure'),
  },
  notes: [
    'End laps on metal sheet: 200 mm below 15° (sealed), 150 mm from 15°.',
    'Tile minimum pitches assume sarking; without it most profiles need 20°.',
    'Bushfire-prone areas: AS 3959 changes sarking, ember screening and materials.',
  ],
  gaps: [
    'Tile batten gauges and ridge caps per metre are not published on tile data sheets: enter them from the maker’s set-out.',
    'Batten, flashing and downpipe stock lengths vary by supplier: starting values only.',
    'Downpipe capacity in L/s is not tabulated; enter the catchment per downpipe from the AS/NZS 3500.3 chart.',
    'Rainfall values are older NCC table values; BoM 2016 IFDs for the site may differ.',
  ],
};
