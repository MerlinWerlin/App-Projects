// Strings for arrival (run 93). Every UI string lives in the catalogue.
// T95 Arrival card: "Welcome to <country>" on the trip screen and the Trips tab, plus the "Countries on this trip" strip.
export const arrival = {
  'arrival.eyebrowHere': 'You’ve arrived · {trip}',
  'arrival.eyebrowToday': 'Arriving today · {trip}',
  'arrival.title': 'Welcome to {country}',
  'arrival.subtitle': 'What Satchel knows offline, ready before you need it.',
  'arrival.a11y': 'Welcome to {country}. {when}, trip {trip}.',
  'arrival.whenHere': 'You’ve arrived',
  'arrival.whenToday': 'Arriving today',

  // Time
  'arrival.timeLabel': 'Local time',
  'arrival.timeAhead': '{d} from home ({home})',
  'arrival.timeSame': 'Same time as home ({home})',
  'arrival.timeA11y': 'Local time {time}. Home {homeTime}. {diff}',

  // Money
  'arrival.moneyLabel': 'Your saved rate',
  'arrival.moneyRate': '1 {local} = {rate} {home}',
  'arrival.moneyRateDay': 'Rate you saved on {day}. Not live: update it in the converter.',
  'arrival.moneyRateNoDay': 'Rate you saved. Not live: update it in the converter.',
  'arrival.moneyRow': '{local} is about {home}',
  'arrival.moneyNoHome': 'Set a home currency in Spending to see what local prices are worth.',
  'arrival.moneyNoRate': 'Add a rate in the converter to see what local prices are worth.',
  'arrival.openConverter': 'Open converter',
  'arrival.openConverterHint': 'Opens the currency converter for this trip',

  // Power and roads
  'arrival.powerLabel': 'Plugs, power and roads',
  'arrival.plugs': 'Plugs: type {list}',
  'arrival.voltage': 'Power: {value}',
  'arrival.drivingLeft': 'Drive on the left',
  'arrival.drivingRight': 'Drive on the right',
  'arrival.notSure': 'Not sure, check locally',
  'arrival.plugsUnknown': 'Plugs: not sure, check locally',
  'arrival.voltageUnknown': 'Power: not sure, check locally',
  'arrival.drivingUnknown': 'Driving side: not sure, check locally',
  'arrival.verifyChecked': 'Verify locally. From a bundled table, checked {date}.',
  'arrival.verify': 'Verify locally. From a bundled table.',
  'arrival.noPower': 'Satchel has no plug or driving details for {country} yet. Check locally.',

  // Emergency
  'arrival.emergencyLabel': 'Emergency numbers',
  'arrival.serviceGeneral': 'Emergency',
  'arrival.servicePolice': 'Police',
  'arrival.serviceAmbulance': 'Ambulance',
  'arrival.serviceFire': 'Fire',
  'arrival.serviceTourist': 'Tourist police',
  'arrival.callA11y': 'Call {number}, {services}',
  'arrival.callHint': 'Opens the phone app to call this number',
  'arrival.doubted': 'Number doubted, check locally',
  'arrival.fallback': 'No confirmed number in Satchel’s table. From a mobile, {number} often works. Verify locally.',
  'arrival.noEmergency': 'Satchel has no numbers for {country} yet. Ask locally or at your hotel.',
  'arrival.openEmergency': 'Emergency card',
  'arrival.openEmergencyHint': 'Opens the Emergency tab with your card and local numbers',

  // Phrases
  'arrival.phrasesLabel': 'Two phrases to start',
  'arrival.phraseA11y': '{english}: {text}',
  'arrival.phraseHint': 'Opens this phrase big, to show someone',

  // Shortcuts
  'arrival.shortcutsLabel': 'Shortcuts',
  'arrival.toilet': 'Nearest toilet',
  'arrival.toiletHint': 'Opens the toilet finder and looks near you once',
  'arrival.wayback': 'Way back to hotel',
  'arrival.waybackHint': 'Opens the compass pointing to your hotel here',

  // Dismiss
  'arrival.dismiss': 'Hide for {country}',
  'arrival.dismissHint': 'Hides this card for {country} on this trip. Remembered on this phone only.',

  // Countries strip
  'arrival.stripTitle': 'Countries on this trip',
  'arrival.stripA11y': '{country}, {state}',
  'arrival.stateBeen': 'visited',
  'arrival.stateNow': 'here now',
  'arrival.stateAhead': 'coming up',
} as const;
