// T68 strings (run 86 follow-ups): journal photos in trip files, usual sleep in Settings, and the call finder
// looking past today. Jet lag wording that already existed stays in ./jetlag.ts.
export const followups86 = {
  // Export: "Include journal photos" (off by default) and its size note
  'tripfile.photos.toggle': 'Include journal photos',
  'tripfile.photos.hint': 'Adds this trip’s journal photos to the file. Off by default to keep the file small.',
  'tripfile.photos.sizeOne': '1 photo, about {size}. A bigger file takes longer to send.',
  'tripfile.photos.size': '{n} photos, about {size}. A bigger file takes longer to send.',
  'tripfile.photos.sizeAtLeast': '{n} photos, at least {size}. A bigger file takes longer to send.',
  'tripfile.photos.sizeUnknown': '{n} photos. A bigger file takes longer to send.',
  'tripfile.photos.off': 'Journal photos stay on this phone. The journal pages still go in the file.',
  'tripfile.photos.skipped': '{n} journal photos couldn’t be read or didn’t fit and were left out of the file.',

  // Import: the notice on the imported trip
  'tripfile.photos.leftOutTitle': 'Journal photos not included',
  'tripfile.photos.leftOutOne': '1 journal photo wasn’t in this file, so it stayed on the sender’s phone. The journal pages came across without it.',
  'tripfile.photos.leftOutMany': '{n} journal photos weren’t in this file, so they stayed on the sender’s phone. The journal pages came across without them.',
  'tripfile.photos.leftOutAsk': 'To get them, ask the sender to export the trip again with “Include journal photos” on.',
  'tripfile.photos.dismiss': 'OK',
  'tripfile.photos.dismissHint': 'Hides this notice',

  // Settings: usual sleep
  'settings.sleep': 'Usual sleep',
  'settings.sleepBody': 'Used by the jet lag plan and to find a good time to call home. Saved on this phone only.',
  'settings.sleepBed': 'Bedtime {time}',
  'settings.sleepWake': 'Wake-up {time}',
  'settings.sleepBedLabel': 'Usual bedtime',
  'settings.sleepWakeLabel': 'Usual wake-up time',
  'settings.sleepAdjustHint': 'Changes it by {min} minutes.',
  'settings.sleepEarlier': 'Earlier',
  'settings.sleepLater': 'Later',
  'settings.sleepEarlierHint': 'Moves this time {min} minutes earlier.',
  'settings.sleepLaterHint': 'Moves this time {min} minutes later.',

  // Good time to call: today and the next days
  'jetlag.call.nextOn': 'Next good time: {day}, {city} {thereFrom}, home {homeFrom}',
  'jetlag.call.noneAhead': 'No overlap in the next {days} days: there is no time when both clocks are between {from} and {to}.',
  'jetlag.call.noneDay': 'No overlap this day.',
  'jetlag.call.today': 'Today',
  'jetlag.call.dayHeader': '{day} (home)',
} as const;
