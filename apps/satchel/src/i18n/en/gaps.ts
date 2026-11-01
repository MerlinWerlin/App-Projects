// Strings for gaps (run 104). Every UI string lives in the catalogue.
// T135: trip gaps (nights with no stay, missing journeys, clashes): the Trip gaps card on the trip screen, the
// readiness row and the Your day row. Keys prefixed "gaps.".
export const gaps = {
  // Card header
  'gaps.card.eyebrow': 'Trip gaps',
  'gaps.card.countOne': '1 gap to look at',
  'gaps.card.countMany': '{n} gaps to look at',
  'gaps.card.none': 'No gaps found',
  'gaps.card.noneBody': 'Every night has a stay and every move has a journey.',
  'gaps.card.sub': 'Holes and clashes Satchel found in your bookings.',
  'gaps.card.countA11y': '{n} gaps',
  'gaps.card.showAll': 'Show all {n}',
  'gaps.card.showAllHint': 'Shows every gap in this trip.',
  'gaps.card.showFewer': 'Show fewer',
  'gaps.card.showFewerHint': 'Shows only the first few gaps.',
  'gaps.card.restoreOne': 'Show 1 dismissed gap',
  'gaps.card.restoreMany': 'Show {n} dismissed gaps',
  'gaps.card.restoreHint': 'Brings back the gaps you dismissed on this trip.',
  'gaps.card.privacy': 'Worked out on this phone from your bookings. Dismissed gaps are kept on this phone only.',

  // One line per kind: the short title
  'gaps.title.night': 'No stay booked',
  'gaps.title.move': 'No journey between places',
  'gaps.title.stayClash': 'Stays overlap',
  'gaps.title.legClash': 'Journeys overlap',
  'gaps.title.checkInLate': 'Check-in after you leave',
  'gaps.title.lateArrival': 'Arrives after check-out',
  'gaps.title.noWayHome': 'No journey home',

  // ...and the one-line reason
  'gaps.reason.night': '{range}: {n} nights with nothing booked.',
  'gaps.reason.nightOne': 'The night of {date} has nothing booked.',
  'gaps.reason.move': 'From {from} to {to} with no journey booked between them.',
  'gaps.reason.moveNoNames': 'You change place on {date} with no journey booked.',
  'gaps.reason.stayClash': '{a} and {b} overlap by {n} nights.',
  'gaps.reason.stayClashOne': '{a} and {b} overlap on the night of {date}.',
  'gaps.reason.stayClashTime': '{a} and {b} overlap by {d}.',
  'gaps.reason.legClash': '{a} and {b} overlap by {d}.',
  'gaps.reason.checkInLate': '{stay} checks in {d} after {leg} leaves.',
  'gaps.reason.lateArrival': '{leg} lands on {date}, after {stay} ends on {out}.',
  'gaps.reason.noWayHome': 'Nothing booked to get home after {date}.',
  'gaps.range': '{from} to {to}',

  // Buttons on a gap
  'gaps.add.stay': 'Add a stay',
  'gaps.add.stayHint': 'Opens a new stay with these dates filled in.',
  'gaps.add.journey': 'Add a journey',
  'gaps.add.journeyHint': 'Opens a new journey on this date. Pick flight, train, ferry or bus.',
  'gaps.open': 'Open booking',
  'gaps.openA11y': 'Open {title}',
  'gaps.openHint': 'Opens the booking so you can fix its dates or times.',
  'gaps.dismiss': 'Dismiss',
  'gaps.dismissA11y': 'Dismiss: {title}',
  'gaps.dismissHint': 'Hides this gap on this phone. Show dismissed brings it back.',
  'gaps.rowA11y': '{title}. {reason}',

  // Readiness row
  'gaps.readiness.check': 'Trip gaps',
  'gaps.readiness.foundOne': '1 gap in the plan, such as a night with no stay or a missing journey.',
  'gaps.readiness.foundMany': '{n} gaps in the plan, such as nights with no stay or missing journeys.',
  'gaps.readiness.ok': 'Every night has a stay and every move a journey.',
  'gaps.readiness.fix': 'Fix the first one',
  'gaps.readiness.fixHint': 'Opens the booking form for the first gap, or the booking to fix.',

  // Your day
  'gaps.brief.tonight': 'No stay booked for tonight',
  'gaps.brief.tonightHint': 'Opens a new stay for tonight in {trip}.',
} as const;
