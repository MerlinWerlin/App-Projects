// T10 strings (owned by T10). Keys prefixed by feature so they never clash.
// 'settings.title', 'settings.haptics', 'settings.hapticsHint', 'settings.privacy' and
// 'settings.version' live in ../en.ts and are reused, not redefined.
// Never quote battery numbers here: the threshold is passed in as {percent} by the screen.
export const trial = {
  // Offline banner (Trips home)
  'offline.title': 'Flight mode: tickets, cards and documents still work',
  'offline.body': 'Everything you saved is on this phone. The map may not load until you have a signal again.',

  // Settings
  'settings.sectionFeedback': 'Feedback',
  'settings.hapticsA11yHint': 'Turns optional vibration feedback on or off',
  'settings.sectionEssentials': 'Low-battery essentials',
  'settings.essentialsManual': 'Low-battery essentials mode',
  'settings.essentialsManualHint': 'Manually turns essentials mode on or off. Turning it on opens essentials.',
  'settings.essentialsBody': 'Your next ticket, hotel address and emergency card on a plain black screen, with no animation and no map.',
  'settings.threshold': 'Offer essentials at {percent} battery or lower',
  'settings.thresholdBody': 'Only while the phone isn\'t charging. Satchel asks first and never switches by itself.',
  'settings.thresholdLower': 'Lower the essentials threshold',
  'settings.thresholdLowerHint': 'Offers essentials at a lower battery level',
  'settings.thresholdRaise': 'Raise the essentials threshold',
  'settings.thresholdRaiseHint': 'Offers essentials at a higher battery level',
  'settings.thresholdA11y': 'Essentials threshold, {percent}',
  'settings.privacyHeading': 'Data Not Collected',
  'settings.privacyAccounts': 'No account, no ads, no analytics and no tracking.',
  'settings.privacyOnDevice': 'Trips, tickets, documents, packing lists and your emergency card are saved on this phone only.',
  'settings.privacyLocation': 'Location is used only when you ask (Where am I?, a near-me search, Find my way back while it is open), never in the background.',
  'settings.privacyMap': 'The map uses your phone\'s built-in map service, which needs a signal.',
  'settings.sectionAbout': 'About',
  'settings.emergencyRef': 'Emergency numbers come with the app (list dated {date}) and work offline. Always verify them locally.',

  // Empty states
  'empty.wallet.action': 'Go to your trips',
  'empty.wallet.actionHint': 'Opens the Trips tab, where you can add a booking and attach its ticket',
} as const;
