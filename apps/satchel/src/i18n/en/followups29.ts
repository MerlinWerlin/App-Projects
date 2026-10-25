// T29 strings (owned by T29): saved places on the map (FLOWS §11.1-11.2). Keys prefixed 'places.' so they never
// clash with other features.
export const followups29 = {
  'places.heading': 'Saved places',
  'places.none': 'Tap a pin or a spot on the map, then Save place to keep it with a trip.',
  'places.tapHint': 'Tap the map to pick a spot.',
  'places.open': '{name}, saved to {trip}',
  'places.openHint': 'Shows the saved place on the map',
  'places.pinA11y': 'Saved place: {name}',
  'places.savedTo': 'Saved to {trip}',

  'places.dropped': 'Dropped pin',
  'places.droppedBody': 'A spot you tapped on the map',
  'places.position': 'Position {lat}, {lon}',

  'places.save': 'Save place',
  'places.saveHint': 'Keeps this place with a trip, on this phone',
  'places.saveTitle': 'Save this place',
  'places.name': 'Name',
  'places.trip': 'Save to trip',
  'places.chooseTrip': 'No trip is on today. Choose which trip to keep it with.',
  'places.noTrips': 'Add a trip first, then save places to it.',
  'places.confirm': 'Save',
  'places.confirmHint': 'Saves the place with the chosen trip',
  'places.cancelHint': 'Goes back without saving',
  'places.err.name': 'Give the place a name.',
  'places.err.position': 'This spot has no usable position. Tap the map again.',
  'places.err.trip': 'Choose a trip to save it to.',
  'places.saved': 'Saved {name} to {trip}.',
  'places.updated': 'Updated {name} in {trip}.',

  'places.remove': 'Remove from trip',
  'places.removeHint': 'Asks before removing this place from the trip',
  'places.removeConfirm': 'Remove {name} from {trip}?',
  'places.removeConfirmBody': 'Only the saved place is removed. Your bookings stay as they are.',
  'places.removeAction': 'Remove',
  'places.removed': 'Removed {name} from {trip}.',
} as const;
