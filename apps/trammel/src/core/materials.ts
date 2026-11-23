// What a chippy can actually buy in each country: framing sections and grades with their stock lengths, decking
// boards and sheet sizes, read from the big hardware chains' and timber merchants' own product pages on
// 23 Nov 2026 (URLs per country below). Retailer names stay in these comments only, never in the app. Lists are
// "commonly listed", not guaranteed stock: branches vary and some lines are special order, so the app always keeps a
// custom entry. Lengths that couldn't be verified for a size are left out; where nothing could be verified the
// catalogue is generic and marked verified: false, and the app says so.
import type { CountryCode } from './country.ts';

export type Framing = { id: string; name: string; w: number; d: number; grades: string; lengths: number[] };
/** lengths [] = sold in random lengths or by the metre. */
export type Decking = { id: string; name: string; w: number; t: number; material: string; lengths: number[] };
export type Sheet = { id: string; name: string; w: number; l: number; thicknesses: number[] };
export type Catalogue = {
  country: CountryCode;
  /** Short label for the country summary line. */
  label: string;
  verified: boolean;
  /** Sold sizes are nominal names (US/CA "2x4", IE "4x2"); w and d are the actual sizes in mm. */
  framing: Framing[];
  decking: Decking[];
  sheets: Sheet[];
  sources: string[];
};

const FT = 304.8;
const ft = (...feet: number[]) => feet.map((f) => Math.round(f * FT));
const IN = 25.4;

// ---------- Australia ----------
// https://www.bunnings.com.au/products/building-hardware/timber/framing-timber
// https://www.bunnings.com.au/products/building-hardware/timber/framing-timber/structural-pine/treated-structural-pine
// https://www.bunnings.com.au/90-x-45mm-framing-mgp10-untreated-pine-2-4m_p8030079 (and the other length pages)
// https://www.mitre10.com.au/timber-treated-pine-f7-mgp10-h3-90-x-45mm-3891041
// https://www.bunnings.com.au/products/building-hardware/timber/decking/timber-decking
// https://www.bunnings.com.au/90-x-22mm-decking-h3-treated-pine-5-7m_p8032594
// https://www.bunnings.com.au/structaply-2400-x-1200-x-17mm-structural-cd-grade-plywood_p0340166
// https://www.bunnings.com.au/products/building-hardware/timber/timber-boards/flooring/particleboard-flooring
// https://www.bunnings.com.au/gyprock-csr-2400-x-1200-x-10mm-2-88sqm-aquachek-plasterboard-re_p0730710
const AU: Catalogue = {
  country: 'AU',
  label: 'MGP10 pine, 2.4-6.0 m lengths',
  verified: true,
  framing: [
    { id: 'au-70x35', name: '70 x 35', w: 70, d: 35, grades: 'MGP10, H2, H3', lengths: [2400] },
    { id: 'au-70x45', name: '70 x 45', w: 70, d: 45, grades: 'MGP10, MGP12, H2, H3, H4', lengths: [2400, 2700, 3000, 3900, 5400] },
    { id: 'au-90x35', name: '90 x 35', w: 90, d: 35, grades: 'MGP10, MGP12, H2, H3', lengths: [2400, 4500, 5400, 5700, 6000] },
    { id: 'au-90x45', name: '90 x 45', w: 90, d: 45, grades: 'MGP10, H2, F7/MGP10 H3, H4', lengths: [2400, 2700, 3000, 3300, 3600, 3900, 4200, 4500, 4800, 5100, 5400, 5700, 6000] },
    { id: 'au-120x35', name: '120 x 35', w: 120, d: 35, grades: 'MGP12 H2, H3', lengths: [3600, 4800] },
    { id: 'au-140x35', name: '140 x 35', w: 140, d: 35, grades: 'MGP10, H3', lengths: [2400, 3000, 3600, 4200, 4800, 5400, 6000] },
    { id: 'au-140x45', name: '140 x 45', w: 140, d: 45, grades: 'MGP10, H3, H4', lengths: [3600, 4800] },
    { id: 'au-190x45', name: '190 x 45', w: 190, d: 45, grades: 'MGP10, H3, H4', lengths: [2400, 5400, 6000] },
    { id: 'au-240x45', name: '240 x 45', w: 240, d: 45, grades: 'H3', lengths: [2700, 6000] },
  ],
  decking: [
    { id: 'au-d-90x22', name: '90 x 22 treated pine', w: 90, t: 22, material: 'H3 treated pine', lengths: [1800, 2400, 3000, 3600, 4200, 4800, 5400, 5700, 6000] },
    { id: 'au-d-90x19m', name: '90 x 19 merbau', w: 90, t: 19, material: 'Merbau', lengths: [2250, 5700] },
    { id: 'au-d-140x19m', name: '140 x 19 merbau', w: 140, t: 19, material: 'Merbau', lengths: [5700] },
    { id: 'au-d-86x19', name: '86 x 19 hardwood', w: 86, t: 19, material: 'Spotted gum, blackbutt, ironbark', lengths: [] },
    { id: 'au-d-135x19', name: '135 x 19 hardwood', w: 135, t: 19, material: 'Spotted gum, ironbark', lengths: [5700] },
    { id: 'au-d-137x23c', name: '137 x 23 composite', w: 137, t: 23, material: 'Composite', lengths: [5400] },
  ],
  sheets: [
    { id: 'au-s-ply', name: 'Structural ply', w: 1200, l: 2400, thicknesses: [7, 9, 12, 15, 17, 21] },
    { id: 'au-s-floorply', name: 'Flooring ply T&G', w: 1200, l: 2400, thicknesses: [19] },
    { id: 'au-s-yellowtongue', name: 'Particleboard flooring', w: 800, l: 3600, thicknesses: [19] },
    { id: 'au-s-plaster', name: 'Plasterboard', w: 1200, l: 2400, thicknesses: [10, 13] },
    { id: 'au-s-osb', name: 'OSB brace board', w: 1200, l: 2440, thicknesses: [6] },
  ],
  sources: ['bunnings.com.au', 'mitre10.com.au'],
};

