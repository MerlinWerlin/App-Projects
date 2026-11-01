// Strings for inflight (run 98, T113 "In-flight mode"). Every UI string lives in the catalogue.
export const inflight = {
  'inflight.route': 'In the air',

  // Card and screen heading
  'inflight.eyebrowAir': 'In the air · {trip}',
  'inflight.eyebrowBefore': 'Flying soon · {trip}',
  'inflight.eyebrowLanded': 'Just landed · {trip}',
  'inflight.titleAir': 'In the air',
  'inflight.titleBefore': 'Departs in {d}',
  'inflight.titleLanded': 'Landed in {city}',
  'inflight.routeLine': '{from} to {to} · {flight}',
  'inflight.headerA11y': '{title}. {from} to {to}, {flight}. {trip}.',
  'inflight.arcA11y': 'Flight path from {from} to {to}, {pct} percent of the way',
  'inflight.arcA11yBefore': 'Flight path from {from} to {to}, not left yet',

  // Time left and landing
  'inflight.timeLeftLabel': 'Time left',
  'inflight.timeLeft': '{d} to go',
  'inflight.ofTotal': 'of {d} flight time',
  'inflight.lands': 'Lands {time} {city} time',
  'inflight.landsOn': 'Lands {day}, {time} {city} time',
  'inflight.landedAgo': 'Landed {time} {city} time, {ago} ago',
  'inflight.departs': 'Departs {time} {city} time',
  'inflight.watch': 'Set your watch to {time}',
  'inflight.watchDiff': '{city} is {d} from {from}',
  'inflight.watchSame': 'Same time as {from}',

  // Before departure (Airport day)
  'inflight.leaveBy': 'Leave by {time}',
  'inflight.leavePassed': 'Leave-by time {time} has passed',
  'inflight.step.leave': 'Leave in {d}',
  'inflight.step.bagDrop': 'Bag drop closes in {d}',
  'inflight.step.boarding': 'Boarding in {d}',
  'inflight.step.departure': 'Departs in {d}',

  // Clocks
  'inflight.clocksTitle': 'Clocks now',
  'inflight.clockHome': 'Home, {city}',
  'inflight.clockDest': 'Destination, {city}',
  'inflight.clocksA11y': 'Home, {home}: {homeTime}. Destination, {dest}: {destTime}.',

  // When you land
  'inflight.landTitle': 'When you land',
  'inflight.landEmpty': 'Nothing saved for landing yet. Stay details, cash and an offline city map added to this trip show up here.',
  'inflight.check.arrival': 'Arrival card: local time, money, plugs and emergency numbers',
  'inflight.check.arrivalHint': 'Opens the trip with its arrival card',
  'inflight.check.stay': 'Stay details for {name}: room, codes and Wi-Fi',
  'inflight.check.stayHint': 'Opens the stay details',
  'inflight.check.address': 'Address card for the taxi: {name}',
  'inflight.check.addressHint': 'Opens the address card to show your driver',
  'inflight.check.cash': 'Cash on hand: {amounts}',
  'inflight.check.cashHint': 'Opens cash on hand',
  'inflight.check.map': 'Offline map of {city} is on your phone',
  'inflight.check.mapHint': 'Opens the Map tab',
  'inflight.check.toilets': 'Toilets from the {city} map, no signal needed',
  'inflight.check.toiletsHint': 'Opens the Toilets tab',
  'inflight.check.roaming': 'Switch on your eSIM or roaming',
  'inflight.check.roamingDone': 'eSIM or roaming sorted: switch it on after landing',
  'inflight.check.roamingHint': 'Opens the trip to-do list',

  // Jet lag
  'inflight.jetlagTitle': 'Jet lag',
  'inflight.jetlagEast': 'Your body clock moves {d} east.',
  'inflight.jetlagWest': 'Your body clock moves {d} west.',
  'inflight.jetlagSeek': 'On landing day, get daylight {from}–{to} local time.',
  'inflight.jetlagAvoid': 'Keep light low {from}–{to}.',
  'inflight.jetlagSettled': 'Keep to local meal and sleep times.',
  'inflight.jetlagNote': 'General guidance, not medical advice.',
  'inflight.jetlagOpen': 'Jet lag plan',
  'inflight.jetlagOpenHint': 'Opens the full jet lag plan for this trip',

  // Shortcuts
  'inflight.open': 'In-flight view',
  'inflight.openHint': 'Shows the flight path, clocks and what to do when you land',
  'inflight.ticket': 'Boarding pass',
  'inflight.ticketHint': 'Opens the ticket at full brightness',
  'inflight.trip': 'Open trip',
  'inflight.tripHint': 'Opens this trip’s timeline',

  // Notes and empty states
  'inflight.offline': 'Worked out from your booking on this phone, no internet needed. Times are as booked; delays won’t show.',
  'inflight.notFound': 'This flight isn’t in the air, leaving within a day or just landed.',
} as const;
