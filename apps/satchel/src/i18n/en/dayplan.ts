// Strings for dayplan (run 94). Every UI string lives in the catalogue.
// T98 Plan my day: a walking route for one trip day (src/core/dayplan.ts, app/dayplan/[tripId].tsx).
export const dayplan = {
  'dayplan.route': 'Plan my day',
  'dayplan.title': 'Plan my day',
  'dayplan.notFound': 'This trip is no longer on this phone.',

  // entry on the trip screen
  'dayplan.open': 'Plan my day',
  'dayplan.openA11y': 'Plan my day for {day}',
  'dayplan.openHint': 'Opens a walking plan for this day: your bookings in place and your ideas in a short route.',

  // day switcher
  'dayplan.dayLabel': 'Day {n} · {date}',
  'dayplan.prev': 'Previous day',
  'dayplan.prevHint': 'Shows the plan for the day before.',
  'dayplan.next': 'Next day',
  'dayplan.nextHint': 'Shows the plan for the day after.',

  // start point
  'dayplan.start.heading': 'Start from',
  'dayplan.start.hotel': 'Hotel',
  'dayplan.start.hotelA11y': 'Start from your hotel, {name}',
  'dayplan.start.noHotel': 'No hotel',
  'dayplan.start.noHotelA11y': 'Start from your hotel: no hotel with a map position for the night before this day',
  'dayplan.start.here': 'Where I am',
  'dayplan.start.hereA11y': 'Start from where you are now',
  'dayplan.start.hint': 'Changes where the walk starts. The order is worked out again.',
  'dayplan.start.checking': 'Checking where you are…',
  'dayplan.start.once': 'Your position is checked once, only now. Nothing is tracked or stored.',
  'dayplan.start.none': 'No start point: the walk begins at the first stop.',
  'dayplan.start.unavailable': "Couldn't find where you are just now. The plan starts from your hotel instead.",
  'dayplan.start.hotelName': 'Your hotel: {name}',
  'dayplan.start.hereName': 'Where you are',

  // map
  'dayplan.map.a11y': 'Map of the day plan: numbered stops joined by a line.',
  'dayplan.map.noMapTitle': 'Stops in order',
  'dayplan.map.noMapBody': 'The map is not available in this version of the app, so here are the stops as a list.',
  'dayplan.pin.start': 'Start: {name}',
  'dayplan.pin.stopA11y': 'Stop {n}: {name}',

  // summary
  'dayplan.summary': '{stops} · about {distance} on foot · about {time}',
  'dayplan.summaryNoWalk': '{stops}',
  'dayplan.stopsOne': '1 stop',
  'dayplan.stopsMany': '{n} stops',
  'dayplan.approx': 'Approximate: the straight line between stops times 1.3 for streets, at an easy walking pace. Check the way when you are there.',
  'dayplan.suggested': 'Suggested order: bookings stay at their times and the other stops go where they add the least walking.',
  'dayplan.manual': 'Your own order.',
  'dayplan.reset': 'Use suggested order',
  'dayplan.resetHint': 'Forgets your own order for this day and puts the stops in the shortest order again.',
  'dayplan.resetDone': 'Back to the suggested order.',

  // time
  'dayplan.min': '{n} min',
  'dayplan.hourMin': '{h} h {m} min',
  'dayplan.timeZone': '{time} {city} time',

  // legs
  'dayplan.leg': 'About {distance} on foot · {time}',
  'dayplan.legA11y': 'From {from} to {to}: about {distance} on foot, {time}.',
  'dayplan.legSame': 'Same place',
  'dayplan.legRide': 'Travel by {kind}',
  'dayplan.legLong': 'About {distance} away: too far to walk, so plan transport for this part.',
  'dayplan.longLeft': 'Parts too far to walk are left out of the walking total.',
  'dayplan.directions': 'Walk',
  'dayplan.directionsA11y': 'Walking directions from {from} to {to} in Apple Maps',
  'dayplan.directionsHint': 'Opens Apple Maps with walking directions for this part. Needs a connection.',
  'dayplan.directionsFailed': "Couldn't open Apple Maps on this phone.",

  // leave by
  'dayplan.leave.walk': 'Leave {from} by {time}',
  'dayplan.leave.walkStart': 'Leave by {time}',
  'dayplan.leave.airport': 'Leave for the airport by {time}',
  'dayplan.leave.walkNote': 'Walking time plus 5 minutes, approximate.',
  'dayplan.leave.airportNote': 'From your airport travel time and buffer. General guidance: check with your airline.',
  'dayplan.leave.tight': 'Tight: that is before your previous booking starts.',

  // stops
  'dayplan.stop.idea': 'Idea · {cat}',
  'dayplan.stop.ideaDone': 'Idea · {cat} · Been there',
  'dayplan.stop.place': 'Saved place',
  'dayplan.stop.time': '{time} · {kind}',
  'dayplan.stop.departs': '{time} · {kind} departs',
  'dayplan.stop.arrives': '{time} · {kind} arrives',
  'dayplan.stop.bookingA11y': 'Stop {n}, {time}: {title}, {name}',
  'dayplan.stop.ideaA11y': 'Stop {n}: {name}, idea',
  'dayplan.stop.placeA11y': 'Stop {n}: {name}, saved place',
  'dayplan.stop.openBooking': 'Opens this booking.',
  'dayplan.stop.openIdea': 'Opens this idea to edit or plan it.',
  'dayplan.stop.openPlace': 'Shows this place on the trip map.',
  'dayplan.up': 'Move up',
  'dayplan.down': 'Move down',
  'dayplan.upA11y': 'Move {name} up',
  'dayplan.downA11y': 'Move {name} down',
  'dayplan.upHint': 'Visits this stop one place earlier. Bookings keep their times.',
  'dayplan.downHint': 'Visits this stop one place later. Bookings keep their times.',
  'dayplan.movedUp': '{name} moved up.',
  'dayplan.movedDown': '{name} moved down.',
  'dayplan.removePlace': 'Take off this day',
  'dayplan.removePlaceA11y': 'Take {name} off this day',
  'dayplan.removePlaceHint': 'Removes this saved place from the day plan. The place stays saved on the trip.',
  'dayplan.removed': '{name} taken off this day.',

  // empty
  'dayplan.empty.title': 'Nothing to plan on this day yet',
  'dayplan.empty.body': 'Plan ideas for this day with a map spot, or add a saved place below. Bookings with a map position show here at their times.',
  'dayplan.empty.ideas': 'Open Places to go',
  'dayplan.empty.ideasHint': 'Opens your ideas for this trip, where you can plan them for a day.',

  // not routed
  'dayplan.unplaced.heading': 'Not on the route',
  'dayplan.unplaced.body': 'These have no map position yet, so they are not in the walk.',
  'dayplan.unplaced.idea': 'Idea: {name}',
  'dayplan.unplaced.ideaHint': 'Opens this idea so you can set its spot on the map.',
  'dayplan.unplaced.booking': 'Booking: {name}',
  'dayplan.unplaced.bookingHint': 'Opens this booking so you can add a map position.',

  // add saved places
  'dayplan.add.heading': 'Add a saved place',
  'dayplan.add.body': 'Places you saved on the map for this trip.',
  'dayplan.add.a11y': 'Add {name} to this day',
  'dayplan.add.hint': 'Adds this saved place to the walk.',
  'dayplan.added': '{name} added to this day.',
  'dayplan.add.none': 'Save places from the Map tab to add them to a day.',

  // errors
  'dayplan.saveFailed.title': "Couldn't save the plan",
  'dayplan.saveFailed.body': 'The change was not stored. Please try again.',

  'dayplan.offline': 'Works in flight mode. Downloaded city maps show under the route; directions in Apple Maps need a connection.',
} as const;
