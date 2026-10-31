// T58 strings (run 85 follow-ups): home country in Settings, the allergen slot on the allergy card and the
// Traditional Chinese phrase language. The allergen names in the local languages live in src/content/phrases.json.
export const followups85 = {
  // Settings: home country (the same saved choice as the essentials card's "Bring an adapter?")
  'settings.homeCountry': 'Home country',
  'settings.homeCountryBody': 'Used by “Bring an adapter?” on the Emergency tab to compare plugs and voltage. Saved on this phone only.',
  'settings.homeCountryValue': 'Home country: {country}',
  'settings.homeCountryNone': 'Not set',

  // Phrase picker: Traditional Chinese
  'phrases.lang.zh-Hant': 'Chinese (Traditional)',

  // Allergy card: the allergen slot
  'phrases.allergens.heading': 'Allergic to',
  'phrases.allergens.none': 'Add what you’re allergic to and it shows here in this language.',
  'phrases.allergens.choose': 'Choose allergens',
  'phrases.allergens.change': 'Change allergens',
  'phrases.allergens.chooseHint': 'Shows a list of common allergens to pick from. Saved on this phone only.',
  'phrases.allergens.done': 'Done',
  'phrases.allergens.doneHint': 'Closes the allergen list',
  'phrases.allergens.pickerLabel': 'Allergens',
  'phrases.allergens.lineA11y': '{english}: {local}',
  'phrases.allergens.check': 'Allergen names haven’t been checked by a native speaker yet. For a severe allergy, also carry a card written by someone who speaks the language.',

  'phrases.allergen.peanuts': 'Peanuts',
  'phrases.allergen.treeNuts': 'Tree nuts',
  'phrases.allergen.shellfish': 'Shellfish',
  'phrases.allergen.fish': 'Fish',
  'phrases.allergen.milk': 'Milk',
  'phrases.allergen.egg': 'Egg',
  'phrases.allergen.wheat': 'Wheat / gluten',
  'phrases.allergen.soy': 'Soy',
  'phrases.allergen.sesame': 'Sesame',
} as const;
