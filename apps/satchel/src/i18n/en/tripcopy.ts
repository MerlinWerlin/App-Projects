// T118 strings: Plan this trip again (app/trip-again/[tripId].tsx, src/ui/PlanAgainButton.tsx on the trip screen and
// the recap). Keys prefixed "tripcopy.". Every UI string lives in the catalogue.
export const tripcopy = {
  'tripcopy.route': 'Plan again',
  'tripcopy.open': 'Plan this trip again',
  'tripcopy.openHint': 'Copies this trip to new dates. You choose what comes along.',
  'tripcopy.recap.title': 'Go again?',
  'tripcopy.recap.body': 'Copy this trip to new dates with its bookings and lists. Your journal and spending stay here.',
  'tripcopy.notFound': 'This trip is no longer on this phone.',
  'tripcopy.intro': 'Pick a new start date. Every booking moves by the same number of days and keeps its own local time and time zone.',

  // dates and name
  'tripcopy.start': 'New start date',
  'tripcopy.startTyped': 'New start date (YYYY-MM-DD)',
  'tripcopy.startHint': 'Choose the day the new trip starts.',
  'tripcopy.startError': 'Choose a real date.',
  'tripcopy.name': 'Name of the new trip',
  'tripcopy.newDates': 'New dates: {range}',
  'tripcopy.shiftLater': 'Everything moves {n} days later.',
  'tripcopy.shiftLaterOne': 'Everything moves 1 day later.',
  'tripcopy.shiftEarlier': 'Everything moves {n} days earlier.',
  'tripcopy.shiftEarlierOne': 'Everything moves 1 day earlier.',
  'tripcopy.shiftNone': 'Same dates as this trip.',

  // what comes along
  'tripcopy.choose': 'What comes along',
  'tripcopy.part.bookings': 'Bookings ({n})',
  'tripcopy.part.bookingsHint': 'Same local times on the new days. Booking references, seats, gates and tickets are left out.',
  'tripcopy.part.packing': 'Packing list ({n})',
  'tripcopy.part.packingHint': 'Every tick cleared.',
  'tripcopy.part.bags': 'Bags ({n})',
  'tripcopy.part.bagsHint': 'Your bags, colours and weight limits.',
  'tripcopy.part.ideas': 'Ideas and saved places ({n})',
  'tripcopy.part.ideasHint': 'Planned days move with the trip; Been there ticks cleared.',
  'tripcopy.part.todos': 'To-dos ({n})',
  'tripcopy.part.todosHint': 'Due dates move with the trip; every tick cleared.',
  'tripcopy.part.companions': 'Travelling companions ({n})',
  'tripcopy.part.companionsHint': 'Names only. Who paid what stays with this trip.',
  'tripcopy.part.budget': 'Budget',
  'tripcopy.part.budgetHint': 'Home currency and spending limit.',
  'tripcopy.never.title': 'Never copied',
  'tripcopy.never.body': 'Booking references, seats, tickets and other files, stay details (room, codes, Wi-Fi), receipts, journal, spending, exchange rates, cash and gifts stay with this trip.',

  // preview
  'tripcopy.preview.title': 'Bookings on the new dates',
  'tripcopy.preview.when': '{day}, {time} {city} time',
  'tripcopy.preview.was': 'Was {when}',
  'tripcopy.preview.more': 'And {n} more.',
  'tripcopy.preview.none': 'No bookings to move.',
  'tripcopy.preview.off': 'Bookings are not coming along.',
  'tripcopy.clock.skipped': '{title}: {time} doesn’t happen on {day} in {city} (the clocks go forward). Satchel reads it as {used}. Check it against the new booking.',
  'tripcopy.clock.repeated': '{title}: {time} happens twice on {day} in {city} (the clocks go back). Satchel uses the first. Check it against the new booking.',

  // save
  'tripcopy.create': 'Create the new trip',
  'tripcopy.createHint': 'Saves the copy on this phone and opens it. This trip stays as it is.',
  'tripcopy.cancelHint': 'Goes back without making a copy.',
  'tripcopy.saveFailed.title': 'Couldn’t save the new trip',
  'tripcopy.saveFailed.body': 'Your phone couldn’t save it. Nothing was changed. Try again.',
  'tripcopy.packingFailed': 'The new trip is saved, but its packing list couldn’t be. Open Packing on the new trip to start one.',
  'tripcopy.created': 'New trip created: {name}.',
} as const;
