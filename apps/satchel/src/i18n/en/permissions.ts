// T19 strings (owned by T19). Keys prefixed 'permissions.' so they never clash with other features.
// Shape: permissions.<kind>.<state> is the plain reason, permissions.<kind>.title.<off|limited|unavailable> the
// heading and permissions.<kind>.fallback the other way to get it done (keys built in src/core/permissions.ts).
export const permissions = {
  'permissions.a11y': '{title}. {reason}',
  'permissions.openSettingsHint': 'Opens Satchel in the Settings app, where you can change this',
  'permissions.retryHint': 'Asks again',

  'permissions.location.title.off': 'Location access is off',
  'permissions.location.title.limited': 'Location is approximate',
  'permissions.location.title.unavailable': 'Location isn’t available',
  'permissions.location.ask': 'Satchel checks your location only when you ask, to show where you are on the map. It never tracks you in the background.',
  'permissions.location.blocked': 'Satchel can’t check your location. Allow location access in Settings, or use the map without your location.',
  'permissions.location.limited': 'Satchel only has your approximate location. Turn on Precise Location in Settings for a more exact dot.',
  'permissions.location.unavailable': 'Location Services are off on this phone. Turn them on in Settings, or use the map without your location.',
  'permissions.location.fallback': 'Use the map without my location',

  'permissions.photos.title.off': 'Photos access is off',
  'permissions.photos.title.limited': 'Satchel sees only some photos',
  'permissions.photos.title.unavailable': 'Photos can’t open',
  'permissions.photos.ask': 'Satchel needs to open your photos to add the one you choose. Nothing else is read.',
  'permissions.photos.blocked': 'Satchel can’t open your photos. Allow Photos access in Settings, or attach the file from Files instead.',
  'permissions.photos.limited': 'Satchel can see only the photos you selected. Choose more in Settings, or attach the file from Files.',
  'permissions.photos.unavailable': 'Photos couldn’t open on this phone. Attach the file from Files instead.',
  'permissions.photos.fallback': 'Attach from Files instead',

  'permissions.faceid.title.off': 'Face ID is off for Satchel',
  'permissions.faceid.title.limited': 'Face ID is off for Satchel',
  'permissions.faceid.title.unavailable': 'Face ID isn’t set up',
  'permissions.faceid.ask': 'Satchel couldn’t confirm it’s you. Try again, or use your device passcode.',
  'permissions.faceid.blocked': 'Allow Face ID for Satchel in Settings to lock the document vault, or use your device passcode.',
  'permissions.faceid.limited': 'Allow Face ID for Satchel in Settings to lock the document vault, or use your device passcode.',
  'permissions.faceid.unavailable': 'Turn on Face ID or a device passcode in Settings to lock the document vault.',
  'permissions.faceid.fallback': 'Use device passcode',

  'permissions.contacts.title.off': 'Contacts access is off',
  'permissions.contacts.title.limited': 'Satchel sees only some contacts',
  'permissions.contacts.title.unavailable': 'Contacts can’t open',
  'permissions.contacts.ask': 'Satchel can use your contacts to add an emergency contact. You can also enter their details yourself.',
  'permissions.contacts.blocked': 'Allow Contacts access in Settings, or add the emergency contact details yourself.',
  'permissions.contacts.limited': 'Satchel can see only the contacts you shared. Share more in Settings, or add the details yourself.',
  'permissions.contacts.unavailable': 'The contact picker isn’t available on this phone. Add the emergency contact details yourself.',
  'permissions.contacts.fallback': 'Type the contact by hand',

  'permissions.files.title.off': 'Files access is off',
  'permissions.files.title.limited': 'Files access is limited',
  'permissions.files.title.unavailable': 'Files can’t open',
  'permissions.files.ask': 'Satchel needs to open Files to add the file you choose. Nothing else is read.',
  'permissions.files.blocked': 'Satchel can’t open Files. Check access in Settings, or choose a photo instead.',
  'permissions.files.limited': 'Satchel can open only some locations in Files. Check access in Settings, or choose a photo instead.',
  'permissions.files.unavailable': 'Files couldn’t open on this phone. Choose a photo instead.',
  'permissions.files.fallback': 'Choose a photo instead',
} as const;
