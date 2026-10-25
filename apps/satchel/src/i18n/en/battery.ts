// T07 strings (owned by T07). Keys prefixed 'battery.' so they never clash with other features.
// 'essentials.title' and 'essentials.body' live in ../en.ts and are reused, not redefined.
// Never quote battery savings (hours, percentages saved) here: the owner hasn't measured them.
export const battery = {
  // Home banner
  'battery.lowTitle': 'Battery at {percent}%',
  'battery.lowBody': 'Switch to essentials: your next ticket, hotel address and emergency card on a plain black screen.',
  'battery.open': 'Open essentials',
  'battery.openHint': 'Shows your next ticket, hotel address and emergency card',
  'battery.notNow': 'Not now',
  'battery.notNowHint': 'Hides this until your battery is low again',
  'battery.manualTitle': 'Essentials mode is on',
  'battery.manualBody': 'It stays on until you turn it off.',
  'battery.turnOff': 'Turn off essentials mode',
  'battery.turnOffHint': 'Goes back to the normal app',

  // Essentials screen
  'battery.note': 'No animation and no map in this mode.',
  'battery.keepOn': 'Keep essentials mode on',
  'battery.keepOnHint': 'Keeps essentials one tap away from the Trips screen, whatever your battery level',
  'battery.levelUnknown': 'Satchel can\'t read the battery level on this phone, so it won\'t offer essentials by itself. You can still open it any time.',
  'battery.exit': 'Exit essentials',
  'battery.exitHint': 'Goes back to where you were',

  'battery.ticketHeading': 'Next ticket',
  'battery.ticketNow': 'Now · until {time} ({city} time)',
  'battery.ticketNext': '{day} · {time} ({city} time)',
  'battery.ticketOpen': 'Open ticket: {title}',
  'battery.ticketOpenShort': 'Open ticket',
  'battery.ticketOpenHint': 'Shows the ticket full screen at full brightness',
  'battery.ticketNoFile': 'No ticket file saved for this booking. The ticket screen still shows its details.',
  'battery.ticketNone': 'No upcoming tickets.',
  'battery.ticketNoneBody': 'Add a booking and attach its ticket so it shows here.',

  'battery.hotelHeading': 'Hotel address',
  'battery.hotelOpen': 'Open address card for {name}',
  'battery.hotelOpenHint': 'Shows the address big, to show your driver',
  'battery.hotelNoAddress': 'No address saved for {name}.',
  'battery.hotelNone': 'No hotel saved.',
  'battery.hotelNoneBody': 'Add a hotel booking with its address so it shows here.',

  'battery.emergencyHeading': 'Emergency',
  'battery.emergencyNoCountry': 'Pick your country on the Emergency tab to see local numbers here.',
  'battery.emergencyOpen': 'Open the Emergency tab',
  'battery.emergencyOpenHint': 'Shows all emergency numbers and lets you change the country',

  'battery.addBooking': 'Add a booking',
  'battery.addHotel': 'Add a hotel',
  'battery.editBooking': 'Edit booking',
  'battery.setupHint': 'Opens the booking form',
  'battery.editCard': 'Fill in emergency card',
  'battery.editCardHint': 'Opens the emergency card form',
} as const;
