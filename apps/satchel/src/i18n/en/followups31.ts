// T31 strings (owned by T31). Prefix keys with the feature so they never clash.
// The error.* keys are the docs/spec/STATES_COPY.md keys, word for word (their button is common.tryAgain).
export const followups31 = {
  // Settings: Appearance (FLOWS §12)
  'settings.appearance': 'Appearance',
  'settings.appearance.system': 'System',
  'settings.appearance.light': 'Light',
  'settings.appearance.dark': 'Dark',
  'settings.appearanceBody': 'System follows your phone’s light or dark setting.',

  // Save and load errors (STATES_COPY)
  'error.trips.load.title': 'Trips didn’t load',
  'error.trips.load.body': 'The saved trips couldn’t be read. Close and reopen Satchel. If this keeps happening, contact support before reinstalling the app.',
  'error.trips.loadRetryHint': 'Tries to read the saved trips again',
  'error.trips.loadStill': 'The saved trips still couldn’t be read.',
  'error.trips.save.title': 'Trip wasn’t saved',
  'error.trips.save.body': 'The change couldn’t be saved on this device. Check available storage and try again.',
  'error.item.save.title': 'Item wasn’t saved',
  'error.item.save.body': 'The change couldn’t be saved on this device. Check available storage and try again.',
  'error.saveRetryHint': 'Tries to save the change again',

  // Booking form: the place's phone (shown on the address card)
  'itemEdit.placePhone': 'Phone',
  'itemEdit.placePhonePlaceholder': '+81 3 0000 0000',

  // Trip timeline: saved places and the trip-scoped map
  'timeline.places': 'Saved places',
  'timeline.placesNone': 'No saved places yet. Save places from the trip map to keep them with this trip.',
  'timeline.placeOpen': 'Show {name} on the trip map',
  'timeline.placeOpenHint': 'Opens the map at this place, where you can also remove it',
  'timeline.placeSample': 'Sample',

  // Map scoped to one trip
  'map.scoped': 'Showing {trip} only',
  'map.showAll': 'Show all trips',
  'map.showAllHint': 'Shows bookings and saved places from every trip',
} as const;
