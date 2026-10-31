// Strings for followups95 (run 96, T104 run-95 follow-ups (Medicine times picker and shared text, cash marker, Plan my day stop lengths)). Every UI string lives in the catalogue.
export const followups95 = {
  // Medicine times: the system time picker instead of typing HH:MM.
  'f95.time.new': 'Time to add',
  'f95.time.newHint': 'Opens the time picker. Then tap Add to put it on the list.',
  'f95.time.add': 'Add {time}',
  'f95.time.addHint': 'Adds this time to the list of times at home.',
  'f95.time.already': '{time} is already on the list.',
  'f95.time.first': 'First dose at home',
  'f95.time.firstHint': 'Opens the time picker for the first dose of the day, on your home clock.',
  // Medicine times: a clock change (daylight saving) during a stay.
  'f95.shift.clock': 'Clocks change here on {date}: the times follow the new local clock, moved the same gradual way.',
  // Medicine times: the shared text lists each day of the gradual shift.
  'f95.share.day': '  {date}: {times}',
  'f95.share.clock': '  Clocks change on {date}; the times above follow the new local clock.',
  'f95.share.then': '  Then each day: {times}',
  'f95.share.notReached': '  Not on local time yet when this stop ends.',
  'f95.share.later': '{first} (from {date}: {local}, a clock change)',
  // Medicine times row on the Emergency tab: the next dose.
  'f95.next.today': 'Next: {name} at {time}',
  'f95.next.tomorrow': 'Next: {name} tomorrow at {time}',
  'f95.next.later': 'Next: {name} on {date} at {time}',
  // Spending: the cash marker on rows paid in cash.
  'f95.cash.marker': 'Cash',
  'f95.cash.a11y': 'paid in cash',
  // Plan my day: how long at each stop.
  'f95.stay.label': 'Stay about {len}',
  'f95.stay.a11y': 'Stay at {name}: about {len}',
  'f95.stay.lessA11y': 'Shorter stay at {name}',
  'f95.stay.moreA11y': 'Longer stay at {name}',
  'f95.stay.hint': 'Now about {len}. Changes by 15 minutes and is used to check whether the day fits.',
  'f95.stay.announce': 'Stay at {name}: about {len}',
  'f95.stay.min': '{m} min',
  'f95.stay.hours': '{h} h',
  'f95.stay.hoursMin': '{h} h {m} min',
  'f95.fit.stopsTotal': '{n} stops, about {len} in all',
} as const;
