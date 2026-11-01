// Strings for meds (run 95, T101 Medicine times across time zones: app/meds.tsx, its rows on the Emergency tab and
// the trip screen, and the next-dose line on Your day). Every UI string lives in the catalogue. Keys prefixed "meds.".
// Wording stays cautious: it shows times, never tells anyone what to take, and always points to a doctor or pharmacist.
export const meds = {
  'meds.route': 'Medicine times',

  // Entry rows (Emergency tab, trip screen)
  'meds.entry': 'Medicine times',
  'meds.entryBody': 'See your usual medicine times on local clocks. Kept only on this phone.',
  'meds.entryBodyCount': '{n} medicines saved. See their times on local clocks.',
  'meds.entryBodyOne': '1 medicine saved. See its times on local clocks.',
  'meds.entryTripBody': 'Your usual medicine times on this trip’s local clocks.',
  'meds.entryHint': 'Opens Medicine times.',

  // Your day
  'meds.brief.next': 'Next medicine (your plan): {name} at {time}',

  // Screen intro and the guidance line
  'meds.title': 'Medicine times',
  'meds.intro': 'Add the medicines you take and their usual times at home. Satchel shows those times on each stop’s clock.',
  'meds.guidance': 'General guidance only - ask your doctor or pharmacist, especially for time-critical medicines like insulin or contraceptives.',
  'meds.privacy': 'Kept only on this phone. Never put in trip files, never shared unless you tap Share.',

  // List
  'meds.list.title': 'Your medicines',
  'meds.list.empty': 'No medicines yet. Add one to see its times on a trip.',
  'meds.list.add': 'Add a medicine',
  'meds.list.addHint': 'Opens a short form for a name, dose and times.',
  'meds.list.full': 'You have saved the most medicines Satchel keeps (12).',
  'meds.list.fixed': '{times} (home clock)',
  'meds.list.interval': 'Every {h} h from {time} (home clock)',
  'meds.list.edit': 'Edit {name}',
  'meds.list.editHint': 'Opens this medicine’s details.',
  'meds.list.remove': 'Remove {name}',
  'meds.list.removeHint': 'Removes this medicine from this phone.',
  'meds.list.saveFailed': 'Couldn’t save on this phone. Try again.',

  // Form
  'meds.form.newTitle': 'New medicine',
  'meds.form.editTitle': 'Edit medicine',
  'meds.form.name': 'Name',
  'meds.form.namePlaceholder': 'As written on the pack',
  'meds.form.dose': 'Dose (optional)',
  'meds.form.dosePlaceholder': 'For example 1 tablet',
  'meds.form.mode': 'How often',
  'meds.form.modeFixed': 'Fixed clock times',
  'meds.form.modeInterval': 'Every few hours',
  'meds.form.modeHint': 'Chooses how the times are set.',
  'meds.form.times': 'Times at home',
  'meds.form.timeField': 'Add a time (24-hour, like 08:00)',
  'meds.form.removeTime': 'Remove {time}',
  'meds.form.removeTimeHint': 'Takes this time off the list.',
  'meds.form.timeBad': 'Type a time like 08:00 or 20:30.',
  'meds.form.timesFull': 'Up to 8 times a day.',
  'meds.form.every': 'Every',
  'meds.form.everyOption': '{h} h',
  'meds.form.everyHint': 'Sets the hours between doses.',
  'meds.form.firstAt': 'First dose at home (24-hour)',
  'meds.form.minGap': 'Shortest gap you allow when shifting',
  'meds.form.minGapHint': 'Satchel never plans a gap shorter than this. Ask your pharmacist what suits this medicine.',
  'meds.form.minGapOption': 'Shortest gap {gap}',
  'meds.form.err.name': 'Add a name.',
  'meds.form.err.times': 'Add at least one time.',
  'meds.form.err.firstAt': 'Type a time like 08:00.',
  'meds.form.save': 'Save medicine',
  'meds.form.saveHint': 'Keeps it on this phone only.',
  'meds.form.cancel': 'Cancel',
  'meds.form.cancelHint': 'Closes the form without saving.',

  // Trip and plan
  'meds.trip.title': 'On a trip',
  'meds.trip.pick': 'Choose a trip',
  'meds.trip.pickHint': 'Shows medicine times for this trip.',
  'meds.trip.none': 'No upcoming trips. Medicine times appear here once a trip has bookings with time zones.',
  'meds.trip.noStops': 'This trip stays on your home clock, or its bookings have no other time zone yet.',
  'meds.trip.home': 'Home clock: {city}',
  'meds.plan.title': 'Plan',
  'meds.plan.pick': 'Choose a plan for this trip',
  'meds.plan.home': 'Keep home time',
  'meds.plan.homeBody': 'Same moment as at home. The local clock time is shown, so doses may land at odd hours.',
  'meds.plan.local': 'Shift to local time',
  'meds.plan.localBody': 'Same clock time where you are. Every-few-hours medicines move gradually over the first days.',
  'meds.plan.hint': 'Changes how times are shown for this trip.',
  'meds.plan.step': 'Largest change per day',
  'meds.plan.stepOption': '{h} h a day',
  'meds.plan.stepHint': 'Sets how fast every-few-hours medicines move to local time.',

  // Stops
  'meds.stop.dates': '{from} to {to}',
  'meds.stop.ahead': '{d} ahead of home',
  'meds.stop.behind': '{d} behind home',
  'meds.stop.same': 'Same clock as home',
  'meds.stop.nightCount': '{n} doses fall in your usual sleep hours ({bed} to {wake}).',
  'meds.stop.nightOne': '1 dose falls in your usual sleep hours ({bed} to {wake}).',
  'meds.row.home': '{home} at home is {local} here',
  'meds.row.local': '{local} here',
  'meds.row.night': 'During usual sleep hours',
  'meds.row.later': 'From {date}: {local} here (a clock change)',
  'meds.day.next': '(next day)',
  'meds.day.later': '({n} days later)',
  'meds.day.prev': '(day before)',
  'meds.day.earlier': '({n} days before)',
  'meds.jump.shorter': 'Switching straight to local time makes the gap after you arrive about {d} shorter.',
  'meds.jump.longer': 'Switching straight to local time makes the gap after you arrive about {d} longer.',

  // Gradual shift
  'meds.shift.none': 'Already on the same clock times here.',
  'meds.shift.earlier': 'Moves {d} earlier, by at most {step} a day. Shortest gap {gap}.',
  'meds.shift.later': 'Moves {d} later, by at most {step} a day.',
  'meds.shift.reached': 'On local clock times from {date}.',
  'meds.shift.notReached': 'Still moving when you leave this stop.',
  'meds.shift.day': '{date}: {times}',
  'meds.shift.gap': '{time} (gap {gap})',
  'meds.shift.more': 'Then every {h} h on local time.',

  // Durations
  'meds.hours': '{h} h',
  'meds.hoursMin': '{h} h {m} min',
  'meds.mins': '{m} min',

  // Share
  'meds.share': 'Share these times',
  'meds.shareHint': 'Opens the share sheet. Nothing is sent until you choose where.',
  'meds.shareFailed': 'Couldn’t open the share sheet.',
  'meds.share.title': 'Medicine times',
  'meds.share.home': 'At home ({city}):',
  'meds.share.stop': '{city}, {dates}:',
  'meds.share.line': '{name} {dose}: {times}',
} as const;
