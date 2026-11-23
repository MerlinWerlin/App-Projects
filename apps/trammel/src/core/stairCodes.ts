// Stair limits per country, each with its source. Values were read from the official text on 23 Nov 2026; a value
// that could not be verified is null (not checked) rather than guessed. Shown to the user as guidance: state,
// provincial and local amendments and the approved plans govern.
import type { CountryCode } from './country.ts';
import type { StairLimits } from './stairs.ts';

// ---------- Australia ----------
// ABCB, NCC 2022 Housing Provisions Standard, Part 11.2, clause 11.2.2, Table 11.2.2a (stairs other than spiral):
// riser 115-190, going 240-355, 2R+G 550-700; 2 to 18 risers a flight; no 125 mm sphere through open risers;
// adjacent risers/goings within 5 mm, largest to smallest within 10 mm.
// https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-112-stairway-and-ramp-construction
// NCC 2022 Volume One, clause D3D14, Table D3D14: public going 250-355, private going 240-355, otherwise as above.
// https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-one/d-access-and-egress/part-d3-construction-exits
const AU_NOTES = ['Keep every riser and going the same: 5 mm between neighbours, 10 mm across the flight', 'Open risers: no gap that lets a 125 mm sphere through'];
const AU: StairLimits[] = [
  { id: 'au-house', name: 'House (Class 1 & 10)', rMin: 115, rMax: 190, gMin: 240, gMax: 355, sMin: 550, sMax: 700, maxPitch: null, maxRisers: 18, minRisers: 2, source: 'NCC 2022 Housing Provisions 11.2.2, Table 11.2.2a', binding: true, notes: AU_NOTES },
  { id: 'au-public', name: 'Public (Class 2-9)', rMin: 115, rMax: 190, gMin: 250, gMax: 355, sMin: 550, sMax: 700, maxPitch: null, maxRisers: 18, minRisers: 2, source: 'NCC 2022 Volume One D3D14, Table D3D14 (public)', binding: true, notes: AU_NOTES },
  { id: 'au-private', name: 'Private (Class 2-9)', rMin: 115, rMax: 190, gMin: 240, gMax: 355, sMin: 550, sMax: 700, maxPitch: null, maxRisers: 18, minRisers: 2, source: 'NCC 2022 Volume One D3D14, Table D3D14 (private)', binding: true, notes: AU_NOTES },
];

// ---------- Anywhere else ----------
// No code is checked. A comfortable straight stair keeps 2R+G near 600-650 mm (Blondel's stride rule, 1675, the
// basis of the 2R+G rule in the codes above); shown as a note, never as a fail.
const GENERIC: StairLimits[] = [
  { id: 'generic', name: 'Comfort guide', rMin: null, rMax: null, gMin: null, gMax: null, sMin: 600, sMax: 650, maxPitch: null, maxRisers: null, minRisers: 2, source: 'Comfort guide only (2R+G 600-650 mm). No building code is checked for your country', binding: false, notes: ['Check the stair rules of your local building code before you cut'] },
];

// ---------- New Zealand ----------
// NZ Building Code clause D1, Acceptable Solution D1/AS1 (2nd edition, amendment 6, 2017): 4.1.1 and Table 6 (max
// riser, min tread, max pitch per stairway type), 4.1.3 uniformity (+-5 mm), 4.1.8 open risers (100 mm sphere where
// children under 6), Table 7 rise between landings (private and service 4.0 m, common and accessible 2.5 m).
// No 2R+G rule and no minimum riser. Height clearance 2 m (Table 1).
// https://building.govt.nz/assets/Uploads/building-code-compliance/d-access/d1-access-routes/asvm/d1-access-routes-2nd-edition-amendment6.pdf
const NZ_NOTES = ['Keep risers and treads within 5 mm of each other in a flight', 'Open risers: no gap that lets a 100 mm sphere through where young children may be', 'At least 2 m of headroom over the stair'];
const NZ: StairLimits[] = [
  { id: 'nz-main', name: 'Main private', rMin: null, rMax: 190, gMin: 280, gMax: null, sMin: null, sMax: null, maxPitch: 37, maxRisers: null, minRisers: 2, maxFlightRise: 4000, source: 'NZBC D1/AS1 Table 6 (main private stairways)', binding: true, notes: NZ_NOTES },
  { id: 'nz-common', name: 'Common', rMin: null, rMax: 190, gMin: 280, gMax: null, sMin: null, sMax: null, maxPitch: 37, maxRisers: null, minRisers: 2, maxFlightRise: 2500, source: 'NZBC D1/AS1 Table 6 (common stairways)', binding: true, notes: NZ_NOTES },
  { id: 'nz-secondary', name: 'Secondary private', rMin: null, rMax: 200, gMin: 250, gMax: null, sMin: null, sMax: null, maxPitch: 41, maxRisers: null, minRisers: 2, maxFlightRise: 4000, source: 'NZBC D1/AS1 Table 6 (secondary private stairways)', binding: true, notes: NZ_NOTES },
  { id: 'nz-minor', name: 'Minor private / service', rMin: null, rMax: 220, gMin: 220, gMax: null, sMin: null, sMax: null, maxPitch: 47, maxRisers: null, minRisers: 2, maxFlightRise: 4000, source: 'NZBC D1/AS1 Table 6 (service and minor private stairways)', binding: true, notes: NZ_NOTES },
  { id: 'nz-accessible', name: 'Accessible', rMin: null, rMax: 180, gMin: 310, gMax: null, sMin: null, sMax: null, maxPitch: 32, maxRisers: null, minRisers: 2, maxFlightRise: 2500, source: 'NZBC D1/AS1 Table 6 (accessible stairways)', binding: true, notes: ['No open risers on an accessible stair', NZ_NOTES[0], NZ_NOTES[2]] },
];

