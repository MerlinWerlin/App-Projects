// T65 strings: "Your travels" stats (app/travels.tsx) and its card on the Trips tab (src/ui/TravelsCard.tsx). Keys prefixed "travels.".
export const travels = {
  'travels.route': 'Your travels',
  'travels.title': 'Your travels',
  'travels.subtitle': 'Worked out on this phone from your trips. Nothing leaves it.',
  'travels.eyebrow': 'So far',

  // Trips tab card
  'travels.card.title': 'Your travels',
  'travels.card.body': '{countries} countries · {days} days away · {km} km flown',
  'travels.card.bodyEmpty': 'Countries, days away and flights, all from your own trips.',
  'travels.card.a11y': 'Your travels. {countries} countries, {days} days away, {km} kilometres flown.',
  'travels.card.a11yEmpty': 'Your travels. Stats from your own trips.',
  'travels.card.hint': 'Opens your travel stats.',
  'travels.card.open': 'See all',

  // countdown
  'travels.next.title': 'Next trip',
  'travels.next.days': '{trip} in {n} days',
  'travels.next.tomorrow': '{trip} tomorrow',
  'travels.next.place': 'Heading to {place}',

  // stat tiles
  'travels.stat.countries': 'Countries',
  'travels.stat.cities': 'Cities',
  'travels.stat.daysAway': 'Days away',
  'travels.stat.thisYear': 'This year',
  'travels.stat.flights': 'Flights',
  'travels.stat.km': 'Km flown',

  // longest trip
  'travels.longest.title': 'Longest trip',
  'travels.longest.body': '{trip} · {n} days',
  'travels.longest.a11y': 'Longest trip: {trip}, {n} days',

  // world tiles
  'travels.world.title': 'Your world',
  'travels.world.subtitle': 'One tile per country, coloured as you visit. Outlined tiles are trips still to come.',
  'travels.world.a11y': 'Countries visited: {list}.',
  'travels.world.a11yNone': 'No countries visited yet.',
  'travels.world.a11yPlanned': 'Coming up: {list}.',
  'travels.world.home': 'Home country {country} is not counted.',
  'travels.world.planned': 'Coming up',
  'travels.world.more': '+{n}',
  'travels.region.americas': 'Americas',
  'travels.region.europe': 'Europe',
  'travels.region.africa': 'Africa',
  'travels.region.asia': 'Asia',
  'travels.region.oceania': 'Oceania',

  // cities
  'travels.cities.title': 'Cities',
  'travels.cities.note': 'Taken from hotel addresses, or from each booking’s time zone when there is no address.',

  // flights
  'travels.flights.title': 'Flights',
  'travels.flights.body': '{legs} flights · {km} km great-circle distance',
  'travels.flights.unmeasured': '{n} flights have no map point for an airport, so their distance isn’t counted. Satchel has no airport list yet; add a place with a map point to a flight to include it.',
  'travels.flights.none': 'No flights yet.',

  // demo option
  'travels.demo.toggle': 'Include demo trips',
  'travels.demo.hint': 'Counts the sample trip in your stats. Off by default so only your own trips count.',
  'travels.demo.leftOut': 'The demo trip is not counted.',

  // empty
  'travels.empty.title': 'Your travels start here',
  'travels.empty.body': 'Once a trip begins, Satchel counts its countries, cities, days away and flights, all on this phone.',
  'travels.empty.demoBody': 'Only the demo trip is saved. Turn on demo trips to preview your stats, or add a trip of your own.',
  'travels.empty.add': 'Add a trip',
  'travels.empty.addHint': 'Opens a new trip.',
} as const;
