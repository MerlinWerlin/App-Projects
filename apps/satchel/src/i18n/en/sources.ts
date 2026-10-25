// T25 strings (owned by T25). Prefix keys with the feature so they never clash.
// Emergency-number doubt and confidence lines. Never imply that a bundled number is verified.
export const sources = {
  'sources.numberDoubted': 'Number doubted — check locally',
  'sources.numberDoubtedA11y': 'Number doubted by a second review. Check locally before relying on it.',
  'sources.noteDoubted': 'A second review doubted this note. Check locally.',
  'sources.alsoDoubted': 'A second review also doubted: {fields}. Check locally.',
  'sources.field.entry': 'this whole entry',
  'sources.confidence': 'Table confidence: {level}. This is the import’s own rating, not a check against an official source.',
  'sources.level.high': 'high',
  'sources.level.medium': 'medium',
  'sources.level.low': 'low',
  'sources.level.unknown': 'not rated',
} as const;
