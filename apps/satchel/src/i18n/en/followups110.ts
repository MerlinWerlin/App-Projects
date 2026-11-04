// Strings for followups110 (run 111). Every UI string lives in the catalogue.
// T157: run-110 follow-ups (prefix f110.).
export const followups110 = {
  // Toilets map view: wheelchair-accessible toilets get their own pin (src/core/toiletpins.ts) and a legend under the map.
  'f110.toilets.legendLabel': 'Pins on this map',
  'f110.toilets.legend.accessible': 'Wheelchair accessible toilet',
  'f110.toilets.legend.toilet': 'Toilet',
  'f110.toilets.legendNote': 'Saved toilets are amber and ones closed now are grey; the symbol still shows which kind it is.',
  'f110.toilets.pinAccessibleA11y': '{name}, wheelchair accessible toilet',
  // "Where is the lift?" full-screen phrase card (app/phrase-card.tsx?phrase=lift, src/core/liftcard.ts).
  'f110.lift.ask': 'Ask for a lift',
  'f110.lift.askHint': 'Shows “Where is the lift?” in the local language, full screen',
  'f110.lift.check': 'Not yet checked by a native speaker. If someone looks puzzled, show them the English too.',
} as const;
