/**
 * Mass of steel and aluminium sections: mass = cross-section area × length × density.
 *
 * Densities (kg/m³):
 *   Mild / structural steel 7850 — the value used for the mass tables of AS/NZS 3679.1, AS/NZS 1163 and
 *     AS/NZS 3678 (and EN 10025 / EN 10219).
 *   Stainless 304 (1.4301) 7900 and 316 (1.4401) 8000 — EN 10088-1:2014, Annex A, Table A.1.
 *   Aluminium 6061 2700 and 5083 2660 — Aluminum Association, "Aluminum Standards and Data", typical properties.
 *
 * Areas:
 *   Plate / flat bar  A = w · t
 *   Round bar         A = π d² / 4
 *   CHS (round tube)  A = π (D² − (D − 2t)²) / 4
 *   SHS / RHS         A = 2t(B + H − 2t) − (4 − π)(ro² − ri²)       EN 10219-2:2006, Annex B (B.2),
 *                     with ro = 2t, ri = t for t ≤ 6; 2.5t / 1.5t for 6 < t ≤ 10; 3t / 2t above  (EN 10219-2 Table A)
 *                     e.g. 50×50×3 SHS: 540.8 mm² → 4.25 kg/m, as in the Australian Tube Mills catalogue.
 *   Angle (L)         A = t (a + b − t)  — root and toe radii ignored, so within ~1–2 % of rolled-section tables.
 *   Square bar        A = s²
 */
import { fail, fmt, positive, type Result, type Step } from './units.ts';

export const MATERIALS = {
  mild: { name: 'Mild steel', density: 7850 },
  ss304: { name: 'Stainless 304', density: 7900 },
  ss316: { name: 'Stainless 316', density: 8000 },
  al6061: { name: 'Aluminium 6061', density: 2700 },
  al5083: { name: 'Aluminium 5083', density: 2660 },
} as const;
export type MaterialId = keyof typeof MATERIALS;

export const SHAPES = {
  plate: { name: 'Plate / sheet', dims: ['width', 'thickness'] },
  flat: { name: 'Flat bar', dims: ['width', 'thickness'] },
  round: { name: 'Round bar', dims: ['diameter'] },
  square: { name: 'Square bar', dims: ['side'] },
  chs: { name: 'CHS (round tube / pipe)', dims: ['outside diameter', 'wall'] },
  shs: { name: 'SHS / RHS', dims: ['width', 'depth', 'wall'] },
  angle: { name: 'Angle', dims: ['leg A', 'leg B', 'thickness'] },
} as const;
export type ShapeId = keyof typeof SHAPES;

export interface WeightInput {
  shape: ShapeId;
  material: MaterialId;
  dims: number[]; // mm, in the order of SHAPES[shape].dims
  length: number; // mm (for plate, the second plan dimension)
  qty: number;
  pricePerKg?: number; // optional, any currency
}

export interface WeightResult {
  area: number; // mm²
  perMetre: number; // kg/m (for plate: kg per metre of length at that width)
  each: number; // kg
  total: number; // kg
  cost?: number;
}

export function rhsCornerRadii(t: number): { ro: number; ri: number } {
  if (t <= 6) return { ro: 2 * t, ri: t };
  if (t <= 10) return { ro: 2.5 * t, ri: 1.5 * t };
  return { ro: 3 * t, ri: 2 * t };
}

