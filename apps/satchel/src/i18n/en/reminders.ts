// Trip reminders (docs/REMINDERS.md). Keys prefixed 'reminders.'. Notification words are planned in
// src/core/reminders.ts (REMINDER_KEYS lists every key it can return); Settings and the Itinerary card use the rest.
export const reminders = {
  // Notification titles
  'reminders.title': '{title}',
  'reminders.flight.fallbackTitle': 'Your flight',
  'reminders.train.fallbackTitle': 'Your train',
  'reminders.ferry.fallbackTitle': 'Your ferry',
  'reminders.bus.fallbackTitle': 'Your bus',
  'reminders.hotel.fallbackTitle': 'Your stay',
  'reminders.car.fallbackTitle': 'Your hire car',
  'reminders.activity.fallbackTitle': 'Your plan',
  'reminders.activity.title': 'Coming up at {time}',

  // Notification bodies
  'reminders.flight.body': 'Your flight to {place} leaves at {time}.',
  'reminders.flight.bodyNoPlace': 'Your flight leaves at {time}.',
  'reminders.train.body': 'Your train to {place} leaves at {time}.',
  'reminders.train.bodyNoPlace': 'Your train leaves at {time}.',
  'reminders.ferry.body': 'Your ferry to {place} leaves at {time}.',
  'reminders.ferry.bodyNoPlace': 'Your ferry leaves at {time}.',
  'reminders.bus.body': 'Your bus to {place} leaves at {time}.',
  'reminders.bus.bodyNoPlace': 'Your bus leaves at {time}.',
  'reminders.hotel.checkinBody': 'Check in at {place} from {time}.',
  'reminders.hotel.checkinBodyNoPlace': 'You can check in from {time}.',
  'reminders.hotel.checkoutBody': 'Check out of {place} by {time}.',
  'reminders.hotel.checkoutBodyNoPlace': 'Check out by {time}.',
  'reminders.car.body': 'Pick up your car at {place} at {time}.',
  'reminders.car.bodyNoPlace': 'Pick up your car at {time}.',
  'reminders.activity.body': '{title} at {place} in {minutes} minutes.',
  'reminders.activity.bodyNoPlace': '{title} in {minutes} minutes.',
  'reminders.activity.bodyUntitled': 'Your next plan at {place} starts in {minutes} minutes.',
  'reminders.activity.bodyUntitledNoPlace': 'Your next plan starts in {minutes} minutes.',

  // Settings
  'reminders.settings.title': 'Reminders',
  'reminders.settings.toggle': 'Trip reminders',
  'reminders.settings.toggleHint': 'Turns reminders before your flights, stays and plans on or off.',
  'reminders.settings.body': 'A gentle nudge before each flight, train, check-in and plan. Set on this phone; nothing is sent anywhere.',
  'reminders.settings.sounds': 'They follow your silent switch, Focus and notification settings.',
  'reminders.settings.deniedTitle': 'Notifications are off for Satchel',
  'reminders.settings.deniedBody': 'To get trip reminders, allow notifications for Satchel in your phone’s Settings.',
  'reminders.settings.openSettings': 'Open Settings',
  'reminders.settings.openSettingsHint': 'Opens Satchel’s page in your phone’s Settings.',

  // Itinerary tab offer (one time, dismissable)
  'reminders.offer.title': 'Remind me before each plan',
  'reminders.offer.body': 'Get a gentle nudge before flights, check-ins and plans on this trip.',
  'reminders.offer.turnOn': 'Turn on reminders',
  'reminders.offer.turnOnHint': 'Asks to send notifications, then schedules reminders on this phone.',
  'reminders.offer.dismiss': 'Not now',
  'reminders.offer.dismissHint': 'Hides this offer. You can turn reminders on in Settings.',
} as const;
