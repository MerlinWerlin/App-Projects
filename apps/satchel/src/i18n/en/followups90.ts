// T84 strings: run-90 follow-ups (idea category chips' own spoken labels, ordering ideas on See on map, the
// settle-up rates note). Keys prefixed "f90.".
export const followups90 = {
  // idea editor: category chips
  'f90.ideaCat.a11y': 'Category: {cat}',
  'f90.ideaCat.hint': 'Files this idea under {cat}.',
  'f90.ideaCat.hintOn': 'This idea’s category now.',

  // Places to go: filter chips
  'f90.ideaFilter.allA11y': 'All ideas, {n}',
  'f90.ideaFilter.allHint': 'Shows every idea on this trip.',
  'f90.ideaFilter.catA11y': '{cat} ideas, {n}',
  'f90.ideaFilter.catHint': 'Shows only the {cat} ideas.',

  // See on map: a day's ideas in order
  'f90.order.up': 'Earlier',
  'f90.order.down': 'Later',
  'f90.order.upA11y': 'Move {name} earlier in the day',
  'f90.order.downA11y': 'Move {name} later in the day',
  'f90.order.upHint': 'Swaps it with the planned idea before it. The map numbers follow.',
  'f90.order.downHint': 'Swaps it with the planned idea after it. The map numbers follow.',
  'f90.order.movedUp': '{name} moved earlier',
  'f90.order.movedDown': '{name} moved later',

  // settle-up
  'f90.settle.ratesHelp': 'Balances use this trip’s own exchange rates, so they change when you edit a rate.',
} as const;
