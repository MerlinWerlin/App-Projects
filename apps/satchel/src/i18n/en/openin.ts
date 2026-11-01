// Strings for openin (run 108). Every UI string lives in the catalogue.
// T14: Open in / Copy to Satchel (prefix openin.).
export const openin = {
  'openin.route': 'Save to Satchel',
  'openin.add.route': 'Add to a trip',
  'openin.notFound.route': 'Not found',

  // Working (copying the file in, reading it)
  'openin.working.title': 'Opening your file',
  'openin.working.body': 'Satchel is copying it onto this phone. It stays here and is never uploaded.',

  // Honest dead ends
  'openin.unsupported.title': 'Satchel can’t read this kind of file',
  'openin.unsupported.body': 'Satchel can save booking PDFs, images (such as a ticket screenshot), text and email files, and .satchel trip files. Nothing was saved.',
  'openin.unsupported.named': 'The file was “{name}”.',
  'openin.tooLarge.title': 'This file is too big',
  'openin.tooLarge.body': 'Satchel takes files up to {mb} MB. Nothing was saved.',
  'openin.failed.title': 'Satchel couldn’t open this file',
  'openin.failed.body': 'The file couldn’t be copied onto this phone. Check your storage, then share it to Satchel again.',
  'openin.empty.title': 'There’s no text in this file',
  'openin.empty.body': 'Satchel couldn’t find any words to read in it. Nothing was saved.',
  'openin.notFound.title': 'Satchel couldn’t open that link',
  'openin.notFound.body': 'It doesn’t lead to anything in Satchel. Your trips are all still here.',
  'openin.back': 'Back to Trips',
  'openin.backHint': 'Goes to your trips. Nothing was saved.',

  // Add to a trip (PDF / image)
  'openin.add.eyebrow': 'Save to Satchel',
  'openin.add.title': 'Add to a trip',
  'openin.add.subtitle': 'Pick the trip and the kind of booking. Next you fill in the booking, with this file attached.',
  'openin.add.file': 'File',
  'openin.add.fileKind.pdf': 'PDF',
  'openin.add.fileKind.image': 'Image',
  'openin.add.trip': 'Trip',
  'openin.add.tripHint': 'Adds the file to this trip',
  'openin.add.tripDates': '{from} – {to}',
  'openin.add.kind': 'Kind of booking',
  'openin.add.continue': 'Continue',
  'openin.add.continueHint': 'Opens a new booking in the chosen trip with this file attached',
  'openin.add.chooseTrip': 'Choose a trip first',
  'openin.add.cancel': 'Don’t save',
  'openin.add.cancelHint': 'Leaves without saving the file',
  'openin.add.noTrips.title': 'Make a trip first',
  'openin.add.noTrips.body': 'Files are saved on a booking inside a trip. Make the trip, then come back here.',
  'openin.add.newTrip': 'New trip',
  'openin.add.newTripHint': 'Opens the new trip form; you come back here after',
  'openin.add.saveFailed': 'Satchel couldn’t keep a copy of the file. Check your storage, then try again.',
  'openin.add.gone': 'The file is no longer on this phone. Share it to Satchel again.',

  // Hand-offs
  'openin.form.banner': 'The file you shared is attached below. Fill in the booking, then Save.',
  'openin.paste.banner': 'Satchel read the text from the file you shared. Check what it found below.',
  'openin.trip.importing': 'Adding the trip',

  // Settings: how to use it
  'openin.settings.title': 'Save to Satchel',
  'openin.settings.body': 'On a booking PDF, ticket image or email, tap Share, then Satchel (or “Copy to Satchel”). Satchel reads it on this phone.',
} as const;