// ---------- New Zealand ----------
// https://www.bunnings.co.nz/products/building-hardware/timber/framing-timber
// https://www.bunnings.co.nz/90-x-45mm-sg8-h1-2-kd-treated-radiata-timber-framing-2-4m_p0616333
// https://www.mitre10.co.nz/shop/radiata-sg8-h1-2-dry-timber-90-x-45-x-4-8m/p/2055892
// https://www.mitre10.co.nz/shop/carter-holt-radiata-sg8-h1-2-dry-timber-h-50mm-w-100mm-l-2-33m/p/245963
// https://www.mitre10.co.nz/shop/radiata-premium-grade-smooth-decking-140-x-32mm/p/392349
// https://www.mitre10.co.nz/shop/ecoply-structural-plywood-cd-untreated-2400-1200-19mm/p/320580
// https://www.bunnings.co.nz/gib-10x2400x1200mm-standard-plasterboard-2400mm_p0299316
const NZ: Catalogue = {
  country: 'NZ',
  label: 'SG8 radiata, 2.4-6.0 m lengths',
  verified: true,
  framing: [
    { id: 'nz-70x45', name: '70 x 45', w: 70, d: 45, grades: 'SG8 H1.2, H3.2', lengths: [4800, 6000] },
    { id: 'nz-90x45', name: '90 x 45', w: 90, d: 45, grades: 'SG8 H1.2, H3.2', lengths: [2330, 2400, 4800, 5400, 6000] },
    { id: 'nz-140x45', name: '140 x 45', w: 140, d: 45, grades: 'SG8 H1.2, H3.2', lengths: [4800, 6000] },
    { id: 'nz-190x45', name: '190 x 45', w: 190, d: 45, grades: 'SG8 H1.2, H3.2', lengths: [4800, 6000] },
    { id: 'nz-240x45', name: '240 x 45', w: 240, d: 45, grades: 'SG8 H1.2, H3.2', lengths: [4800, 6000] },
    { id: 'nz-290x45', name: '290 x 45', w: 290, d: 45, grades: 'SG8 H1.2, H3.2', lengths: [5400, 6000] },
  ],
  decking: [
    { id: 'nz-d-88x32', name: '88 x 32 pine', w: 88, t: 32, material: 'Radiata H3.2', lengths: [] },
    { id: 'nz-d-140x32', name: '140 x 32 pine', w: 140, t: 32, material: 'Radiata H3.2', lengths: [] },
    { id: 'nz-d-90x19k', name: '90 x 19 kwila', w: 90, t: 19, material: 'Kwila', lengths: [] },
    { id: 'nz-d-140x19k', name: '140 x 19 kwila', w: 140, t: 19, material: 'Kwila', lengths: [5700] },
    { id: 'nz-d-137x23c', name: '137 x 23 composite', w: 137, t: 23, material: 'Composite', lengths: [5400] },
  ],
  sheets: [
    { id: 'nz-s-ply', name: 'Structural ply', w: 1200, l: 2400, thicknesses: [7, 12, 17, 19, 21] },
    { id: 'nz-s-floorply', name: 'Flooring ply T&G', w: 1200, l: 2400, thicknesses: [17, 19] },
    { id: 'nz-s-gib', name: 'Plasterboard', w: 1200, l: 2400, thicknesses: [10, 13] },
  ],
  sources: ['bunnings.co.nz', 'mitre10.co.nz'],
};

