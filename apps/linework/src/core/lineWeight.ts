// F4 template line thickness (owner 17 Oct) for the template detail sheet (T82): the three weights, their stroke
// scale, the AsyncStorage key they are remembered under, and a tolerant parser. app/trace.tsx and app/lightbox.tsx
// keep their own inline copies (they mirror the owner's PC copy); lineWeight.test.ts checks all three agree.
// Pure, so the mapping is tested. Every weight is free (tracing tools are never gated).
import { DEFAULT_STROKE_WIDTH, type Template } from './templates.ts';

export type LineWeight = 'thick' | 'medium' | 'thin';

/** Cycle / display order: thick → medium → thin. */
export const LINE_WEIGHTS: readonly LineWeight[] = ['thick', 'medium', 'thin'];

export const DEFAULT_LINE_WEIGHT: LineWeight = 'thick';

/** AsyncStorage key (unchanged since F4, so a saved choice carries over). */
export const LINE_WEIGHT_KEY = 'linework.templateLineWeight';

export const LINE_SCALE: Readonly<Record<LineWeight, number>> = { thick: 1, medium: 0.6, thin: 0.35 };

export function isLineWeight(v: unknown): v is LineWeight {
  return typeof v === 'string' && (LINE_WEIGHTS as readonly string[]).includes(v);
}

/** A stored value back to a weight; anything unknown (null, junk, old data) is the default. */
export function parseLineWeight(v: unknown): LineWeight {
  return isLineWeight(v) ? v : DEFAULT_LINE_WEIGHT;
}

export function nextLineWeight(w: LineWeight): LineWeight {
  const i = LINE_WEIGHTS.indexOf(w);
  return LINE_WEIGHTS[(i + 1) % LINE_WEIGHTS.length];
}

export function lineScale(w: LineWeight): number {
  return LINE_SCALE[w] ?? 1;
}

/** Stroke width (viewBox units) for a template drawn at weight `w`. */
export function templateStroke(tpl: Pick<Template, 'strokeWidth'>, w: LineWeight): number {
  return (tpl.strokeWidth ?? DEFAULT_STROKE_WIDTH) * lineScale(w);
}
