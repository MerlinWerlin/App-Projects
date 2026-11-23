/**
 * United States and Canada. Research 23 Nov 2026.
 * Panels: Metal Sales data sheets (Classic Rib, PBR, 2.5" corrugated, 5V crimp, Image II standing seam); Canada: Westman
 * Steel Tough Rib / AWR (Castle Building Centres, Home Depot Canada listings). Shingles: Owens Corning Supreme / Duration,
 * ProEdge hip & ridge, Starter Strip Plus; IKO Cambridge (Canada). Tile: Eagle Roofing technical specs.
 * Codes: IRC 2021 Ch. 9 and IPC 2021 Ch. 11 values via secondary references (ICC blocks automated reads);
 * NBC 9.26 via the Vancouver Building By-law 2019 text.
 */
import { DEFAULT_TERMS } from '../core/context';
import { degFromX12, MM_PER_FT, MM_PER_IN } from '../core/units';
import { s } from './src';
import type { Country } from './types';

const GPM = 0.0630902; // L/s per US gallon per minute
const MS = (file: string) => `https://www.buildsite.com/pdf/metalsales/${file}`;
const IPC = s('IPC 2021 Chapter 11 tables (secondary reference)', 'https://drainagecalculators.pages.dev/reference/ipc-tables', 'secondary');
const NBC = 'https://free.bcpublications.ca/civix/document/id/public/vbbl2019/1005507067';
const ft = (n: number) => Math.round(n * MM_PER_FT);
const inch = (n: number) => n * MM_PER_IN;
const x12 = (n: number) => Math.round(degFromX12(n) * 100) / 100;

const usTerms = { ...DEFAULT_TERMS, downpipe: 'downspout', downpipes: 'downspouts', barge: 'rake', ridge: 'ridge cap', underlay: 'underlayment' };