// ---------- United Kingdom ----------
// Regularised carcassing finishes 2 mm under nominal thickness and 5 mm under width (nominal 47 x 100 = 45 x 95).
// https://www.wickes.co.uk/Products/Building-Materials/Timber/Trade-Timber-Supplies/CLS-Studwork-Timber/c/1000201
// https://www.wickes.co.uk/Products/Building-Materials/Timber/Trade-Timber-Supplies/Treated-Sawn-Kiln-Dried-C16-Timber/c/1000204
// https://www.travisperkins.co.uk/product/timber/cls-studwork-timber/c/1500004
// https://www.travisperkins.co.uk/47mm-x-100mm-x-4-2m-regularised-treated-timber-c16/p/946930
// https://www.jewson.co.uk/p/pefc-premium-c24-treated-kiln-dried-regularised-carcassing-47-x-200mm-PAJT4720
// https://www.wickes.co.uk/Products/Garden+Outdoor-Landscaping/Garden-Decking/Timber-Deckboards/c/1000707
// https://www.diy.com/departments/outdoor-garden/decking/decking-boards/DIY585087.cat?Thickness+%28mm%29=28
// https://www.wickes.co.uk/Products/Building-Materials/Sheet-Materials/All-Sheet-Materials/c/1096003
// https://www.wickes.co.uk/Wickes-P5-Tongue-and-Groove-Chipboard-Flooring---18-x-600-x-2400mm/p/164516
const GB: Catalogue = {
  country: 'GB',
  label: 'CLS and C16/C24 regularised, 2.4-6.0 m lengths',
  verified: true,
  framing: [
    { id: 'gb-cls63', name: '38 x 63 CLS', w: 63, d: 38, grades: 'C16 CLS', lengths: [1800, 2400, 2700, 3000, 4800] },
    { id: 'gb-cls89', name: '38 x 89 CLS', w: 89, d: 38, grades: 'C16 CLS', lengths: [2400, 3000, 4800] },
    { id: 'gb-47x75', name: '47 x 75 (45 x 70)', w: 70, d: 45, grades: 'C16 regularised', lengths: [2400, 3000, 3600] },
    { id: 'gb-47x100', name: '47 x 100 (45 x 95)', w: 95, d: 45, grades: 'C16, C24 regularised', lengths: [2400, 3000, 3600, 4200, 4800, 6000] },
    { id: 'gb-47x125', name: '47 x 125 (45 x 120)', w: 120, d: 45, grades: 'C16 regularised', lengths: [2400, 3000, 3600, 4800] },
    { id: 'gb-47x150', name: '47 x 150 (45 x 145)', w: 145, d: 45, grades: 'C16, C24 regularised', lengths: [2400, 3000, 3600, 4200, 4800, 5400, 6000] },
    { id: 'gb-47x200', name: '47 x 200 (45 x 195)', w: 195, d: 45, grades: 'C16, C24 regularised', lengths: [3000, 3600, 4200, 4800, 5400, 6000] },
  ],
  decking: [
    { id: 'gb-d-120', name: '120 x 25 treated', w: 120, t: 25, material: 'Treated softwood', lengths: [1800, 2400, 3600] },
    { id: 'gb-d-144', name: '144 x 27 softwood', w: 144, t: 27, material: 'Softwood', lengths: [2400, 3600, 4800] },
    { id: 'gb-d-145', name: '145 x 28 treated', w: 145, t: 28, material: 'Treated softwood', lengths: [2400, 3600, 4800] },
  ],
  sheets: [
    { id: 'gb-s-osb', name: 'OSB3', w: 1220, l: 2440, thicknesses: [11, 18] },
    { id: 'gb-s-ply', name: 'Structural softwood ply', w: 1220, l: 2440, thicknesses: [12, 18] },
    { id: 'gb-s-chip', name: 'Chipboard flooring P5 T&G', w: 600, l: 2400, thicknesses: [18, 22] },
    { id: 'gb-s-plaster', name: 'Plasterboard', w: 1200, l: 2400, thicknesses: [9.5, 12.5] },
  ],
  sources: ['wickes.co.uk', 'travisperkins.co.uk', 'jewson.co.uk', 'diy.com'],
};

