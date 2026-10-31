// T72 strings: a booking's map position in the booking form (Set on map, Pick a saved place, Remove) and the two
// sheets behind it. Keys prefixed "position.".
export const position = {
  // which place (field label)
  'position.place': 'Place on the map',
  'position.from': 'Departure on the map',
  'position.to': 'Arrival on the map',

  // field state
  'position.set': 'On the map · {coords}',
  'position.setA11y': '{field}: set, {coords}',
  'position.none': 'Not on the map yet. Set it to see this booking on the trip map and to get weather for it.',
  'position.noneA11y': '{field}: not set',

  // field buttons
  'position.onMap': 'Set on map',
  'position.change': 'Change on map',
  'position.onMapHint': 'Opens a map. Tap where this place is.',
  'position.pick': 'Pick a saved place',
  'position.pickHint': 'Lists the places saved with this trip and the places its other bookings have.',
  'position.remove': 'Remove position',
  'position.removeHint': 'Takes this place off the map. Its name and address stay.',

  // map sheet
  'position.mapTitle': 'Where is it?',
  'position.mapBody': 'Tap the map at the spot, then choose Use this spot. This trip’s places show as pins: tap one to use it.',
  'position.mapLabel': 'Map for choosing the spot',
  'position.mapFallbackTitle': 'The map can’t show here',
  'position.mapFallbackBody': 'Pick one of this trip’s places from the list instead.',
  'position.chosen': 'Chosen: {coords}',
  'position.chosenNamed': 'Chosen: {name} · {coords}',
  'position.notChosen': 'Nothing chosen yet.',
  'position.chosenPin': 'Chosen spot',
  'position.choicePinA11y': '{name}. Tap to use this place.',
  'position.use': 'Use this spot',
  'position.useHint': 'Puts this spot in the booking form. Save the booking to keep it.',
  'position.cancelHint': 'Closes without changing the position.',

  // list sheet
  'position.listTitle': 'Pick a place',
  'position.listEmpty': 'No places on this trip yet. Save places from the Map tab, or set the spot on the map.',
  'position.sourceSaved': 'Saved place',
  'position.sourceSample': 'Saved place · sample data, not a real place',
  'position.sourceBooking': 'From {booking}',
  'position.rowA11y': '{name}, {source}',
  'position.rowHint': 'Uses this place’s position for the booking.',
} as const;
