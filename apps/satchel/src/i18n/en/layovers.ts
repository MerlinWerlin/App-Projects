// Strings for layovers (run 103, T131 connections and layovers: the connection card on the trip timeline, the long
// layover ideas, the Your day row, the readiness row, the terminal / gate fields on a journey and the Settings
// limits). Every UI string lives in the catalogue. Keys prefixed "layover.".
export const layovers = {
  // Durations
  'layover.dur.hm': '{h} h {m} min',
  'layover.dur.h': '{h} h',
  'layover.dur.m': '{m} min',

  // Status
  'layover.status.tight': 'Tight',
  'layover.status.ok': 'OK',
  'layover.status.long': 'Long layover',

  // Connection card (trip timeline, between the two legs)
  'layover.card.title': 'Change at {place}',
  'layover.card.titleNoPlace': 'Change',
  'layover.card.times': 'Land {arrive} · leave {depart}',
  'layover.card.a11y': '{title}. {d}, {status}. {times}. {more}',
  'layover.card.tightWhy': 'Under your {min} min limit for a tight change.',
  'layover.card.tightWhyCross': 'Under your {min} min limit for a change between countries: allow time for passport control and security.',
  'layover.card.nearby': 'You land at one place and leave from another: allow time to get across.',
  'layover.card.terminalChange': 'Terminal {from} to {to}',
  'layover.card.terminalSame': 'Same terminal ({terminal})',
  'layover.card.gates': 'Gate {from} to {to}',
  'layover.card.gateTo': 'Next gate {to}',
  'layover.card.gateFrom': 'Arrival gate {from}',
  'layover.card.addTerminals': 'Add terminals or gates',
  'layover.card.addTerminalsHint': 'Opens the arriving journey, where you can type its arrival terminal and gate.',
  'layover.card.limitsNote': 'Your limits are in Settings.',

  // Long layover ideas
  'layover.ideas.show': 'Ideas for a long layover',
  'layover.ideas.showHint': 'Shows a few general ideas for the wait.',
  'layover.ideas.hide': 'Hide the ideas',
  'layover.ideas.hideHint': 'Hides the layover ideas.',
  'layover.ideas.title': 'Ideas for {d}',
  'layover.idea.rest': 'Rest',
  'layover.idea.restBody': 'Find a quiet corner, a lounge or a rest area, and set an alarm for boarding.',
  'layover.idea.eat': 'Eat',
  'layover.idea.eatBody': 'Have a proper meal and refill your water bottle after security.',
  'layover.idea.walk': 'Walk',
  'layover.idea.walkBody': 'Stretch your legs: a slow lap of the terminal helps after a long sit.',
  'layover.idea.leave': 'Leave the airport?',
  'layover.idea.leaveBody': 'Only if the entry rules there allow it for your passport, and with plenty of time to come back through security.',
  'layover.ideas.customs': 'Read the local customs for {country}',
  'layover.ideas.customsHint': 'Opens the local customs guide for {country}.',
  'layover.ideas.general': 'General ideas only. Check the entry rules for your passport before you leave any airport or station.',

  // Your day row
  'layover.brief.line': 'Change at {place}: {d}{terminals}',
  'layover.brief.tight': 'Tight change at {place}: {d}{terminals}',
  'layover.brief.terminalChange': ', terminal {from} to {to}',
  'layover.brief.terminalSame': ', terminal {terminal}',
  'layover.brief.somewhere': 'your stop',
  'layover.brief.hint': 'Opens {trip} at today.',

  // Readiness row
  'layover.readiness.check': 'Connections',
  'layover.readiness.tightOne': 'Tight change at {places}: {d}',
  'layover.readiness.tightMany': '{n} tight changes: {places}',
  'layover.readiness.ok': 'Every change has time to spare',
  'layover.readiness.fix': 'Open the next journey',
  'layover.readiness.fixHint': 'Opens the journey you change onto, to check its times.',

  // Terminal and gate fields on a journey
  'layover.form.title': 'Terminals and gates',
  'layover.form.body': 'Optional. Used for the change between two journeys.',
  'layover.form.depTerminal': 'Departure terminal',
  'layover.form.depGate': 'Departure gate or platform',
  'layover.form.arrTerminal': 'Arrival terminal',
  'layover.form.arrGate': 'Arrival gate or platform',

  // Journey detail
  'layover.detail.arrival': 'Arrives at terminal {terminal}',
  'layover.detail.arrivalGate': 'Arrives at gate {gate}',
  'layover.detail.arrivalBoth': 'Arrives at terminal {terminal}, gate {gate}',
  'layover.detail.departure': 'Leaves from terminal {terminal}',
  'layover.detail.departureGate': 'Leaves from gate {gate}',
  'layover.detail.departureBoth': 'Leaves from terminal {terminal}, gate {gate}',

  // Settings
  'layover.settings.title': 'Connections',
  'layover.settings.tightLabel': 'Tight change',
  'layover.settings.tight': 'Tight under {min} min',
  'layover.settings.crossLabel': 'Tight change between countries',
  'layover.settings.cross': 'Between countries: tight under {min} min',
  'layover.settings.longLabel': 'Long layover',
  'layover.settings.long': 'Long over {d}',
  'layover.settings.body': 'Satchel marks a change between two journeys as tight, OK or long with these limits. They are yours to set; check the minimum connection time with whoever sold the ticket.',
  'layover.settings.reset': 'Use the usual limits',
  'layover.settings.resetHint': 'Sets the limits back to 60 min, 90 min between countries, and 5 h.',
} as const;