// ---------- Ireland ----------
// Sold by nominal size (100 x 44 is "4 x 2"); finished sizes are a little smaller and couldn't be verified, so the
// nominal sizes are used as the dimensions.
// https://www.chadwicks.ie/3-0m-100-x-44-rough-white-deal-14560.html
// https://www.chadwicks.ie/white-deal-planed-pao-timber-4-8m-100-x-44-15910.html
// https://www.chadwicks.ie/5-4m-75-x-44-rough-white-deal-14554.html
// https://www.chadwicks.ie/6-0m-175-x-44-rough-white-deal-14642.html
// https://www.corkbp.ie/4-8m-100-x-44-rough-white-deal-treated-14014.html
// https://www.woodies.ie/decking-board-120mm-x-2400mm-1136654
// https://www.chadwicks.ie/enviroply-e-pine-plywood-2440-x-1220-x-18mm-c-c-structural-19924.html
// https://www.chadwicks.ie/gyproc-moisture-resistant-2400-x-1200-x-15mm-te-green-29053.html
const IE: Catalogue = {
  country: 'IE',
  label: 'White deal (nominal sizes), 3.0-6.0 m lengths',
  verified: true,
  framing: [
    { id: 'ie-75x44', name: '3 x 2 (75 x 44)', w: 75, d: 44, grades: 'White deal, C16 treated', lengths: [3600, 4800, 5400] },
    { id: 'ie-100x44', name: '4 x 2 (100 x 44)', w: 100, d: 44, grades: 'White deal, C16 treated', lengths: [3000, 3600, 4800, 5400] },
    { id: 'ie-150x44', name: '6 x 2 (150 x 44)', w: 150, d: 44, grades: 'White deal', lengths: [3000, 4800, 5400, 6000] },
    { id: 'ie-175x44', name: '7 x 2 (175 x 44)', w: 175, d: 44, grades: 'White deal', lengths: [3600, 6000] },
    { id: 'ie-225x44', name: '9 x 2 (225 x 44)', w: 225, d: 44, grades: 'White deal', lengths: [3600, 4200] },
  ],
  decking: [
    { id: 'ie-d-120', name: '120 x 27 treated', w: 120, t: 27, material: 'Treated softwood', lengths: [2400] },
    { id: 'ie-d-150', name: '150 x 35 treated', w: 150, t: 35, material: 'Treated softwood', lengths: [4800] },
  ],
  sheets: [
    { id: 'ie-s-osb', name: 'OSB', w: 1220, l: 2440, thicknesses: [18] },
    { id: 'ie-s-ply', name: 'Plywood', w: 1220, l: 2440, thicknesses: [18] },
    { id: 'ie-s-plaster', name: 'Plasterboard', w: 1200, l: 2400, thicknesses: [12.5, 15] },
  ],
  sources: ['chadwicks.ie', 'corkbp.ie', 'woodies.ie'],
};

