// T25 strings (owned by T25). Prefix keys with the feature so they never clash.
// Emergency-number doubt lines. Never imply that a number is verified (1.0.0: plain words, no pipeline jargon).
export const sources = {
  'sources.numberDoubted': 'Check this number locally',
  'sources.numberDoubtedA11y': 'This number may be out of date. Check locally before relying on it.',
  'sources.noteDoubted': 'This note may be out of date. Check locally.',
  'sources.alsoDoubted': 'These may be out of date: {fields}. Check locally.',
  'sources.field.entry': 'this whole entry',
} as const;
