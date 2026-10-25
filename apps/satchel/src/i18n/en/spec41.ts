// T41 strings (owned by T41): spec pass 2 against the 26 Oct spec refresh (docs/spec EDGE_CASES, ACCESSIBILITY,
// FLOWS §5-8). Keys prefixed spec41. so they never clash.
export const spec41 = {
  // EDGE_CASES "Overlapping items": both items stay, each says what it overlaps
  'spec41.row.overlaps': 'Overlaps with {titles}',
  'spec41.item.overlaps': 'This overlaps with {titles} on this trip. Nothing has been moved; check the times on your bookings.',

  // EDGE_CASES "Past trips": kept and available, not presented as coming up
  'spec41.trip.pastNotice': 'This trip has ended. Everything on it stays saved on this phone, and none of it shows as coming up.',
  'spec41.trips.rowA11y': '{name}, {phase}, {range}',
  'spec41.trips.rowHint': 'Opens the trip timeline',
  'spec41.trips.addHint': 'Creates a trip',

  // Forms: Save and Cancel say what they do (ACCESSIBILITY "Edit emergency card", "Add and edit vault document")
  'spec41.form.cancelHint': 'Returns without saving. Asks first if you have unsaved changes',
  'spec41.emergencyEdit.saveHint': 'Saves your emergency information on this phone',
  'spec41.emergencyEdit.removeHint': 'Removes this emergency contact from your card after you confirm',
  'spec41.docEdit.saveHint': 'Saves this document in the vault on this phone',
  'spec41.doc.editHint': 'Changes the document type, name, expiry date or saved copies',

  // Ticket view: copy booking reference (ACCESSIBILITY "Ticket view")
  'spec41.ticket.copyRef': 'Copy booking reference',
  'spec41.ticket.copyRefHint': 'Copies the reference to the clipboard',
  'spec41.ticket.refCopied': 'Booking reference copied',
  'spec41.ticket.refCopyFailed': 'Couldn’t copy here. Press and hold the reference to copy it.',

  // Hotel address card (FLOWS §7.1 Edit action)
  'spec41.address.edit': 'Edit hotel address',
  'spec41.address.editHint': 'Changes the saved hotel address',
  'spec41.common.closeHint': 'Returns to the previous screen',

  // Packing template chooser
  'spec41.packing.templateCancelHint': 'Closes without adding items',
} as const;