// ---------- United States ----------
// 2x4 actual 1.5 x 3.5 in (38 x 89 mm) read on the chains' pages. Other actual sizes are the dry dressed sizes of the
// American Softwood Lumber Standard (NIST Voluntary Product Standard PS 20): 2x6 = 1.5 x 5.5 in, 2x8 = 1.5 x 7.25 in.
// Only sizes whose stocked lengths were read are listed. Precut studs 92 5/8, 104 5/8 and 116 5/8 in.
// https://www.homedepot.com/p/Unbranded-2-in-x-4-in-x-92-5-8-in-Premium-Kiln-Dried-SPF-Stud-02040825140/206727519
// https://www.homedepot.com/p/2-in-x-4-in-x-8-ft-2-Premium-Grade-Dimensional-Lumber-441317/202094172
// https://www.lowes.com/pd/2-in-x-4-in-x-8-ft-Whitewood-Pre-Cut-Stud-Common-1-5-in-x-3-5-in-Actual/1000525943
// https://www.homedepot.com/p/2-in-x-6-in-x-16-ft-2-Premium-Grade-Fir-Dimensional-Lumber-2023-16/206019467
// https://www.homedepot.com/p/WeatherShield-5-4-in-x-6-in-x-8-ft-Standard-Ground-Contact-Pressure-Treated-Southern-Yellow-Pine-Decking-Board-253919/206968441
// https://www.lowes.com/pl/decking/wood-deck-boards/cedar/5-4-in-x-6-in/2210062139418-4294671555-4294402669
// https://www.lowes.com/pd/Trex-Select-20-ft-Saddle-Grooved-Composite-Deck-Board/1000709602
// https://www.homedepot.com/p/7-16-in-x-4-ft-x-8-ft-OSB-Sheathing-386081/100091344
// https://www.homedepot.com/b/Building-Materials-Drywall/Drywall/1-2-in/N-5yc1vZar3dZ1z0ppqdZ1z10nw4
const US: Catalogue = {
  country: 'US',
  label: '2x lumber (SPF, fir, SYP), 8-16 ft and precut studs',
  verified: true,
  framing: [
    { id: 'us-2x4', name: '2x4 (1.5 x 3.5 in)', w: 3.5 * IN, d: 1.5 * IN, grades: 'SPF #2, Douglas fir, SYP, stud grade', lengths: [Math.round(92.625 * IN), Math.round(104.625 * IN), Math.round(116.625 * IN), ...ft(8, 10, 12, 14, 16)] },
    { id: 'us-2x6', name: '2x6 (1.5 x 5.5 in)', w: 5.5 * IN, d: 1.5 * IN, grades: 'SPF #2, Douglas fir, hem-fir', lengths: ft(8, 10, 12, 16, 20, 22, 24) },
  ],
  decking: [
    { id: 'us-d-54x6pt', name: '5/4 x 6 pressure treated', w: 5.5 * IN, t: 1 * IN, material: 'Pressure-treated SYP', lengths: ft(8, 12, 16) },
    { id: 'us-d-2x6pt', name: '2x6 pressure treated', w: 5.5 * IN, t: 1.5 * IN, material: 'Pressure-treated SYP', lengths: ft(8, 10, 12, 16, 20) },
    { id: 'us-d-54x6c', name: '5/4 x 6 cedar', w: 5.5 * IN, t: 1 * IN, material: 'Western red cedar', lengths: ft(8, 10, 12, 16) },
    { id: 'us-d-comp', name: 'Composite board', w: 5.5 * IN, t: 1 * IN, material: 'Composite', lengths: ft(12, 16, 20) },
  ],
  sheets: [
    { id: 'us-s-osb', name: 'OSB sheathing', w: 4 * FT, l: 8 * FT, thicknesses: [11.1, 15.1] },
    { id: 'us-s-subfloor', name: 'OSB T&G subfloor 23/32', w: 4 * FT, l: 8 * FT, thicknesses: [18.3] },
    { id: 'us-s-cdx', name: 'Plywood CDX 15/32', w: 4 * FT, l: 8 * FT, thicknesses: [11.9] },
    { id: 'us-s-drywall', name: 'Drywall 1/2', w: 4 * FT, l: 8 * FT, thicknesses: [12.7] },
  ],
  sources: ['homedepot.com', 'lowes.com'],
};