export function sectionArea(shape: ShapeId, d: number[]): Result<{ area: number; step: Step }> {
  const names = SHAPES[shape].dims;
  for (let k = 0; k < names.length; k++) {
    const bad = positive(names[k], d[k]);
    if (bad) return fail(bad);
  }
  switch (shape) {
    case 'plate':
    case 'flat': {
      const a = d[0] * d[1];
      return ok(a, { label: 'Area', formula: 'A = width × thickness', value: `${fmt(d[0], 1)} × ${fmt(d[1], 1)} = ${fmt(a, 1)} mm²` });
    }
    case 'round': {
      const a = (Math.PI * d[0] ** 2) / 4;
      return ok(a, { label: 'Area', formula: 'A = π d² / 4', value: `π × ${fmt(d[0], 1)}² / 4 = ${fmt(a, 1)} mm²` });
    }
    case 'square': {
      const a = d[0] ** 2;
      return ok(a, { label: 'Area', formula: 'A = s²', value: `${fmt(d[0], 1)}² = ${fmt(a, 1)} mm²` });
    }
    case 'chs': {
      const [D, t] = d;
      if (2 * t >= D) return fail('Wall must be less than half the outside diameter.');
      const a = (Math.PI * (D ** 2 - (D - 2 * t) ** 2)) / 4;
      return ok(a, { label: 'Area', formula: 'A = π (D² − (D − 2t)²) / 4', value: `π × (${fmt(D, 1)}² − ${fmt(D - 2 * t, 1)}²) / 4 = ${fmt(a, 1)} mm²` });
    }
    case 'shs': {
      const [B, H, t] = d;
      if (2 * t >= Math.min(B, H)) return fail('Wall must be less than half the smaller side.');
      const { ro, ri } = rhsCornerRadii(t);
      if (ro > Math.min(B, H) / 2) return fail('That section is too small for its wall: the corner radii overlap.');
      const a = 2 * t * (B + H - 2 * t) - (4 - Math.PI) * (ro ** 2 - ri ** 2);
      return ok(a, { label: 'Area (EN 10219-2, rounded corners)', formula: 'A = 2t(B + H − 2t) − (4 − π)(ro² − ri²)', value: `ro = ${fmt(ro, 1)}, ri = ${fmt(ri, 1)} → ${fmt(a, 1)} mm²` });
    }
    case 'angle': {
      const [a1, b1, t] = d;
      if (t >= Math.min(a1, b1)) return fail('Thickness must be less than the legs.');
      const a = t * (a1 + b1 - t);
      return ok(a, { label: 'Area (sharp corners)', formula: 'A = t (a + b − t)', value: `${fmt(t, 1)} × (${fmt(a1, 1)} + ${fmt(b1, 1)} − ${fmt(t, 1)}) = ${fmt(a, 1)} mm²` });
    }
  }
}

function ok(area: number, step: Step): Result<{ area: number; step: Step }> {
  return { ok: true, value: { area, step }, steps: [step], warnings: [] };
}

export function weight(i: WeightInput): Result<WeightResult> {
  const mat = MATERIALS[i.material];
  if (!mat) return fail('Pick a material.');
  const area = sectionArea(i.shape, i.dims);
  if (!area.ok) return area;
  const bad = positive('length', i.length);
  if (bad) return fail(bad);
  if (!Number.isInteger(i.qty) || i.qty < 1) return fail('Quantity must be a whole number, 1 or more.');
  const perMetre = (area.value.area * 1e-6) * mat.density; // mm² → m², × kg/m³ = kg/m
  const each = perMetre * (i.length / 1000);
  const total = each * i.qty;
  const steps: Step[] = [
    area.value.step,
    { label: `Mass per metre (${mat.name}, ${mat.density} kg/m³)`, formula: 'A × 10⁻⁶ × density', value: `${fmt(area.value.area, 1)} × 10⁻⁶ × ${mat.density} = ${fmt(perMetre, 3)} kg/m` },
    { label: 'Each piece', formula: 'kg/m × length (m)', value: `${fmt(perMetre, 3)} × ${fmt(i.length / 1000, 3)} = ${fmt(each, 3)} kg` },
    { label: 'Total', formula: 'each × quantity', value: `${fmt(each, 3)} × ${i.qty} = ${fmt(total, 2)} kg` },
  ];
  const value: WeightResult = { area: area.value.area, perMetre, each, total };
  if (i.pricePerKg !== undefined && Number.isFinite(i.pricePerKg) && i.pricePerKg > 0) {
    value.cost = total * i.pricePerKg;
    steps.push({ label: 'Cost', formula: 'total × price per kg', value: `${fmt(total, 2)} × ${fmt(i.pricePerKg, 2)} = ${fmt(value.cost, 2)}` });
  }
  const warnings = i.shape === 'angle' ? ['Angle mass ignores the root and toe radii: rolled-section tables are about 1–2 % heavier.'] : [];
  return { ok: true, value, steps, warnings };
}
