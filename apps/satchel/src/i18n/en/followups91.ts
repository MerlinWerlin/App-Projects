// Strings for followups91 (run 92). Every UI string lives in the catalogue.
// T88: the sample trip's recap preview, the Trips tab's Trip recap card, membership cards in Low-battery essentials
// and the optional card photo. Keys prefixed "f91.".
export const followups91 = {
  // Trip recap: the sample trip before its dates
  'f91.recap.preview': 'Sample preview: the sample trip is shown as if it had finished, with its sample journal pages. Your own trips get a recap once they start.',

  // Trips tab: the latest finished trip's recap
  'f91.home.eyebrow': 'Trip recap',
  'f91.home.eyebrowSample': 'Trip recap · sample trip',
  'f91.home.body': '{days} days · {cities} · {km} km',
  'f91.home.best': 'Best day: {day}, {mood}',
  'f91.home.dayLabel': 'Day {n}',
  'f91.home.a11y': 'Trip recap for {trip}. {summary}',
  'f91.home.hint': 'Opens the recap of this trip.',

  // Low-battery essentials: membership cards
  'f91.ess.heading': 'Membership cards',
  'f91.ess.body': 'Open a card to show it big, at full brightness, with its barcode.',
  'f91.ess.open': 'Show {programme} card',
  'f91.ess.openHint': 'Opens the card at full brightness for scanning.',
  'f91.ess.photo': 'Card photo saved',

  // Loyalty card photo
  'f91.photo.label': 'Card photo',
  'f91.photo.help': 'Optional: a photo of the card itself. Satchel keeps its own copy on this phone only.',
  'f91.photo.add': 'Add card photo',
  'f91.photo.addHint': 'Picks a photo from your library and keeps a copy on this phone.',
  'f91.photo.change': 'Change photo',
  'f91.photo.changeHint': 'Picks a different photo for this card.',
  'f91.photo.remove': 'Remove photo',
  'f91.photo.removeHint': 'Takes the photo off this card. The copy is deleted when you save.',
  'f91.photo.a11y': 'Photo of your {programme} card',
  'f91.photo.denied': 'Satchel can’t open your photos. Allow Photos access in Settings to add a card photo.',
} as const;