// ---------- United Kingdom (England) ----------
// Approved Document K (2013 edition, England), Section 1, Table 1.1: private stair rise 150-220, going 220-300, pitch
// max 42 deg; utility stair rise 150-190, going 250-400; general access stair rise 150-170, going 250-400; 2R+G
// 550-700 for all. 1.18: buildings other than dwellings max 16 (utility) / 12 (general access) risers a flight.
// 1.9: open risers in dwellings need 16 mm tread overlap and no 100 mm sphere through. Headroom 2.0 m (1.11-1.13).
// Wales, Scotland and Northern Ireland have their own rules (not checked here).
// https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf
const GB_NOTES = ['Open risers: treads overlap at least 16 mm and no gap that lets a 100 mm sphere through', 'At least 2.0 m of headroom (loft conversions: 1.9 m at the centre)', 'England only: Wales, Scotland and Northern Ireland have their own stair rules'];
const GB: StairLimits[] = [
  { id: 'gb-private', name: 'Private (one dwelling)', rMin: 150, rMax: 220, gMin: 220, gMax: 300, sMin: 550, sMax: 700, maxPitch: 42, maxRisers: null, minRisers: 2, source: 'Approved Document K (England), Table 1.1 (private stair)', binding: true, notes: GB_NOTES },
  { id: 'gb-utility', name: 'Utility stair', rMin: 150, rMax: 190, gMin: 250, gMax: 400, sMin: 550, sMax: 700, maxPitch: null, maxRisers: 16, minRisers: 2, source: 'Approved Document K (England), Table 1.1 (utility stair)', binding: true, notes: GB_NOTES.slice(1) },
  { id: 'gb-general', name: 'General access', rMin: 150, rMax: 170, gMin: 250, gMax: 400, sMin: 550, sMax: 700, maxPitch: null, maxRisers: 12, minRisers: 2, source: 'Approved Document K (England), Table 1.1 (general access stair)', binding: true, notes: GB_NOTES.slice(1) },
];

// ---------- Ireland ----------
// Technical Guidance Document K (2014), 1.1.4 and Table 1 (max rise, min going, max pitch; 2R+G 550-700, Note 4),
// 1.1.7-1.1.8 open risers (16 mm overlap, 100 mm sphere), 1.1.9 headroom 2 m, 1.1.11-1.1.12 max 16 risers a flight.
// https://assets.gov.ie/static/documents/technical-guidance-document-k-stairways-ladders-ramps-and-guards-2014.pdf
const IE_NOTES = ['Open risers: treads overlap at least 16 mm and no gap that lets a 100 mm sphere through', 'At least 2 m of headroom (loft conversions: 1.9 m at the centre)'];
const IE: StairLimits[] = [
  { id: 'ie-private', name: 'Private (dwelling)', rMin: null, rMax: 220, gMin: 220, gMax: null, sMin: 550, sMax: 700, maxPitch: 42, maxRisers: 16, minRisers: 2, source: 'TGD K 2014, Table 1 (private stair)', binding: true, notes: IE_NOTES },
  { id: 'ie-semipublic', name: 'Semi-public', rMin: null, rMax: 190, gMin: 250, gMax: null, sMin: 550, sMax: 700, maxPitch: 38, maxRisers: 16, minRisers: 2, source: 'TGD K 2014, Table 1 (semi-public stair)', binding: true, notes: IE_NOTES },
  { id: 'ie-public', name: 'Public', rMin: null, rMax: 180, gMin: 280, gMax: null, sMin: 550, sMax: 700, maxPitch: 33, maxRisers: 16, minRisers: 2, source: 'TGD K 2014, Table 1 (public stair)', binding: true, notes: IE_NOTES },
];

