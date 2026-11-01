// Strings for photolight (run 105). Every UI string lives in the catalogue.
// T139: photo light, golden and blue hour (prefix light.).
export const photolight = {
  // Trip screen card
  'light.title': 'Photo light',
  'light.subtitle': 'Golden and blue hour at {place}',
  'light.days': 'Trip day for photo light',
  'light.today': 'Today',
  'light.golden': 'Golden hour',
  'light.blue': 'Blue hour',
  'light.part.morning': 'morning',
  'light.part.evening': 'evening',
  'light.part.midday': 'around midday',
  'light.range': '{from}–{to}',
  'light.fromMidnight': 'until {to}',
  'light.toMidnight': 'from {from}',
  'light.windowA11y': '{kind}, {part}, {range}',
  'light.sunrise': 'Sunrise {time}',
  'light.sunset': 'Sunset {time}',
  'light.note.noGolden': 'The sun stays high all day and night here: no golden hour.',
  'light.note.noBlue': 'White night: the sky never gets dark enough for blue hour.',
  'light.note.lowSun': 'The sun stays low all day: soft golden light around midday.',
  'light.note.dark': 'Polar night: no golden or blue hour today.',
  'light.polarDay': 'The sun stays up all day',
  'light.polarNight': 'The sun stays below the horizon all day',

  // Light left and what comes next (shown for today)
  'light.left': 'Light left today: {daylight} of daylight, {good} of golden and blue light',
  'light.leftGood': 'Light left today: {good} of golden and blue light',
  'light.leftNone': 'No more golden or blue light today.',
  'light.now': '{kind} now, until {time} ({left} left)',
  'light.next': 'Next: {kind} at {time} (in {wait})',
  'light.nextDay': 'Next: {kind} {day} at {time}',

  // Sun-arc illustration (spoken)
  'light.arcA11y': 'Sun path for {day}. {where}',
  'light.arc.before': 'Before sunrise.',
  'light.arc.up': 'The sun is up, {pct} percent of the way from sunrise to sunset.',
  'light.arc.after': 'After sunset.',
  'light.arc.day': 'Sunrise {rise}, sunset {set}.',

  'light.footnote': 'Worked out on this phone from the sun’s position, no signal needed. Times are local to {place}. Clouds, hills and tall buildings change what you see.',

  // Your day row
  'light.brief.next': 'Golden hour {from}–{to}',
  'light.brief.now': 'Golden hour now, until {to}',
  'light.brief.place': 'At {place}',
  'light.brief.hint': 'Opens {trip} at today',

  // Saved place / idea line
  'light.spot.title': 'Photo light',
  'light.spot.line': '{day}: golden {golden} · blue {blue}',
  'light.spot.goldenOnly': '{day}: golden {golden}',
  'light.spot.note': '{day}: {note}',
  'light.spot.today': 'Today',
  'light.spot.list': '{a}, {b}',
} as const;
