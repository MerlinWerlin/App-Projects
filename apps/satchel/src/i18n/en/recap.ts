// T86 strings: Trip recap (app/recap/[tripId].tsx), its card on the trip screen (src/ui/slots/TripRecapSlot.tsx) and
// the recap list on Your travels (src/ui/RecapList.tsx). Keys prefixed "recap.".
export const recap = {
  'recap.route': 'Trip recap',
  'recap.notFound': 'This trip is no longer on this phone.',
  'recap.eyebrow': 'Trip recap',
  'recap.eyebrowSoFar': 'Recap so far',
  'recap.demoBadge': 'Sample trip',
  'recap.upcoming.title': 'Your recap opens when the trip starts',
  'recap.upcoming.body': 'Once you are on your way, Satchel gathers your days, places, spending and journal here.',
  'recap.offline': 'Worked out on this phone from this trip. Nothing leaves it unless you share it.',

  // stat tiles
  'recap.stat.days': 'Days',
  'recap.stat.daysSoFar': 'Days so far',
  'recap.stat.cities': 'Cities',
  'recap.stat.countries': 'Countries',
  'recap.stat.km': 'Km travelled',
  'recap.stat.pages': 'Journal pages',
  'recap.stat.photos': 'Photos',
  'recap.soFar': 'Day {n} of {days}',

  // places
  'recap.places.title': 'Where you went',
  'recap.places.subtitle': 'From your bookings: hotel towns, else the time zone city. Home country left out.',
  'recap.places.none': 'No places outside your home country yet. Add bookings and they show up here.',

  // distance
  'recap.distance.title': 'Distance',
  'recap.distance.body': '{km} km travelled over {legs} legs, as the crow flies.',
  'recap.distance.bodyOne': '{km} km travelled over 1 leg, as the crow flies.',
  'recap.distance.flown': '{km} km of it flown.',
  'recap.distance.unmeasured': '{n} legs have no map position, so they are counted but not measured.',
  'recap.distance.unmeasuredOne': '1 leg has no map position, so it is counted but not measured.',
  'recap.distance.none': 'No journeys yet.',
  'recap.distance.noneMeasured': 'Your journeys have no map positions, so Satchel can’t measure them. Set a position on a booking to include it.',

  // spending
  'recap.spending.title': 'Spending',
  'recap.spending.subtitle': 'Every expense in full, converted with your own rates.',
  'recap.spending.total': 'Total {amount}',
  'recap.spending.partial': 'Some of it isn’t converted',
  'recap.spending.catA11y': '{category}: {amount}, {pct} percent',
  'recap.spending.catNoRate': '{category}: not converted',
  'recap.spending.noRate': 'No rate',
  'recap.spending.unratedTitle': 'Not converted (no rate)',
  'recap.spending.unratedBody': 'Add a rate in Spending to include these. Satchel never guesses a rate.',
  'recap.spending.noHome': 'No home currency set, so each currency is shown on its own.',
  'recap.spending.none': 'No spending added on this trip.',
  'recap.spending.open': 'Open Spending',
  'recap.spending.openHint': 'Opens this trip’s spending.',

  // journal
  'recap.moods.title': 'How it felt',
  'recap.moods.subtitle': 'Moods from your journal pages.',
  'recap.moods.a11y': '{mood}: {n} pages',
  'recap.moods.a11yOne': '{mood}: 1 page',
  'recap.moods.none': 'No moods picked yet. Add one to a journal page and it shows up here.',
  'recap.photos.title': 'Photos',
  'recap.photos.a11y': 'Journal photo {n} of {total}, {day}',
  'recap.photos.more': 'Showing the first {n} photos.',
  'recap.journal.open': 'Open journal',
  'recap.journal.openHint': 'Opens this trip’s journal.',

  // best day
  'recap.best.title': 'Best day',
  'recap.best.day': 'Day {n} · {date}',
  'recap.best.mood': 'Mood: {mood}',
  'recap.best.rule': 'Picked from your journal moods: joyful and adventurous pages count most, then grateful and relaxed.',
  'recap.best.a11y': 'Best day: {day}. {mood}. {rule}',
  'recap.best.hint': 'Opens the journal.',
  'recap.best.none': 'Pick a mood on your journal pages and Satchel will choose your best day.',

  // ideas
  'recap.ideas.title': 'Places to go',
  'recap.ideas.subtitle': '{done} of {total} been there',
  'recap.ideas.none': 'None ticked “Been there” yet.',
  'recap.ideas.open': 'Open Places to go',
  'recap.ideas.openHint': 'Opens this trip’s places to go.',

  // share
  'recap.share.title': 'Share recap',
  'recap.share.body': 'Plain text: days, places, distance, moods, best day and places you went. Never booking codes, documents, notes or medical details.',
  'recap.share.spending': 'Include spending',
  'recap.share.spendingHint': 'Adds your totals by category to the text.',
  'recap.share.preview': 'Preview',
  'recap.share.send': 'Share recap',
  'recap.share.sendHint': 'Opens the share sheet with this text.',
  'recap.share.failed': 'The share sheet didn’t open. Try again.',
  'recap.share.subject': 'Trip recap: {name}',

  // share text
  'recap.text.heading': 'Trip recap: {name}',
  'recap.text.dates': '{range} · {n} days',
  'recap.text.soFar': 'Day {n} of {days} so far',
  'recap.text.cities': 'Cities: {list}',
  'recap.text.countries': 'Countries: {list}',
  'recap.text.distance': '{km} km travelled ({flown} km flown)',
  'recap.text.spent': 'Spent: {amount}',
  'recap.text.category': '{category}: {amount}',
  'recap.text.unrated': 'Not converted (no rate): {list}',
  'recap.text.moods': 'Moods: {list}',
  'recap.text.best': 'Best day: {day} ({mood})',
  'recap.text.dayLabel': 'Day {n}',
  'recap.text.been': 'Been there: {list}',
  'recap.text.footer': 'Made with Satchel',

  // trip screen card
  'recap.slot.title': 'Trip recap',
  'recap.slot.body': '{days} days · {cities} · {km} km',
  'recap.slot.cities': '{n} cities',
  'recap.slot.citiesOne': '1 city',
  'recap.slot.bodySoFar': 'Your trip so far: days, places, spending and moods.',
  'recap.slot.a11y': 'Trip recap. {summary}',
  'recap.slot.hint': 'Opens the recap of this trip.',

  // Your travels list
  'recap.list.title': 'Trip recaps',
  'recap.list.subtitle': 'Look back on each trip.',
  'recap.list.row': '{trip}, {dates}. Opens its recap.',
  'recap.list.hint': 'Opens the trip recap.',
} as const;
