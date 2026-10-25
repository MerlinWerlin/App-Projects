// T26 strings (owned by T26). Keys prefixed by feature so they never clash.
// Spec pass on trips, timeline and forms: wording follows docs/spec/STATES_COPY.md and FLOWS §1-4 where it fits.
export const spec = {
  // FLOWS §1.1 first-launch welcome (a card on the Trips home, shown once)
  'spec.welcome.title': 'A travel wallet that works in flight mode',
  'spec.welcome.body': 'Your trips, tickets and saved files stay on this phone, so they open with no signal.',
  'spec.welcome.demo': 'Try the demo trip',
  'spec.welcome.demoHint': 'Opens a sample trip from Sydney to Tokyo and Kyoto',
  'spec.welcome.own': 'Start with my own trip',
  'spec.welcome.ownHint': 'Opens the new trip form',
  'spec.welcome.privacy': 'No account needed. Your location is only checked when you ask.',

  // FLOWS §1.2 demo trip introduction (top of the demo timeline, shown once)
  'spec.demoIntro.body': 'This trip is sample information: Sydney → Tokyo → Kyoto. Look around, edit it or delete it like any trip.',
  'spec.demoIntro.replace': 'The bookings, references and addresses are made up. Don’t rely on them for real travel.',
  'spec.demoIntro.open': 'Got it',
  'spec.demoIntro.openHint': 'Hides this note and shows the trip timeline',
  'spec.demoIntro.remove': 'Remove demo trip',
  'spec.demoIntro.removeHint': 'Deletes the sample trip from this phone',
  'spec.demoIntro.removeConfirm': 'Remove the demo trip?',
  'spec.demoIntro.removeBody': 'You can add it again from the trips list.',

  // FLOWS §3.1 timeline
  'spec.timeline.emptyTitle': 'Your trip is ready',
  'spec.timeline.emptyBody': 'Add a flight, stay or other plan to build your timeline.',
  'spec.timeline.addItem': 'Add item',
  'spec.timeline.addItemHint': 'Adds an item to this trip',
  'spec.timeline.cancelAddHint': 'Closes the list of booking kinds without adding anything',
  'spec.timeline.map': 'Trip map',
  'spec.timeline.mapHint': 'Shows saved places and bookings on the map',
  'spec.timeline.editHint': 'Changes the trip name, dates and home time zone',

  // Timeline rows for a journey that started on an earlier day
  'spec.row.arrives': 'Arrives {time} {city} time',
  'spec.row.returns': 'Return {time} {city} time',
  'spec.row.ends': 'Ends {time} {city} time',
  'spec.row.underway': 'Under way · ends {day}, {time} {city} time',
  'spec.row.hint': 'Opens item details',

  // Item details
  'spec.item.airline': 'Airline',
  'spec.item.company': 'Hire company',
  'spec.item.flightNumber': 'Flight number',
  'spec.item.trainNumber': 'Train number',
  'spec.item.pickUp': 'Pick-up',
  'spec.item.dropOff': 'Return',
  'spec.item.editHint': 'Edits this item',
  'spec.item.deleteHint': 'Deletes this item after you confirm',

  // FLOWS §4 shared item-form behaviour: the title names the kind
  'spec.itemEdit.new.flight': 'New flight',
  'spec.itemEdit.new.train': 'New train',
  'spec.itemEdit.new.ferry': 'New ferry',
  'spec.itemEdit.new.bus': 'New bus',
  'spec.itemEdit.new.hotel': 'New stay',
  'spec.itemEdit.new.car': 'New car hire',
  'spec.itemEdit.new.activity': 'New activity',
  'spec.itemEdit.new.note': 'New note',
  'spec.itemEdit.edit.flight': 'Edit flight',
  'spec.itemEdit.edit.train': 'Edit train',
  'spec.itemEdit.edit.ferry': 'Edit ferry',
  'spec.itemEdit.edit.bus': 'Edit bus',
  'spec.itemEdit.edit.hotel': 'Edit stay',
  'spec.itemEdit.edit.car': 'Edit car hire',
  'spec.itemEdit.edit.activity': 'Edit activity',
  'spec.itemEdit.edit.note': 'Edit note',
  'spec.itemEdit.titleHotel': 'Hotel or place to stay',
  'spec.itemEdit.titleActivity': 'Activity name',
  'spec.itemEdit.titleNote': 'Note title',
  'spec.itemEdit.saveHint': 'Saves this item to the trip',
  'spec.itemEdit.cancelHint': 'Returns to the trip. Asks first if you have unsaved changes',
  'spec.itemEdit.dstSkipped': '{time} doesn’t exist in {city} on this date: the clocks go forward. Satchel will use {used}. Check the time on your booking.',
  'spec.itemEdit.dstRepeated': '{time} happens twice in {city} on this date: the clocks go back. Satchel uses the first {time}. Check the time on your booking.',

  // FLOWS §2.2 trip form
  'spec.tripEdit.tzHint': 'Where you’re travelling from. Each booking keeps its own time zone.',
  'spec.tripEdit.saveHint': 'Saves trip details',
  'spec.tripEdit.cancelHint': 'Returns without saving. Asks first if you have unsaved changes',
  'spec.tripEdit.deleteHint': 'Deletes this trip and its bookings after you confirm',

  // FLOWS §13 leaving a form with unsaved changes; validation announcement
  'spec.form.discardTitle': 'Discard your changes?',
  'spec.form.discardBody': 'What you typed on this form hasn’t been saved.',
  'spec.form.keepEditing': 'Keep editing',
  'spec.form.discard': 'Discard',
  'spec.form.checkFields': 'Not saved yet. Check the messages under the fields.',
} as const;
