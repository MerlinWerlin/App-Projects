/**
 * Mitred frames and corners.
 *
 * A mitre joint bisects the corner, so for two members meeting at an interior corner angle C the saw is set
 * (180° − C) / 2 off square. A closed regular polygon of n sides has interior angles 180°(n − 2)/n, so each
 * cut is 180°/n off square (rectangle: 45°, hexagon: 30°, octagon: 22.5°).
 * Source: Machinery's Handbook, 31st ed., "Regular polygons"; and any carpentry/fabrication text on mitre joints
 * (e.g. Frankland, "The Pipe Fitter's and Pipe Welder's Handbook", mitre turns).
 *
 * Lengths: the outside (long point) and inside (short point) of a member differ by the member's face width w
 * (its width in the plane of the frame) times tan of the cut angle, at each end:
 *   long point − short point = 2 · w · tan(180°/n).
 * For a polygon, side = 2 · apothem · tan(180°/n); across flats = 2 · apothem (even n);
 * across corners = side / sin(180°/n).
 */
import { DEG, fail, fmt, positive, type Result, type Step } from './units.ts';

export function cornerMitre(cornerDeg: number): Result<{ cutDeg: number; sawDeg: number }> {
  if (!Number.isFinite(cornerDeg) || cornerDeg <= 0 || cornerDeg >= 180) return fail('Corner angle must be more than 0° and less than 180°.');
  const cut = (180 - cornerDeg) / 2;
  return {
    ok: true,
    value: { cutDeg: cut, sawDeg: cut },
    steps: [{ label: 'Mitre off square, each piece', formula: '(180° − corner) / 2', value: `(180 − ${fmt(cornerDeg, 1)}) / 2 = ${fmt(cut, 2)}°` }],
    warnings: [],
  };
}

export type PolygonSize = 'outsideSide' | 'insideSide' | 'outsideFlats' | 'insideFlats' | 'outsideCorners';

export interface PolygonInput {
  sides: number;
  width: number; // member face width in the plane of the frame, mm
  size: number; // mm
  sizeKind: PolygonSize;
}

export interface FrameResult {
  cutDeg: number;
  pieces: { label: string; qty: number; longPoint: number; shortPoint: number }[];
  totalLongPoint: number;
}

export function polygonFrame(i: PolygonInput): Result<FrameResult> {
  if (!Number.isInteger(i.sides) || i.sides < 3 || i.sides > 24) return fail('Sides must be a whole number from 3 to 24.');
  const bad = positive('member width', i.width) ?? positive('size', i.size);
  if (bad) return fail(bad);
  const n = i.sides;
  const half = (180 / n) * DEG;
  const tan = Math.tan(half);
  if ((i.sizeKind === 'outsideFlats' || i.sizeKind === 'insideFlats') && n % 2 !== 0) return fail('Across flats needs an even number of sides. Use side length or across corners.');
  let outsideApothem: number;
  const steps: Step[] = [];
  switch (i.sizeKind) {
    case 'outsideSide': outsideApothem = i.size / (2 * tan); break;
    case 'insideSide': outsideApothem = i.size / (2 * tan) + i.width; break;
    case 'outsideFlats': outsideApothem = i.size / 2; break;
    case 'insideFlats': outsideApothem = i.size / 2 + i.width; break;
    case 'outsideCorners': outsideApothem = (i.size / 2) * Math.cos(half); break;
  }
  const insideApothem = outsideApothem - i.width;
  if (insideApothem <= 0) return fail('The members are too wide for a frame that size: there is no opening left.');
  const long = 2 * outsideApothem * tan;
  const short = 2 * insideApothem * tan;
  const cut = 180 / n;
  steps.push({ label: 'Mitre off square, both ends', formula: '180° / sides', value: `180 / ${n} = ${fmt(cut, 2)}°` });
  steps.push({ label: 'Outside apothem (centre to outside face)', value: `${fmt(outsideApothem, 1)} mm` });
  steps.push({ label: 'Long point (outside edge)', formula: '2 × apothem × tan(180°/n)', value: `2 × ${fmt(outsideApothem, 1)} × ${fmt(tan, 4)} = ${fmt(long, 1)} mm` });
  steps.push({ label: 'Short point (inside edge)', formula: 'long − 2 × width × tan(180°/n)', value: `${fmt(long, 1)} − 2 × ${fmt(i.width, 1)} × ${fmt(tan, 4)} = ${fmt(short, 1)} mm` });
  return {
    ok: true,
    value: { cutDeg: cut, pieces: [{ label: 'Side', qty: n, longPoint: long, shortPoint: short }], totalLongPoint: long * n },
    steps,
    warnings: [],
  };
}

export interface RectInput {
  width: number; // frame size, mm
  height: number;
  member: number; // member face width, mm
  measured: 'outside' | 'inside';
}

export function rectFrame(i: RectInput): Result<FrameResult> {
  const bad = positive('frame width', i.width) ?? positive('frame height', i.height) ?? positive('member width', i.member);
  if (bad) return fail(bad);
  const ow = i.measured === 'outside' ? i.width : i.width + 2 * i.member;
  const oh = i.measured === 'outside' ? i.height : i.height + 2 * i.member;
  const iw = ow - 2 * i.member;
  const ih = oh - 2 * i.member;
  if (iw <= 0 || ih <= 0) return fail('The members are too wide for a frame that size: there is no opening left.');
  return {
    ok: true,
    value: {
      cutDeg: 45,
      pieces: [
        { label: 'Top and bottom', qty: 2, longPoint: ow, shortPoint: iw },
        { label: 'Sides', qty: 2, longPoint: oh, shortPoint: ih },
      ],
      totalLongPoint: 2 * ow + 2 * oh,
    },
    steps: [
      { label: 'Mitre off square, both ends', formula: '180° / 4', value: '45°' },
      { label: 'Outside size', value: `${fmt(ow, 1)} × ${fmt(oh, 1)} mm` },
      { label: 'Short point = long point − 2 × member width', formula: 'tan 45° = 1', value: `${fmt(ow, 1)} − 2 × ${fmt(i.member, 1)} = ${fmt(iw, 1)} mm; ${fmt(oh, 1)} − 2 × ${fmt(i.member, 1)} = ${fmt(ih, 1)} mm` },
    ],
    warnings: [],
  };
}
