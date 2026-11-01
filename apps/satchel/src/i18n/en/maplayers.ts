// Strings for maplayers (run 99, T117 map layers + legend: src/ui/MapLayersSheet.tsx, src/ui/useMapLayers.ts and
// the Layers button on the Map tab). Every UI string lives in the catalogue.
export const maplayers = {
  // The button under the map
  'maplayers.open': 'Layers',
  'maplayers.openHidden': 'Layers · {n} off',
  'maplayers.openHint': 'Choose which pins the map shows and see what each colour means.',
  'maplayers.allOff': 'Every layer is off, so the map shows no pins.',

  // The sheet
  'maplayers.title': 'Map layers',
  'maplayers.body': 'Choose which pins the map shows. Your choice stays on this phone.',
  'maplayers.done': 'Done',
  'maplayers.doneHint': 'Closes map layers.',
  'maplayers.scrimHint': 'Closes map layers.',

  // Scope
  'maplayers.scope.label': 'Trips on the map',
  'maplayers.scope.all': 'Show all trips',
  'maplayers.scope.trip': 'Only this trip',
  'maplayers.scope.tripNamed': 'Only {trip}',
  'maplayers.scope.allHint': 'Shows bookings, ideas, places and gifts from every trip.',
  'maplayers.scope.tripHint': 'Shows only this trip’s bookings, ideas, places and gifts, with its route.',
  'maplayers.scope.none': 'Add a trip to show only that trip on the map.',

  // Layers + legend
  'maplayers.layers': 'Pins and what they mean',
  'maplayers.count': '{n} pins',
  'maplayers.countOne': '1 pin',
  'maplayers.countNone': 'None yet',
  'maplayers.shown': 'shown',
  'maplayers.hidden': 'hidden',
  'maplayers.toggleA11y': '{layer}, {count}, {state}',
  'maplayers.toggleHint': 'Shows or hides these pins on the map.',
  'maplayers.byDay': 'Each day has its own colour.',
  'maplayers.phoneOnly': 'Kept on this phone, shown for every trip.',
  'maplayers.showEvery': 'Show every layer',
  'maplayers.showEveryHint': 'Turns every layer back on.',

  'maplayers.layer.route': 'Trip route',
  'maplayers.layer.route.desc': 'Numbered stops by day, joined by a dashed line. Only when the map shows one trip.',
  'maplayers.layer.dayplan': 'Today’s plan',
  'maplayers.layer.dayplan.desc': 'Your Plan my day stops for today, numbered in walking order.',
  'maplayers.layer.bookings': 'Bookings',
  'maplayers.layer.bookings.desc': 'Hotels, flights, trains and other bookings that have a place.',
  'maplayers.layer.ideas': 'Ideas',
  'maplayers.layer.ideas.desc': 'Trip ideas you gave a map spot.',
  'maplayers.layer.saved': 'Saved places',
  'maplayers.layer.saved.desc': 'Places you saved to a trip from the map.',
  'maplayers.layer.gifts': 'Gifts',
  'maplayers.layer.gifts.desc': 'Gift ideas with a shop or market on the map.',
  'maplayers.layer.wayback': 'Your pins',
  'maplayers.layer.wayback.desc': 'Pins you dropped in Find my way back, like where you parked.',
  'maplayers.layer.toilets': 'Saved toilets',
  'maplayers.layer.toilets.desc': 'Toilets you saved in the Toilets tab.',
  'maplayers.layer.pois': 'Points of interest',
  'maplayers.layer.pois.desc': 'Places from the city points, filtered by the category chips.',

  'maplayers.other': 'Other pins',
  'maplayers.other.me': 'Where you are (after Where am I?)',
  'maplayers.other.search': 'Search result',
  'maplayers.other.spot': 'A spot you tapped on the map',

  // Fit
  'maplayers.fit': 'Fit to visible pins',
  'maplayers.fitHint': 'Moves the map to show every pin that’s on.',
  'maplayers.fitNone': 'No pins are showing. Turn a layer on to fit the map to it.',

  // Pins the layers added to the map
  'maplayers.pin.idea': 'Idea · {trip}',
  'maplayers.pin.ideaDone': 'Idea, been there · {trip}',
  'maplayers.pin.ideaA11y': 'Idea: {name}',
  'maplayers.pin.wayback': 'Your pin',
  'maplayers.pin.waybackA11y': 'Your pin: {name}',
  'maplayers.pin.toilet': 'Saved toilet',
  'maplayers.pin.toiletA11y': 'Saved toilet: {name}',
  'maplayers.pin.dayplan': 'Today’s plan, stop {n}',
  'maplayers.pin.dayplanA11y': 'Today’s plan, stop {n}: {name}',
} as const;
