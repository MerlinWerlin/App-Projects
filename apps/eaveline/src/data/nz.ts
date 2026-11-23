/**
 * New Zealand. Research 23 Nov 2026.
 * Sheet profiles: Dimond (Corrugate, Dimondek 630), Roofing Industries (Trimrib), Eurostyle standing seam; minimum pitches
 * and end laps from the NZ Metal Roof and Wall Cladding Code of Practice (NZMRM COP v26.06). Tiles: Monier NZ (Hacienda,
 * Horizon, Marseille), Gerard Calibre pressed-metal tiles. Spouting areas: Steel & Tube guide. Downpipes and rainfall:
 * NZBC E1/AS1 Table 5 and Appendix A (amendment 11 copy).
 */
import { DEFAULT_TERMS } from '../core/context';
import { s } from './src';
import type { Country } from './types';

const E1 = 'https://www.building.govt.nz/assets/Uploads/building-code-compliance/e-moisture/e1-surface-water/asvm/e1-surface-water-1st-edition-amendment11.pdf';
const e1 = (v: 'primary' | 'secondary' = 'primary') => s('NZBC Acceptable Solution E1/AS1 Surface Water', E1, v);
const COP = s('NZ Metal Roof and Wall Cladding Code of Practice', 'https://www.metalroofing.org.nz/sites/default/files/RoofingCOP_v26-06_2026-06-01.pdf');
const SPOUT = 'https://steelandtube.co.nz/sites/default/files/attachments/Spouting_%26_Fascia_Guide_North_Island_Feb14.pdf';
const rain = (name: string, mmPerHr: number, two: number) => ({ name, mmPerHr, basis: `10-minute, 10% AEP (2% AEP: ${two} mm/h)`, src: e1('secondary') });
const t5 = (a: number, b: number, c: number, d: number) => [
  { maxPitchDeg: 25, m2: a }, { maxPitchDeg: 35, m2: b }, { maxPitchDeg: 45, m2: c }, { maxPitchDeg: 55, m2: d },
];

