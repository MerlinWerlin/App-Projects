// Strings for followups94 (run 95). Every UI string lives in the catalogue.
export const followups94 = {
  // Share list, grouped by bag.
  'f94.share.noBag': 'Not in a bag yet',
  // I'm safe: trusted contacts from the emergency card, remembered ticks.
  'f94.trust.heading': 'On your emergency card',
  'f94.trust.add': 'Add',
  'f94.trust.addA11y': 'Add {name} as a trusted contact',
  'f94.trust.addHint': 'Adds this person from your emergency card to your trusted contacts on this phone',
  'f94.trust.added': '{name} added as a trusted contact',
  'f94.ticks.remembered': 'Your ticks are remembered on this phone for next time.',
  // Plan my day: back to the hotel.
  'f94.back.toggle': 'Back to hotel at the end',
  'f94.back.hint': 'Adds a last walk back to tonight’s hotel. Remembered for this day.',
  'f94.back.onAnnounce': 'Walk back to the hotel added to the plan',
  'f94.back.offAnnounce': 'Walk back to the hotel taken off the plan',
  'f94.back.noHotel': 'Add tonight’s hotel with a map spot to plan the walk back.',
  'f94.back.title': 'Back to {name}',
  'f94.back.leg': '{distance} · about {time} on foot',
  'f94.back.legA11y': 'Back to {name}: {distance}, about {time} on foot',
  'f94.back.legLong': 'Too far to walk ({distance} in a straight line). Take transport back.',
  'f94.back.legSame': 'You end the day at your hotel.',
  'f94.back.directionsA11y': 'Walking directions back to {name}',
  // Plan my day: does it fit.
  'f94.fit.warn': 'May not fit: about {need} needed ({walk} walking + {stops}) but only {free} after {after}.',
  'f94.fit.warnA11y': 'Warning. May not fit before this booking: about {need} needed, {free} free after {after}.',
  'f94.fit.stopsOne': '1 stop at about {min} min',
  'f94.fit.stopsMany': '{n} stops at about {min} min each',
  'f94.fit.stopsNone': 'no stops',
  'f94.fit.far': 'One leg is too far to walk, so allow extra time for transport.',
  'f94.fit.summaryOne': '1 gap between bookings may be too tight. Move a stop or skip one.',
  'f94.fit.summaryMany': '{n} gaps between bookings may be too tight. Move a stop or skip one.',
} as const;
