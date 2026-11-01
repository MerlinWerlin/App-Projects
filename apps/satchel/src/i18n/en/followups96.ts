// Strings for followups96 (run 97, T108 run-96 follow-ups (gift pins on the trip map, tip back to the expense form, holiday rule fixes)). Every UI string lives in the catalogue.
export const followups96 = {
  // Gift map spots on the Map tab.
  'f96.gift.pinSub': 'Gift for {name}',
  'f96.gift.pinA11y': 'Gift: {what}, for {name}. Opens the gift.',
  'f96.gift.opened': 'Editing {what}.',
  // "Work out a tip" from an open expense form.
  'f96.tip.fromExpenseHint': 'Opens the tip calculator. The total with the tip comes back into this expense.',
  'f96.tip.useTotal': 'Use this total',
  'f96.tip.useTotalHint': 'Puts {amount} in the expense you were adding and goes back to it.',
  'f96.tip.useMine': 'Use my share',
  'f96.tip.useMineHint': 'Puts your share, {amount}, in the expense you were adding and goes back to it.',
  'f96.tip.filled': 'Amount set to {amount} {code}, tip included.',
  // Round-up steps not yet checked against the central bank's notes and coins.
  'f96.tip.stepRecheck': 'Rounding to {step} is a rough step for {code}; check which notes and coins are in use locally.',
} as const;