// ---------- United States ----------
// 2024 International Residential Code R318.7 (R311.7 in 2021 and earlier): riser max 7 3/4 in (196.85 mm), tread
// min 10 in (254 mm), flight vertical rise max 12 ft 7 in (3835.4 mm), tolerance 3/8 in, headroom 6 ft 8 in, open
// risers more than 30 in up must not pass a 4 in sphere. 2024 International Building Code 1011.5.2: riser 4-7 in
// (101.6-177.8 mm), tread min 11 in (279.4 mm); 1011.8 flight rise max 12 ft (3657.6 mm). No 2R+G rule. States and
// cities adopt different editions with amendments.
// https://codes.iccsafe.org/content/IRC2024P1/chapter-3-building-planning
// https://codes.iccsafe.org/content/IBC2024P1/chapter-10-means-of-egress
const US_TOL = 'Keep risers and treads within 3/8 in (9.5 mm) of each other';
const US: StairLimits[] = [
  { id: 'us-irc', name: 'Dwelling (IRC)', rMin: null, rMax: 196.85, gMin: 254, gMax: null, sMin: null, sMax: null, maxPitch: null, maxRisers: null, minRisers: 2, maxFlightRise: 3835.4, source: '2024 IRC R318.7 (R311.7 in earlier editions)', binding: true, notes: [US_TOL, 'Open risers more than 30 in up: no gap that passes a 4 in sphere', 'At least 6 ft 8 in of headroom', 'Check your state or city amendments'] },
  { id: 'us-ibc', name: 'Commercial (IBC)', rMin: 101.6, rMax: 177.8, gMin: 279.4, gMax: null, sMin: null, sMax: null, maxPitch: null, maxRisers: null, minRisers: 2, maxFlightRise: 3657.6, source: '2024 IBC 1011.5.2', binding: true, notes: [US_TOL, 'At least 80 in of headroom', 'Check your state or city amendments'] },
];

// ---------- Canada ----------
// National Building Code of Canada 2020, Division B, Part 9: Table 9.8.4.1 rise (private 125-200, public 125-180),
// Table 9.8.4.2 run (private 255-355, public 280 min), 9.8.3.3 flight height max 3.7 m, 9.8.4.4 tolerances (5 mm
// adjacent, 10 mm in a flight), 9.8.2.2 headroom (1950 private, 2050 public), 9.8.4.9 no open risers on public
// stairs. Provinces adopt the NBC with changes (Ontario, BC, Quebec and Alberta publish their own codes).
// https://publications.gc.ca/collections/collection_2022/cnrc-nrc/NR24-28-2020-eng.pdf
const CA_NOTES = ['Keep risers and runs within 5 mm of each other, 10 mm across the flight', 'Check your provincial code: Ontario, BC, Quebec and Alberta publish their own'];
const CA: StairLimits[] = [
  { id: 'ca-private', name: 'Private (dwelling)', rMin: 125, rMax: 200, gMin: 255, gMax: 355, sMin: null, sMax: null, maxPitch: null, maxRisers: null, minRisers: 2, maxFlightRise: 3700, source: 'NBC 2020 Tables 9.8.4.1 and 9.8.4.2 (private)', binding: true, notes: [...CA_NOTES, 'At least 1950 mm of headroom'] },
  { id: 'ca-public', name: 'Public', rMin: 125, rMax: 180, gMin: 280, gMax: null, sMin: null, sMax: null, maxPitch: null, maxRisers: null, minRisers: 2, maxFlightRise: 3700, source: 'NBC 2020 Tables 9.8.4.1 and 9.8.4.2 (public)', binding: true, notes: [...CA_NOTES, 'No open risers on public stairs', 'At least 2050 mm of headroom'] },
];

export const STAIR_CODES: Record<CountryCode, StairLimits[]> = { AU, NZ, GB, IE, US, CA, OTHER: GENERIC };

export function stairCodesFor(c: CountryCode): StairLimits[] {
  return STAIR_CODES[c] ?? GENERIC;
}

export function stairLimitsById(c: CountryCode, id: string | undefined): StairLimits {
  const list = stairCodesFor(c);
  return list.find((l) => l.id === id) ?? list[0];
}