export const US: Country = {
  code: 'US', name: 'United States', guided: true, sys: 'imperial', pitchStyle: 'x12', currency: 'USD', spelling: 'en-US',
  terms: usTerms,
  standards: [
    { topic: 'Asphalt shingles', name: 'IRC 2021 R905.2: minimum slope 2:12 (double underlayment below 4:12); at least 4 fasteners per strip shingle; drip edge at eaves and rakes', src: s('IRC commentary (secondary)', 'https://www.jaspector.com/codes/irc-2021/ch09-roof-assemblies/asphalt-shingle-fastening-code/', 'secondary') },
    { topic: 'Metal roofing', name: 'IRC R905.10: lapped, non-soldered metal panels 3:12 minimum without lap sealant, 1/2:12 with', src: s('Florida Building Commission interpretation', 'https://www.floridabuilding.org/fbc/commission/FBC_0422/Commission/Binding_Interpretation_231.pdf', 'secondary') },
    { topic: 'Tile roofing', name: 'IRC R905.3: clay and concrete tile 2-1/2:12 minimum (double underlayment below 4:12)', src: s('Roofing reference (secondary)', 'https://roofobservations.com/minimum-roof-pitch-for-tile-roofs/', 'secondary') },
    { topic: 'Roof drainage', name: 'IPC 2021 Chapter 11: Table 1106.3 vertical leaders and Table 1106.6 semicircular gutters (gpm)', src: IPC },
    { topic: 'Roof drainage', name: 'SMACNA Architectural Sheet Metal Manual: gutter and downspout sizing', src: s('SMACNA', 'https://www.smacna.org/apps/downspout-gutter-sizing-calculator', 'secondary') },
    { topic: 'Fall protection', name: 'OSHA 29 CFR 1926.501(b)(13) residential construction, 6 ft', src: s('OSHA', 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.501') },
  ],
  safety: {
    regulator: 'OSHA',
    text: 'Anyone doing residential construction 6 ft (1.8 m) or more above a lower level must be protected by guardrails, safety nets or personal fall arrest (29 CFR 1926.501(b)(13)).',
    src: s('OSHA', 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.501'),
  },
  sheets: [
    { id: 'ag-panel', name: 'Ribbed agricultural panel (3/4 in rib)', coverMm: inch(36), minPitchDeg: x12(3), endLapMm: null, fixEnd: null, fixMid: null,
      note: 'The maker says these panels cannot be end-lapped: order full lengths (5–45 ft). Fixing pattern: see the maker’s drawing.', brandNote: 'Metal Sales Classic Rib',
      src: s('Panel maker’s data sheet', MS('Classic-Rib-Product-Data-2969149.pdf')) },
    { id: 'r-panel', name: 'R-panel style (1-1/4 in rib)', coverMm: inch(36), minPitchDeg: x12(1), endLapMm: null, fixEnd: null, fixMid: null,
      note: 'Rated to 1:12 by its maker. Tape sealant at side laps.', brandNote: 'Metal Sales PBR', src: s('Panel maker’s data sheet', MS('PBR-Panel-Product-Data-2894682.pdf')) },
    { id: 'corrugated-2-5', name: '2.5 in corrugated', coverMm: inch(21.33), minPitchDeg: x12(3), endLapMm: null, fixEnd: null, fixMid: null,
      note: 'Roof cover 21-1/3 in with two corrugations lapped.', brandNote: 'Metal Sales 2.5" Corrugated', src: s('Panel maker’s data sheet', MS('2.5-Corrugated-Product-Data-2894725.pdf')) },
    { id: '5v-crimp', name: '5V crimp', coverMm: inch(24), minPitchDeg: x12(3), endLapMm: null, fixEnd: null, fixMid: null,
      note: 'Needs solid deck with at least 30# felt.', src: s('Panel maker’s data sheet', MS('5v-Crimp-Product-Data-2969148.pdf')) },
    { id: 'snap-lock-16', name: 'Snap-lock standing seam 16 in', coverMm: inch(16), minPitchDeg: x12(3), endLapMm: null, fixEnd: null, fixMid: null,
      note: 'Concealed clip or flange fastening.', brandNote: 'Metal Sales Image II', src: s('Panel maker’s spec sheet (extract)', MS('Image-II-Spec-Data-2241202.pdf'), 'secondary') },
  ],
  tiles: [
    { id: 'concrete-s', name: 'Concrete S-tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 88.5 / 9.290304, minPitchDeg: x12(2.5),
      note: '88.5 tiles per square, 3 in headlap.', brandNote: 'Eagle Roofing', src: s('Tile maker’s technical specs', 'https://eagleroofing.com/technical-specifications/', 'secondary') },
    { id: 'concrete-flat', name: 'Concrete flat tile', kind: 'tile', coverWidthMm: null, maxGaugeMm: null, tilesPerM2: 88.5 / 9.290304, minPitchDeg: x12(2.5),
      src: s('Tile maker’s technical specs', 'https://eagleroofing.com/technical-specifications/', 'secondary') },
  ],
  shingles: [
    { id: 'architectural', name: 'Architectural (laminated) shingle', bundlesPerSquare: 3, shinglesPerSquare: 64, nailsPerShingle: 4, minPitchDeg: x12(2),
      note: '2:12 to under 4:12 needs two layers of underlayment. 6 nails on very steep slopes or where the code requires.', src: s('Shingle maker’s product page', 'https://www.owenscorning.com/en-us/roofing/shingles/trudefinition-duration') },
    { id: '3tab', name: '3-tab shingle', bundlesPerSquare: 3, shinglesPerSquare: 80, nailsPerShingle: 4, minPitchDeg: x12(2),
      src: s('Shingle maker’s product page', 'https://www.owenscorning.com/en-us/roofing/shingles/supreme') },
  ],
  caps: [
    { id: 'hip-ridge', name: 'Hip & ridge shingles (33 lin ft per bundle)', kind: 'shingleCap', ftPerBundle: 33, src: s('Retail product listing', 'https://www.lowes.com/pd/Owens-Corning-ProEdge-33-lin-ft-Teak-Hip-and-Ridge-Roof-Shingles/1001874438', 'secondary') },
    { id: 'starter', name: 'Starter strip (105 lin ft per bundle)', kind: 'starter', ftPerBundle: 105, src: s('Shingle maker’s product page', 'https://owenscorning.com/en-ca/roofing/components/products/starter-strip-plus') },
  ],
  gutters: [
    { id: 'half-round-5', name: '5 in half-round at 1/8 in per ft', capacityLps: 74 * GPM, stockLengthsMm: [ft(10)], src: IPC },
    { id: 'half-round-6', name: '6 in half-round at 1/8 in per ft', capacityLps: 110 * GPM, stockLengthsMm: [ft(10)], src: IPC },
    { id: 'k-5', name: '5 in K-style', capacityLps: null, stockLengthsMm: [ft(10)], note: 'No code capacity table for K-style: enter the maker’s figure, or use the half-round rows as a guide.', src: s('Retail listing (stock length only)', 'https://homedepot.com/p/Amerimax-Home-Products-5-in-x-10-ft-White-Aluminum-K-Style-Gutter-2600600120/100061750', 'secondary') },
    { id: 'k-6', name: '6 in K-style', capacityLps: null, stockLengthsMm: [], src: s('Consumer sizing guide', 'https://www.thisoldhouse.com/gutters/reviews/sizes-of-gutters', 'secondary') },
  ],
  downpipes: [
    { id: 'round-3', name: '3 in round', capacityLps: 92 * GPM, stockLengthsMm: [ft(10)], note: 'IPC Table 1106.3 vertical leader.', src: IPC },
    { id: 'round-4', name: '4 in round', capacityLps: 192 * GPM, stockLengthsMm: [ft(10)], note: 'IPC Table 1106.3 vertical leader.', src: IPC },
    { id: '2x3', name: '2 × 3 in rectangular', capacityLps: null, ruleAreaM2: 600 / 10.7639, stockLengthsMm: [ft(10)], note: 'Rule of thumb: about 600 sq ft of roof per downspout.', src: s('Trade sizing guide (rule of thumb)', 'https://www.thisoldhouse.com/gutters/how-to-size-gutters-and-downspouts', 'secondary') },
    { id: '3x4', name: '3 × 4 in rectangular', capacityLps: null, ruleAreaM2: 1200 / 10.7639, stockLengthsMm: [ft(10)], note: 'Rule of thumb: up to about 1,200 sq ft per downspout.', src: s('Trade sizing guide (rule of thumb)', 'https://www.thisoldhouse.com/gutters/how-to-size-gutters-and-downspouts', 'secondary') },
  ],
  drainage: {
    mode: 'flow',
    method: 'IPC 2021 Chapter 11 flow method (horizontally projected roof area × rainfall rate)',
    slopeFactor: () => 1,
    slopeFactorNote: 'The IPC sizes on horizontally projected (plan) roof area.',
    fallRatio: 480, fallNote: 'Common trade guidance is 1/4 in per 10 ft (about 1:480). The IPC gutter table lists 1/16 to 1/2 in per ft. Not a code minimum.', fallSrc: IPC,
    designIntensityMmPerHr: null,
    intensityNote: 'The IPC uses the 100-year, 1-hour rainfall for the site (NOAA Atlas 14). Enter the site value in in/h.',
    cities: [],
    maxDownpipeSpacingMm: ft(40),
    spacingNote: 'Consumer guides size gutters assuming a downspout about every 40 ft.',
    src: IPC,
  },
  battenStockMm: [ft(8), ft(10), ft(12)],
  trimStockMm: [ft(10)],
  defaults: { overhangMm: inch(2), maxSheetMm: ft(45), purlinSpacingMm: inch(24), eavesSetOutMm: inch(12), topSetOutMm: inch(1.5), wastePct: 10, trimStockMm: ft(10), trimLapMm: inch(2), battenStockMm: ft(8), screwBox: 250 },
  fixingsNote: {
    text: 'Exposed-fastened steel panels: #10-14 wood screws into wood, #12-14 self-drilling into steel, 1/4-14 × 7/8 in stitch screws at side laps 12 in o.c.; fasteners at least 1/2 in past the inside face of the support. Shingles: at least 4 nails per strip shingle (IRC R905.2.6).',
    src: s('Panel maker’s data sheet', MS('Classic-Rib-Product-Data-2969149.pdf')),
  },
  notes: [
    'Roof area is measured in squares (100 sq ft). Pitch is rise in inches per 12 in of run.',
    'Drip edge is required at eaves and rakes of asphalt shingle roofs: underlayment over it at the eave, under it at the rake.',
  ],
  gaps: [
    'IRC and IPC values come from secondary references (the ICC site blocks automated reads): spot-check against the code.',
    'Panel fastener counts are given only as drawings: enter the pattern from the maker’s sheet.',
    'No minimum gutter fall in the code; US city rainfall not built in.',
  ],
};

export const CA: Country = {
  code: 'CA', name: 'Canada', guided: true, sys: 'imperial', pitchStyle: 'x12', currency: 'CAD', spelling: 'en-US',
  terms: { ...usTerms, gutter: 'eavestrough', gutters: 'eavestroughs', batten: 'strapping', battens: 'strapping', underlay: 'underlay' },
  standards: [
    { topic: 'Shingles', name: 'NBC 9.26: asphalt shingles 1 in 3 (4:12) normal, 1 in 6 (2:12) low-slope with triple coverage; at least 4 nails per 1 m shingle', src: s('NBC Part 9 text (Vancouver by-law)', NBC) },
    { topic: 'Shingles', name: 'NBC 9.26.5 eave protection: 900 mm up-slope and 300 mm inside the inner face of the exterior wall', src: s('NBC Part 9 text (Vancouver by-law)', NBC) },
    { topic: 'Metal roofing', name: 'NBC Table 9.26.3.1: profiled metal roofing 1 in 4 (3:12) minimum', src: s('NBC Part 9 text (Vancouver by-law)', NBC) },
    { topic: 'Tile roofing', name: 'NBC Table 9.26.3.1: clay tile 1 in 2 (6:12); concrete tile to CAN/CSA-A220', src: s('NBC Part 9 text (Vancouver by-law)', NBC) },
    { topic: 'Roof drainage', name: 'NBC 9.26.18 roof drains and downspouts; design rainfall NBC Appendix C (15-minute, 1-in-10)', src: s('BC Building Code 2018', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac') },
    { topic: 'Fall protection', name: 'Provincial OHS: Ontario O. Reg. 213/91 s.26 (over 3 m); BC OHS Regulation 11.2 (3 m or more)', src: s('WorkSafeBC', 'https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/ohs-guidelines/guidelines-part-11') },
  ],
  safety: {
    regulator: 'Provincial OHS (e.g. Ontario Ministry of Labour, WorkSafeBC)',
    text: 'Ontario: fall protection over 3 m (O. Reg. 213/91 s.26). BC: 3 m or more, or lower where a fall could cause serious injury (OHS Regulation 11.2). Other provinces differ: check the province.',
    src: s('WorkSafeBC', 'https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/ohs-guidelines/guidelines-part-11'),
  },
  sheets: [
    { id: 'ag-panel', name: 'Ribbed agricultural panel', coverMm: inch(36), minPitchDeg: x12(3), endLapMm: null, fixEnd: null, fixMid: null,
      note: '8 ft and 12 ft at retail; cut to length from metal suppliers.', brandNote: 'Westman Tough Rib', src: s('Building supplier listing', 'https://castle.ca/product/tough-rib-WSI177340', 'secondary') },
    { id: 'ag-panel-low', name: 'Low-slope ribbed panel', coverMm: inch(36), minPitchDeg: x12(2), endLapMm: null, fixEnd: null, fixMid: null,
      brandNote: 'Westman AWR', src: s('Building supplier listing (extract)', 'https://castle.ca/product/awr-WSI177334', 'unverified') },
  ],
  tiles: [],
  shingles: [
    { id: 'architectural', name: 'Architectural (laminated) shingle', bundlesPerSquare: 3, shinglesPerSquare: 60, nailsPerShingle: 4, minPitchDeg: x12(4),
      note: '20 shingles per bundle, 3 bundles per square. 4:12 normal application; 2:12 low-slope needs triple coverage and cemented courses.', brandNote: 'IKO Cambridge',
      src: s('Shingle maker’s product page', 'https://www.iko.com/na/product/cambridge/') },
  ],
  caps: [
    { id: 'hip-ridge', name: 'Hip & ridge shingles (33 lin ft per bundle)', kind: 'shingleCap', ftPerBundle: 33, src: s('Shingle maker’s page (Canada)', 'https://roofingca.owenscorning.com/homeowner/accessories/hipandridge/proedge-hip-and-ridge.aspx', 'secondary') },
    { id: 'starter', name: 'Starter strip (105 lin ft per bundle)', kind: 'starter', ftPerBundle: 105, src: s('Shingle maker’s page (Canada)', 'https://owenscorning.com/en-ca/roofing/components/products/starter-strip-plus') },
  ],
  gutters: [
    { id: 'k-5', name: '5 in K-style eavestrough', capacityLps: null, stockLengthsMm: [], note: 'Capacity not verified for Canada: enter the maker’s figure.', src: s('Not verified', NBC, 'unverified') },
  ],
  downpipes: [
    { id: '2x3', name: '2 × 3 in downspout', capacityLps: null, stockLengthsMm: [], note: 'Capacity not verified for Canada: enter the maker’s figure.', src: s('Not verified', NBC, 'unverified') },
  ],
  drainage: {
    mode: 'flow',
    method: 'Rational method with the NBC Appendix C 15-minute, 1-in-10 rainfall (the National Plumbing Code governs sizing)',
    slopeFactor: () => 1,
    slopeFactorNote: 'Plan (horizontally projected) roof area.',
    fallRatio: 480, fallNote: 'No code minimum found. 1/4 in per 10 ft (about 1:480) is common trade guidance.', fallSrc: s('Trade guidance (not a code value)', NBC, 'unverified'),
    designIntensityMmPerHr: null,
    intensityNote: 'Use the 15-minute, 1-in-10 rainfall from NBC Appendix C (or the provincial code) × 4 for mm/h.',
    cities: [
      { name: 'Vancouver', mmPerHr: 40, basis: '15-minute, 1-in-10 (10 mm × 4)', src: s('BC Building Code 2018 App. C', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac') },
      { name: 'Victoria', mmPerHr: 32, basis: '15-minute, 1-in-10 (8 mm × 4)', src: s('BC Building Code 2018 App. C', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac') },
      { name: 'Kelowna', mmPerHr: 48, basis: '15-minute, 1-in-10 (12 mm × 4)', src: s('BC Building Code 2018 App. C', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac') },
      { name: 'Kamloops', mmPerHr: 52, basis: '15-minute, 1-in-10 (13 mm × 4)', src: s('BC Building Code 2018 App. C', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac') },
      { name: 'Prince George', mmPerHr: 60, basis: '15-minute, 1-in-10 (15 mm × 4)', src: s('BC Building Code 2018 App. C', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac') },
    ],
    maxDownpipeSpacingMm: null,
    src: s('BC Building Code 2018', 'https://free.bcpublications.ca/civix/document/id/public/bcbc2018/bcbc_2018dbac'),
  },
  battenStockMm: [ft(8), ft(10), ft(12)],
  trimStockMm: [ft(10)],
  defaults: { overhangMm: inch(2), maxSheetMm: ft(40), purlinSpacingMm: inch(24), eavesSetOutMm: inch(12), topSetOutMm: inch(1.5), wastePct: 10, trimStockMm: ft(10), trimLapMm: inch(2), battenStockMm: ft(8), screwBox: 250 },
  fixingsNote: {
    text: 'NBC 9.26.2.3: corrosion-resistant roofing nails long enough to go through, or 12 mm into, the sheathing; head at least 9.5 mm, shank at least 2.95 mm. Staples at least 19 mm long with a 25 mm crown.',
    src: s('NBC Part 9 text (Vancouver by-law)', NBC),
  },
  notes: [
    'NBC writes slope as 1 in N: 1 in 3 = 4:12, 1 in 4 = 3:12, 1 in 6 = 2:12, 1 in 2 = 6:12.',
    'Eave protection (ice-dam membrane) is required over most of Canada.',
    'Codes are provincial adoptions of the NBC (BCBC, Ontario Building Code, Quebec): check the local edition.',
  ],
  gaps: [
    'Eavestrough and downspout capacities, 3-tab shingle and concrete tile data were not verified for Canada: enter the maker’s figures.',
    'NBC values were read from a 2019 by-law based on NBC 2015; 2020 changes not checked. Only BC city rainfall is built in.',
  ],
};
