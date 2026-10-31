// T76 strings: run-88 follow-ups. Keys prefixed "f88.".
export const followups88 = {
  // booking position picker: downloaded city tiles
  'f88.position.offlineCity': 'Showing your downloaded {city} map. It works without signal.',

  // Find my way back: rename a dropped pin
  'f88.wayback.rename': 'Rename',
  'f88.wayback.renameA11y': 'Rename {name}',
  'f88.wayback.renameHint': 'Gives this pin your own name.',
  'f88.wayback.renameLabel': 'New name',
  'f88.wayback.renameSave': 'Save name',
  'f88.wayback.renameSaveHint': 'Saves the new name for this pin.',
  'f88.wayback.renameCancelHint': 'Keeps the old name.',
  'f88.wayback.renamed': 'Renamed to {name}.',

  // packing: quantity on a row
  'f88.packing.editItem': 'Edit {label}',
  'f88.packing.editHint': 'Change this item’s name or how many to pack.',
  'f88.packing.qtyLabel': 'How many',
  'f88.packing.qtyNone': 'No number',
  'f88.packing.qtyLess': 'One fewer {label}',
  'f88.packing.qtyMore': 'One more {label}',
  'f88.packing.qtySuggested': 'Use the suggested × {qty}',
  'f88.packing.qtyClear': 'Clear the number',
  'f88.packing.qtySuggestedHint': 'Goes back to the number worked out from the trip’s nights.',

  // weather: every stop
  'f88.weather.stops': 'Trip stops',
  'f88.weather.stopPast': 'No trip days left at this stop.',

  // airport day
  'f88.airport.useDefaultBuffer': 'Use my default ({min} min, {scope})',
  'f88.airport.scopeAuto': 'Guess from the time zones',
  'f88.airport.scopeAutoHint': 'Goes back to telling domestic from international by the two airports’ time zones.',

  // licences: OFL notice and summaries
  'f88.licences.oflTitle': 'Font licence',
  'f88.licences.oflIntro': 'Satchel bundles these fonts under the SIL Open Font License 1.1. The licence asks for each copyright notice and the licence text to come with them.',
  'f88.licences.oflFont': '{family} ({weights})',
  'f88.licences.oflShow': 'Show the full licence text',
  'f88.licences.oflHide': 'Hide the licence text',
  'f88.licences.oflShowHint': 'Shows or hides the SIL Open Font License 1.1 in full.',
  'f88.licences.summary.mit': 'In short: free to use, copy and change, as long as the copyright and licence notice stay with it. No warranty.',
  'f88.licences.summary.ofl': 'In short: free to use and bundle with apps; the font files can’t be sold on their own, and changed versions must not use the original name.',
  'f88.licences.summary.odbl': 'In short: free to use with credit to OpenStreetMap; a changed version of the database must be shared under the same licence.',
  'f88.licences.summary.odblBsd': 'In short: the map data is ODbL (credit OpenStreetMap, share changes to the data alike); the code is free to use with its notice kept.',
  'f88.licences.summary.ccby': 'In short: free to use and share, as long as the source is credited.',
  'f88.licences.summary.pd': 'In short: no copyright restrictions.',
  'f88.licences.summaryNote': 'The “in short” lines are general guidance in plain words, not legal advice. The licence itself is what counts.',
} as const;
