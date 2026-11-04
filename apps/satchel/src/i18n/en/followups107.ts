// Strings for followups107 (run 110). Every UI string lives in the catalogue.
// T151: run-107 follow-ups (prefix f107.).
export const followups107 = {
  // Your day: postcards on a free afternoon (src/ui/followups107.tsx PostcardsBriefRow)
  'f107.postcards.brief': 'A free afternoon: {n} postcards to write',
  'f107.postcards.briefOne': 'A free afternoon: 1 postcard to write',
  'f107.postcards.briefSub': '{sent} of {total} sent',
  'f107.postcards.briefHint': 'Opens your postcard list for {trip}.',

  // Plan this trip again: what comes along (summary) and the children
  'f107.summary.title': 'Coming along',
  'f107.summary.none': 'Only the trip’s name and dates.',
  'f107.summary.bookings': 'Bookings',
  'f107.summary.packing': 'Packing list',
  'f107.summary.bags': 'Bags',
  'f107.summary.ideas': 'Ideas and saved places',
  'f107.summary.todos': 'To-dos',
  'f107.summary.companions': 'Companions',
  'f107.summary.budget': 'Budget',
  'f107.summary.giftNames': 'Gift list names',
  'f107.summary.leavingHome': 'Leaving home checklist',
  'f107.summary.comingHome': 'Coming home lists',
  'f107.summary.postcards': 'Postcards',
  'f107.summary.kids': 'Children',
  'f107.copy.kids': 'Children ({n}): {names}',
  'f107.copy.kidsMore': '{names} and {n} more',
  'f107.copy.kidsHint': 'Their first names and age groups, and the parent phone for the lost card, on this phone only. Check their ages on the new trip.',
  'f107.copy.kidsFailed': 'The trip was copied, but the children list couldn’t be saved.',
  'f107.copy.neverBody': 'Booking references, seats, tickets and other files, stay details (room, codes, Wi-Fi), receipts, journal, spending, exchange rates, cash, gifts, planned outfits and laundry days, checklist ticks, postcard sent ticks, kid-friendly marks, sitter tasks on this trip’s dates and the trip rating stay with this trip.',

  // Check-out Calendar reminder (booking screen check-in card)
  'f107.checkout.remind': 'Remind me to check out',
  'f107.checkout.remindHint': 'Adds a Calendar event with an alert {n} minutes before check-out, on the hotel’s clock.',
  'f107.checkout.summary': 'Check out of {name} by {time}',
  'f107.checkout.description': 'Check-out from {name} is at {time} {city} time. {note}',
  'f107.checkout.shareTitle': 'Add the check-out reminder to Calendar',

  // Sign reader: Macau
  'f107.signs.region.MO': 'Macau',

  // Numbers trainer: casual spoken forms
  'f107.numbers.casual': 'Often said: {text}',
  'f107.numbers.casualRoman': 'Reading: {roman}',
  'f107.numbers.casualA11y': 'Often said: {text}. Checked by a fluent speaker: not yet.',
  'f107.numbers.rule.zhKuai': '块 / 塊 for 元 and 毛 for 角 in everyday speech.',
  'f107.numbers.rule.thOne': 'The หนึ่ง (one) before ร้อย or พัน is often dropped.',
  'f107.numbers.rule.viNgan': 'ngàn for nghìn (usual in the south); prices often without đồng.',
} as const;
