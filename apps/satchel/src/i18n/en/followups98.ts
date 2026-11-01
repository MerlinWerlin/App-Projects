// Strings for followups98 (run 99). Every UI string lives in the catalogue.
// T116: Call home zone set by hand for a travel day, the Call home entry on I'm safe.
export const followups98 = {
  'f98.callhome.zone.set': 'Set your zone for {day}',
  'f98.callhome.zone.setHint': 'For a travel day, such as an overnight flight, when the bookings leave you on the wrong clock',
  'f98.callhome.zone.manual': 'Zone set by hand: {city}',
  'f98.callhome.zone.reset': 'Use the bookings for {day}',
  'f98.callhome.zone.resetHint': 'Goes back to the zone your bookings give this day',
  'f98.callhome.zone.field': 'Your time zone on {day}',
  'f98.callhome.zone.fieldHint': 'Kept on this phone only, like the people you call. Search by city, country or UTC offset',
  'f98.callhome.zone.chip': 'Use {city}',
  'f98.callhome.zone.cancel': 'Cancel',
  'f98.callhome.zone.cancelHint': 'Keeps the zone this day has now',
  'f98.callhome.zone.err': 'Couldn’t save the zone on this phone. Try again.',
  'f98.callhome.days.body': 'Each day uses the time zone your bookings put you in that evening. On a travel day you can set it by hand.',
  'f98.safe.callhome': 'Plan a call home',
  'f98.safe.callhomeHint': 'Opens the call home planner: good times to call the people back home',
} as const;
