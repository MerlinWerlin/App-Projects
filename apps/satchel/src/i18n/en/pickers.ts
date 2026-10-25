// T24 strings (owned by T24). Prefix keys with the feature so they never clash.
export const pickers = {
  // Field labels when the system picker is available (the typed fallback keeps the "(YYYY-MM-DD)" labels).
  'pickers.item.startDate': 'Start date',
  'pickers.item.startTime': 'Start time',
  'pickers.item.endDate': 'End date',
  'pickers.item.endTime': 'End time',
  'pickers.trip.start': 'First day',
  'pickers.trip.end': 'Last day',
  'pickers.hint.startDate': 'Choose the start date.',
  'pickers.hint.endDate': 'Choose the end date.',
  'pickers.hint.startTime': "Choose the start time, in that place's local time.",
  'pickers.hint.endTime': "Choose the end time, in that place's local time.",
  'pickers.hint.tripStart': 'Choose the first day of the trip.',
  'pickers.hint.tripEnd': 'Choose the last day of the trip.',
  'pickers.hint.itemZone': 'Choose the time zone used for this booking.',
  'pickers.hint.homeZone': 'Choose your home time zone.',

  // Field values as shown and read out.
  'pickers.fieldValue': '{field}: {value}',
  'pickers.notSet': 'Not set',

  // The picker sheet (iPhone), with its buttons at the bottom within thumb reach.
  'pickers.done': 'Done',
  'pickers.doneHint': 'Keeps this choice and closes the picker.',
  'pickers.cancelHint': 'Closes the picker without changing anything.',

  // Time-zone search sheet.
  'pickers.zone.title': 'Choose a time zone',
  'pickers.zone.search': 'Search time zones',
  'pickers.zone.searchPlaceholder': 'City, country or UTC+9',
  'pickers.zone.searchHint': 'Type a city, a country or an offset such as UTC+9.',
  'pickers.zone.count': 'Time zones found: {n}',
  'pickers.zone.none': 'No time zone matches "{q}". Try a nearby big city, the country, or an offset such as UTC+9.',
  'pickers.zone.value': '{city} · {offset}',
  'pickers.zone.row': '{city}, {place}, {offset}',
  'pickers.zone.rowHint': 'Uses this time zone.',
  'pickers.zone.invalid': 'Not a known time zone',
  'pickers.zone.current': 'Selected',
} as const;
