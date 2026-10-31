// Strings for holidays (run 96, T106 "Public holidays on your trip": app/holidays/[tripId].tsx, trip card, timeline badge, arrival + Your day lines). Every UI string lives in the catalogue.
// Holiday names themselves are English proper names in src/core/holidays.ts (like country names in src/content).
export const holidays = {
  'holidays.route': 'Holidays',
  'holidays.title': 'Holidays on this trip',
  'holidays.notFound': 'This trip isn’t on your phone any more.',

  // Trip screen card
  'holidays.card.title': 'Holidays on this trip',
  'holidays.card.none': 'No public holidays at your stops on these dates.',
  'holidays.card.count': '{n} public holidays at your stops',
  'holidays.card.countOne': '1 public holiday at your stops',
  'holidays.card.more': '+{n} more',
  'holidays.card.open': 'See all',
  'holidays.card.openHint': 'Opens the holidays on this trip, with what each country’s list leaves out.',
  'holidays.card.noStops': 'Add bookings with time zones to see the public holidays where you’re going.',

  // A holiday row
  'holidays.row': '{day} · {name}',
  'holidays.rowA11y': '{day}, {name}, public holiday in {country}',
  'holidays.substitute': 'Day off in place of a weekend holiday',
  'holidays.partial': 'Not kept everywhere in the country',
  'holidays.closures': 'Shops and banks may close, and transport may run a Sunday timetable.',
  'holidays.guidance': 'General guidance, verify locally. Dates are worked out on your phone by rule and can change by decree.',

  // Screen
  'holidays.intro': 'Public holidays in the countries you visit, on the days you’re there. Dates are each stop’s own local dates.',
  'holidays.empty': 'No public holidays at your stops on these dates.',
  'holidays.noStops': 'Add bookings with time zones and Satchel will show the public holidays where you’re going.',
  'holidays.countryDates': 'You’re there {from} to {to}',
  'holidays.notShown': 'Not shown',
  'holidays.uncovered': 'No holiday list for {countries} yet. Check locally.',
  'holidays.outsideYears': 'Holidays are worked out for {from} to {to} only; days outside those years aren’t shown.',
  'holidays.checked': 'Rules written {date}.',

  // Timeline day header badge
  'holidays.badge': 'Holiday',
  'holidays.badgeA11y': 'Public holiday: {names}',

  // Arrival card and Your day
  'holidays.today': 'Today is {name}, a public holiday here.',
  'holidays.todayMany': 'Today is a public holiday here: {names}.',
  'holidays.todayHint': 'Shops and banks may close, transport may run a Sunday timetable.',

  // What each country's list leaves out (src/core/holidays.ts NOTE_CODES)
  'holidays.note.regional': 'Regional days (state, province, canton or city holidays) aren’t shown.',
  'holidays.note.lunar': 'Lunar-calendar holidays aren’t shown.',
  'holidays.note.islamic': 'Islamic-calendar holidays aren’t shown.',
  'holidays.note.hindu': 'Hindu-calendar holidays aren’t shown.',
  'holidays.note.buddhist': 'Buddhist lunar-calendar holidays aren’t shown.',
  'holidays.note.decree': 'Days moved or added each year by decree (bridge days, extra days off) aren’t shown.',
  'holidays.note.oneoff': 'One-off days, such as royal events or election days, aren’t shown.',
  'holidays.note.eves': 'Eves such as Midsummer Eve or Christmas Eve aren’t shown unless they are public holidays, but many places close early or all day.',
  'holidays.note.optional': 'Optional days off, such as Carnival, aren’t shown, though many places close.',
  'holidays.note.gbNations': 'UK-wide days only. England and Wales also have Easter Monday and the last Monday in August; Scotland has 2 January, the first Monday in August and St Andrew’s Day; Northern Ireland has St Patrick’s Day and 12 July.',
  'holidays.note.jpNewYear': 'Many offices and some shops also close from 29 December to 3 January.',
  'holidays.note.jpEquinox': 'Equinox days are worked out by formula; Japan confirms them each February.',
  'holidays.note.krSubstitute': 'Lunar New Year, Chuseok and Buddha’s Birthday aren’t shown, so a substitute day next to them may differ.',
  'holidays.note.mxHolyWeek': 'Holy Thursday and Good Friday aren’t official days off, but many places close.',
  'holidays.note.grMayDay': 'May Day is left out when it falls near Easter, as its date is then set by decree.',
  'holidays.note.nzMatariki': 'Matariki is shown for the years set in law; regional anniversary days aren’t shown.',
} as const;
