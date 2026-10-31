// T69 strings: a trip on the map (numbered stops per day, dashed day routes, day chips, the day summary card).
// Keys prefixed "triproute.".
export const triproute = {
  'triproute.seeOnMap': 'See on map',
  'triproute.seeOnMapHint': 'Opens the map with this trip’s bookings as numbered stops, day by day.',

  // day chips
  'triproute.days': 'Days',
  'triproute.allDays': 'All days',
  'triproute.day': 'Day {n}',
  'triproute.today': 'Today',
  'triproute.chipA11y': '{label}, {date}',
  'triproute.chipTodayA11y': '{label}, {date}, today',
  'triproute.allDaysA11y': 'All days of the trip',
  'triproute.chipHint': 'Shows only that day’s stops on the map.',

  // pins
  'triproute.pinA11y': 'Stop {n} on {day}: {kind}, {name}',
  'triproute.pinSubtitle': '{day} · {time} · {kind}',

  // summary card
  'triproute.heading': 'Trip on the map',
  'triproute.stopsOne': '1 stop',
  'triproute.stopsMany': '{n} stops',
  'triproute.summary': '{stops} · {distance} in straight lines',
  'triproute.summaryOne': '{stops}',
  'triproute.straightNote': 'Distances are straight lines between stops; walking routes are longer.',
  'triproute.dayNone': 'No bookings with a map position on this day.',
  'triproute.dayRow': '{day} · {date}',
  'triproute.dayRowA11y': '{day}, {date}: {summary}',
  'triproute.dayRowHint': 'Shows that day on the map.',
  'triproute.stopA11y': 'Stop {n}, {time}: {title}, {name}',
  'triproute.stopHint': 'Opens this booking.',
  'triproute.stopTime': '{time} · {name}',
  'triproute.stopTimeZone': '{time} {city} · {name}',
  'triproute.leg': '{distance} to the next stop',
  'triproute.directions': 'Directions',
  'triproute.directionsA11y': 'Walking directions from {from} to {to}',
  'triproute.directionsHint': 'Opens Apple Maps with walking directions between these two stops.',
  'triproute.directionsFailed': 'Couldn’t open Apple Maps on this phone.',
  'triproute.savedOne': 'Plus 1 saved place, shown with a bookmark colour.',
  'triproute.savedMany': 'Plus {n} saved places, shown with a bookmark colour.',

  // T72: journeys' departure / arrival stops
  'triproute.departs': '{kind} departure',
  'triproute.arrives': '{kind} arrival',
  'triproute.departsAt': 'Leave from {name}',
  'triproute.arrivesAt': 'Arrive at {name}',
  'triproute.transportStops': 'Stations & airports',
  'triproute.transportStopsHint': 'Shows or hides where journeys leave from and arrive, as stops on the route.',

  // empty state
  'triproute.emptyTitle': 'Nothing on the map yet',
  'triproute.emptyBody':
    'Stops show here when a booking’s place has a map position. Edit a booking and choose Set on map or Pick a saved place under its place. To keep a spot with this trip, tap it on the map above and choose Save place.',
  'triproute.emptyAction': 'Back to the trip',
  'triproute.emptyActionHint': 'Opens this trip’s timeline.',
} as const;
