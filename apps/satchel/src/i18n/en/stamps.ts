// Strings for stamps (run 95, T103 "Passport stamps": app/passport.tsx, src/ui/Stamp.tsx, the Passport card on Your
// travels and the stamps section of a trip recap). Every UI string lives in the catalogue. Keys prefixed "stamps.".
export const stamps = {
  'stamps.route': 'Passport',

  // Screen header
  'stamps.eyebrow': 'Your travels',
  'stamps.title': 'Passport',
  'stamps.subtitle': 'A stamp for every country and city you’ve reached, newest first.',

  // Counts
  'stamps.count.countries': 'Countries',
  'stamps.count.cities': 'Cities',
  'stamps.count.continents': 'Continents',

  // On the stamp (drawn in capitals) and read aloud
  'stamps.mark.arrived': 'Arrived',
  'stamps.mark.departed': 'Departed',
  'stamps.kind.country': 'country stamp',
  'stamps.kind.city': 'city stamp',
  'stamps.stamp.a11y': '{place}, {kind}. {mark} {date}. From {trip}.',
  'stamps.stamp.hint': 'Opens the recap of the trip this stamp came from.',
  'stamps.stamp.first': 'First stamp',
  'stamps.stamp.firstA11y': 'First stamp, earned on this trip.',

  // Paper pages
  'stamps.page.label': 'Page {n} of {total}',
  'stamps.page.share': 'Share this page',
  'stamps.page.shareHint': 'Shares this page’s places and dates as text.',
  'stamps.share.note': 'Shared as text: places, dates and arrived or departed only. Never booking codes, seats or notes.',
  'stamps.share.failed': 'The share sheet didn’t open. Try again.',
  'stamps.share.subject': 'My Satchel passport',
  'stamps.share.heading': 'My Satchel passport',
  'stamps.share.counts': '{countries} countries · {cities} cities · {continents} continents',
  'stamps.share.line': '{place} · {mark} {date}',
  'stamps.share.footer': 'Made with Satchel',

  // A newly finished trip
  'stamps.fresh.eyebrow': 'Just back',
  'stamps.fresh.title': 'New stamps from {trip}',
  'stamps.fresh.one': 'One place you’d never been before.',
  'stamps.fresh.many': '{n} places you’d never been before.',

  // Empty and notes
  'stamps.empty.title': 'No stamps yet',
  'stamps.empty.body': 'Stamps appear once a trip has started: every country and city you reach earns one.',
  'stamps.empty.demoBody': 'The sample trip is hidden. Turn on Include demo trips to see what its stamps look like.',
  'stamps.empty.add': 'Add a trip',
  'stamps.empty.addHint': 'Opens a new trip.',
  'stamps.note': 'Worked out on this phone from your bookings. Upcoming trips earn stamps once you get there, and your home country gets one too.',
  'stamps.demoLeftOut': 'The sample trip’s stamps are hidden.',

  // Card on Your travels
  'stamps.card.title': 'Passport stamps',
  'stamps.card.subtitle': 'Your latest stamps. Tap one for its trip.',
  'stamps.card.count': '{n} stamps so far',
  'stamps.card.open': 'Open passport',
  'stamps.card.openHint': 'Shows every stamp on paper pages.',

  // Trip recap section
  'stamps.recap.title': 'Passport stamps',
  'stamps.recap.subtitle': 'Places this trip took you. New ones carry a First stamp ribbon.',
  'stamps.recap.none': 'No stamps from this trip yet.',
  'stamps.recap.open': 'Open passport',
  'stamps.recap.openHint': 'Shows every stamp you’ve collected.',
} as const;