// ---------- Canada ----------
// https://rona.ca/en/product/2-in-x-4-in-x-12-ft-spf-2-better-grade-lumber-ep2412s-0971049
// https://rona.ca/en/product/2-in-x-4-in-x-104-5-8-in-spf-stud-grade-lumber-ep24104s-0971027
// https://rona.ca/en/product/2-in-x-4-in-x-92-5-8-in-spf-select-lumber-034-02005-0971267
// https://www.homehardware.ca/en/2-x-4-x-12-grade-2-better-kiln-dried-spruce-lumber/p/2832431
// https://www.homehardware.ca/en/2-x-8-x-12-grade-2-better-kiln-dried-spruce/p/2832463
// https://www.homedepot.ca/product/micropro-sienna-5-4-x-6-x-12-treated-wood-decking/1000680736
// https://www.rona.ca/en/product/5-4-in-x-6-in-x-10-ft-western-red-cedar-d4s-rcd54610kd-8552016
// https://www.homedepot.ca/product/cgc-sheetrock-1-2-in-x-4-ft-x-8-ft-ultralight-drywall-panel/1000686028
const CA: Catalogue = {
  country: 'CA',
  label: 'SPF 2x lumber, 8-16 ft and precut studs',
  verified: true,
  framing: [
    { id: 'ca-2x4', name: '2x4 (38 x 89)', w: 89, d: 38, grades: 'SPF #2 & Btr, stud, select', lengths: [Math.round(92.625 * IN), Math.round(104.625 * IN), ...ft(8, 10, 12, 14, 16, 20)] },
    { id: 'ca-2x8', name: '2x8', w: 184, d: 38, grades: 'SPF #2 & Btr', lengths: ft(8, 10, 12, 18) },
  ],
  decking: [
    { id: 'ca-d-54x6pt', name: '5/4 x 6 treated', w: 5.5 * IN, t: 1 * IN, material: 'Pressure-treated, brown', lengths: ft(8, 10, 12, 14, 16) },
    { id: 'ca-d-54x6c', name: '5/4 x 6 cedar', w: 5.5 * IN, t: 1 * IN, material: 'Western red cedar', lengths: ft(8, 10, 12, 16) },
  ],
  sheets: [
    { id: 'ca-s-osb', name: 'OSB sheathing 7/16', w: 4 * FT, l: 8 * FT, thicknesses: [11.1] },
    { id: 'ca-s-ply', name: 'Spruce plywood', w: 4 * FT, l: 8 * FT, thicknesses: [12.7, 15.9, 19.1] },
    { id: 'ca-s-drywall', name: 'Drywall 1/2', w: 4 * FT, l: 8 * FT, thicknesses: [12.7] },
  ],
  sources: ['rona.ca', 'homehardware.ca', 'homedepot.ca'],
};

// ---------- Anywhere else (not verified for any one country) ----------
const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(v);
  return out;
};
const GENERIC: Catalogue = {
  country: 'OTHER',
  label: 'Generic metric sizes (not checked against local stock)',
  verified: false,
  framing: [
    { id: 'g-70x45', name: '70 x 45', w: 70, d: 45, grades: 'Structural softwood', lengths: range(2400, 6000, 600) },
    { id: 'g-90x45', name: '90 x 45', w: 90, d: 45, grades: 'Structural softwood', lengths: range(2400, 6000, 600) },
    { id: 'g-140x45', name: '140 x 45', w: 140, d: 45, grades: 'Structural softwood', lengths: range(2400, 6000, 600) },
  ],
  decking: [{ id: 'g-d-90', name: '90 x 22', w: 90, t: 22, material: 'Softwood', lengths: range(2400, 5400, 600) }],
  sheets: [{ id: 'g-s-ply', name: 'Plywood', w: 1200, l: 2400, thicknesses: [12, 18] }],
  sources: [],
};

export const CATALOGUES: Record<CountryCode, Catalogue> = { AU, NZ, GB, IE, US, CA, OTHER: GENERIC };

export function materialsFor(c: CountryCode): Catalogue {
  return CATALOGUES[c] ?? GENERIC;
}

/** Longest stock length of a section (for "won't fit" hints). */
export function longest(f: Framing): number {
  return f.lengths.length ? Math.max(...f.lengths) : 0;
}

/** The everyday wall-stud section per country: the cut list's starting stock. */
const DEFAULT_FRAMING: Record<CountryCode, string> = { AU: 'au-90x45', NZ: 'nz-90x45', GB: 'gb-cls89', IE: 'ie-100x44', US: 'us-2x4', CA: 'ca-2x4', OTHER: 'g-90x45' };

export function defaultFraming(c: CountryCode) {
  const cat = materialsFor(c);
  return cat.framing.find((f) => f.id === DEFAULT_FRAMING[c]) ?? cat.framing[0];
}