export const NZ: Country = {
  code: 'NZ', name: 'New Zealand', guided: true, sys: 'metric', pitchStyle: 'deg', currency: 'NZD', spelling: 'en-AU',
  terms: { ...DEFAULT_TERMS, gutter: 'spouting', gutters: 'spouting' },
  standards: [
    { topic: 'Metal roofing', name: 'NZ Metal Roof and Wall Cladding Code of Practice (v26.06, June 2026)', src: COP },
    { topic: 'Metal roofing', name: 'NZBC Acceptable Solution E2/AS1 External Moisture', src: s('MBIE Building Performance', 'https://www.building.govt.nz/building-code-compliance/e-moisture/e2-external-moisture/', 'secondary') },
    { topic: 'Tile roofing', name: 'AS 2050:2018 Installation of roof tiles (cited by the NZ Building Code)', src: s('MBIE Codehub', 'https://codehub.building.govt.nz/resources/as-20502018') },
    { topic: 'Roof drainage', name: 'NZBC Acceptable Solution E1/AS1 Surface Water (gutters, downpipes Table 5, rainfall Appendix A)', src: e1() },
    { topic: 'Roof drainage', name: 'Metal roofing COP Section 5 Roof drainage (50-year ARI, NIWA HIRDS)', src: s('NZMRM COP', 'https://metalroofing.org.nz/cop/roof-drainage/roof-drainage-design') },
    { topic: 'Framing', name: 'NZS 3604 Timber-framed buildings (purlins, battens, wind zones)', src: s('Tile maker technical statement', 'https://gerardroofs.co.nz/media/uljgyawd/gerard-roofs-product-technical-statement-1-09-23.pdf', 'secondary') },
    { topic: 'Working at height', name: 'WorkSafe Best Practice Guidelines for Working at Height in New Zealand', src: s('WorkSafe NZ', 'https://www.worksafe.govt.nz/dmsdocument/500-best-practice-guidelines-for-working-at-height-in-new-zealand') },
  ],
  safety: {
    regulator: 'WorkSafe New Zealand (Health and Safety at Work Act 2015)',
    text: 'There is no minimum height: fall risks must be managed at any height. Work with a risk of falling 5 m or more is notifiable to WorkSafe before it starts (some exclusions).',
    src: s('WorkSafe NZ', 'https://worksafe.govt.nz/notifications/hazardous-work/', 'secondary'),
  },
  sheets: [
    { id: 'corrugated', name: 'Corrugated (wave profile)', coverMm: 762, minPitchDeg: 8, endLapMm: 150, fixEnd: 5, fixMid: 5,
      note: '8° minimum (10° if end-lapped). Load tables assume 5 fasteners per sheet per purlin; 3 where wind allows. End laps 150 mm, 200 mm below 10°.',
      brandNote: 'Dimond Corrugate', src: s('Maker’s corrugate data sheet', 'https://pimstorageaueprod.blob.core.windows.net/placemakers/media-assets/1016299_FBDI_24_Book-Dimond-Technical-Manual_V07.01.1119-2.1.4.7-Corrugate-Data-Sheet_WEB.pdf') },
    { id: 'trapezoidal-5rib', name: '5-rib trapezoidal', coverMm: 760, minPitchDeg: 3, endLapMm: 150, fixEnd: 6, fixMid: 3,
      note: 'Every crest at ridge, gutter and edges; side laps plus every second crest elsewhere (counts derived from the pattern).',
      brandNote: 'Roofing Industries Trimrib', src: s('Maker’s 5-rib data sheet', 'https://www.eboss.co.nz/assets/literature/198/25473/Trimrib-17.pdf') },
    { id: 'concealed-630', name: 'Concealed-fix trough (630 mm)', coverMm: 630, minPitchDeg: 3, endLapMm: null, fixEnd: null, fixMid: null,
      note: 'One clip per rib per purlin. Run to length, so no end laps.', brandNote: 'Dimond Dimondek 630',
      src: s('Maker’s concealed-fix page', 'https://www.dimond.co.nz/products/dimondek-630') },
  ],
  tiles: [
    { id: 'concrete-profiled', name: 'Concrete profiled tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 11, minPitchDeg: 15,
      note: '15° with underlay. Batten gauge: from the maker’s design guide.', brandNote: 'Monier Hacienda', src: s('Tile technical statement', 'https://www.eboss.co.nz/assets/literature/117/15620/NZ_Hacienda_PTS_0822_Final.pdf') },
    { id: 'concrete-flat', name: 'Concrete flat tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 11, minPitchDeg: 25,
      note: '25° minimum; maximum rafter length depends on pitch (5.5 m at 27°, 7 m at 30°).', brandNote: 'Monier Horizon', src: s('Tile technical statement', 'https://www.eboss.co.nz/assets/literature/117/15425/NZ_Horizon_PTS_0722_Final.pdf') },
    { id: 'terracotta-marseille', name: 'Terracotta tile (Marseille pattern)', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 12.6, minPitchDeg: 20,
      note: 'Underlay below 25°.', brandNote: 'Monier Marseille NZ', src: s('Tile technical statement', 'https://www.eboss.co.nz/assets/literature/117/15866/NZ_Marseille_PTS_0822_Final.pdf') },
    { id: 'pressed-metal', name: 'Pressed metal tile panel (stone chip)', kind: 'tile', coverWidthMm: 1250, maxGaugeMm: 252, tilesPerM2: 3.2, minPitchDeg: 10, fixingsPerTile: 5,
      note: 'Battens at 252 mm centres, first batten 390 mm. 0.32 m² per panel. 5 fasteners per panel up to extra-high wind zone.', brandNote: 'Gerard Calibre',
      src: s('Maker’s specification', 'https://www.gerardroofs.co.nz/media/humgslpx/gerard-specification-calibre-on-battens-2026.pdf') },
  ],
  shingles: [],
  caps: [],
  gutters: [
    { id: 'quad', name: 'Quad spouting', capacityLps: null, effectiveAreaMm2: 6850, stockLengthsMm: [], src: s('Spouting guide', SPOUT, 'unverified') },
    { id: 'quarter-round', name: 'Large quarter-round spouting', capacityLps: null, effectiveAreaMm2: 7500, stockLengthsMm: [], src: s('Spouting guide', SPOUT, 'unverified') },
    { id: 'box-high', name: 'High-front box spouting', capacityLps: null, effectiveAreaMm2: 6600, stockLengthsMm: [], src: s('Spouting guide', SPOUT, 'unverified') },
    { id: 'box-large', name: 'Large box spouting', capacityLps: null, effectiveAreaMm2: 10000, stockLengthsMm: [], src: s('Spouting guide', SPOUT, 'unverified') },
  ],
  downpipes: [
    { id: 'round-63', name: 'Round 63 mm', capacityLps: null, maxAreaByPitch: t5(60, 50, 40, 35), stockLengthsMm: [], src: e1() },
    { id: 'round-74', name: 'Round 74 mm', capacityLps: null, maxAreaByPitch: t5(85, 70, 60, 50), stockLengthsMm: [], src: e1() },
    { id: 'round-100', name: 'Round 100 mm', capacityLps: null, maxAreaByPitch: t5(155, 130, 110, 90), stockLengthsMm: [], src: e1() },
    { id: 'round-150', name: 'Round 150 mm', capacityLps: null, maxAreaByPitch: t5(350, 290, 250, 200), stockLengthsMm: [], src: e1() },
    { id: 'rect-65x50', name: 'Rectangular 65 × 50 mm', capacityLps: null, maxAreaByPitch: t5(60, 50, 40, 35), stockLengthsMm: [], src: e1() },
    { id: 'rect-100x50', name: 'Rectangular 100 × 50 mm', capacityLps: null, maxAreaByPitch: t5(100, 80, 70, 60), stockLengthsMm: [], src: e1() },
    { id: 'square-75', name: 'Square 75 × 75 mm', capacityLps: null, maxAreaByPitch: t5(110, 90, 80, 65), stockLengthsMm: [], src: e1() },
    { id: 'rect-100x75', name: 'Rectangular 100 × 75 mm', capacityLps: null, maxAreaByPitch: t5(150, 120, 105, 90), stockLengthsMm: [], src: e1() },
  ],
  drainage: {
    mode: 'areaTable',
    method: 'NZBC E1/AS1 Table 5 (maximum plan roof area per downpipe by pitch)',
    slopeFactor: () => 1,
    slopeFactorNote: 'E1/AS1 Table 5 is read on plan area, by pitch band.',
    fallRatio: 500, fallNote: '1:500 (2 mm per metre) minimum towards outlets for external spouting; 1:200 flows and self-cleans better.', fallSrc: s('NZMRM COP 5.4.2.1', 'https://metalroofing.org.nz/cop/roof-drainage/gutters', 'secondary'),
    designIntensityMmPerHr: 100,
    intensityNote: 'E1/AS1 spouting charts use at least 100 mm/h (10-minute, 10% AEP). The metal roofing COP uses 50-year ARI from NIWA HIRDS, which can be about 40% higher.',
    cities: [
      rain('Auckland', 97, 127), rain('Christchurch', 39, 62), rain('Dunedin', 47, 73), rain('Hamilton', 92, 129), rain('Invercargill', 54, 87),
      rain('Napier', 69, 105), rain('Nelson', 77, 107), rain('New Plymouth', 100, 138), rain('Queenstown', 34, 53), rain('Rotorua', 96, 136),
      rain('Tauranga', 101, 145), rain('Wellington', 70, 97), rain('Whanganui', 68, 100), rain('Whangarei', 103, 140),
    ],
    maxDownpipeSpacingMm: null,
    src: e1(),
  },
  battenStockMm: [4800, 5400, 6000],
  trimStockMm: [3000, 6000],
  defaults: { overhangMm: 50, maxSheetMm: 12000, purlinSpacingMm: 900, eavesSetOutMm: 320, topSetOutMm: 40, wastePct: 5, trimStockMm: 6000, trimLapMm: 150, battenStockMm: 6000, screwBox: 500 },
  fixingsNote: {
    text: 'Corrugate into timber: Type 17 12-11 × 50 or M6 × 50, Class 4. Into steel up to 1.5 mm: M6 × 50 roofing screws or 12g-14 × 35 self-drilling. Sheets 8–18 m long: oversize holes and 30 mm EPDM washers on the lower half for expansion.',
    src: s('Maker’s corrugate data sheet', 'https://pimstorageaueprod.blob.core.windows.net/placemakers/media-assets/1016299_FBDI_24_Book-Dimond-Technical-Manual_V07.01.1119-2.1.4.7-Corrugate-Data-Sheet_WEB.pdf'),
  },
  notes: [
    '“Spouting” for external eaves gutters; “gutter” for internal and box gutters.',
    'Corrugated minimum pitch is 8° (10° end-lapped), higher than in Australia.',
    'Wind zones (NZS 3604) set the fixing pattern; E2/AS1 covers flashing details.',
  ],
  gaps: [
    'Tile batten gauges (except pressed-metal panels) and ridge caps per metre are not published: enter them from the maker’s guide.',
    'Which spouting profile has which cross-section area was read from the guide layout: check before relying on it.',
    'Batten, flashing and downpipe stock lengths vary by merchant: starting values only.',
    'Rainfall values come from an archived E1/AS1 copy; check the current edition or NIWA HIRDS for the site.',
  ],
};
