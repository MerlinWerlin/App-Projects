// Strings for followups103 (run 104). Every UI string lives in the catalogue.
// T134: run-103 offline follow-ups (prefix f103.): one connection's own limits on its card, and a long layover's
// link to the arrival card for the change country (the trip screen opens that stop's card).
export const followups103 = {
  'f103.limits.open': 'Limits for this change',
  'f103.limits.openHint': 'Shows when this change counts as tight or long. You can set its own limits.',
  'f103.limits.close': 'Hide the limits',
  'f103.limits.closeHint': 'Hides this change’s limits.',
  'f103.limits.title': 'Limits for this change only',
  'f103.limits.own': 'Using this change’s own limits',
  'f103.limits.usual': 'Using your usual limits from Settings',
  'f103.limits.tightLabel': 'Tight change here',
  'f103.limits.tight': 'Tight under {min} min',
  'f103.limits.longLabel': 'Long layover here',
  'f103.limits.long': 'Long over {d}',
  'f103.limits.body': 'Saved on this phone for this change only. Check the minimum connection time with whoever sold the ticket.',
  'f103.limits.reset': 'Use my usual limits',
  'f103.limits.resetHint': 'Removes this change’s own limits and goes back to the ones in Settings.',
  'f103.arrival.open': 'Arrival card for {country}',
  'f103.arrival.openHint': 'Shows the arrival card for {country} at the top of this trip: time, money, plugs, emergency numbers and phrases.',
  'f103.arrival.eyebrowStop': 'A stop on {trip}',
  'f103.arrival.whenStop': 'A stop on your way',
  'f103.arrival.close': 'Close',
  'f103.arrival.closeHint': 'Closes this stop’s arrival card. The trip shows its usual card again.',
} as const;
