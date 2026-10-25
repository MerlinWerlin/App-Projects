// T27 strings (owned by T27). Keys prefixed by feature so they never clash.
export const followups27 = {
  // Trips home: one-tap emergency card (FLOWS §6.1)
  'emergencyShortcut.label': 'Emergency card',
  'emergencyShortcut.body': 'Local numbers, your contacts and insurance. Works with no signal.',
  'emergencyShortcut.hint': 'Opens your emergency card',

  // Packing: add a template to an existing list
  'packing.addTemplate': 'Add a template',
  'packing.addTemplateHint': 'Adds items from another trip type. Your ticks and changes stay.',
  'packing.addTemplateTitle': 'Add items from a template',
  'packing.addTemplateBody': 'Items already on your list are skipped.',
  'packing.addTemplateUsed': '{name}, already added',
  'packing.addTemplateConfirm': 'Add items',
  'packing.addTemplateConfirmHint': 'Adds the chosen templates’ items to this list',
  'packing.addTemplateDone': 'Items added: {count}',
  'packing.addTemplateNone': 'Everything in those templates is already on your list.',

  // Hotel address card: copy
  'address.copyLocal': 'Copy local-language address',
  'address.copyMain': 'Copy address',
  'address.copyIn': 'Copy address in {language}',
  'address.copyHint': 'Puts the address on the clipboard to paste into a map or message',
  'address.copied': 'Address copied.',
  'address.copyFailed': 'Couldn’t copy here. Press and hold the address to copy it.',
} as const;
