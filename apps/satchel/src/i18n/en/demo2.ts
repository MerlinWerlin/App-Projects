// Strings for T163 screenshot demo travels (run 112, prefix demo2.). Every UI string lives in the catalogue.
export const demo2 = {
  // Settings: add / remove the two invented past trips (src/core/sampletravels.ts, src/ui/SampleTravels.tsx).
  'demo2.title': 'Sample past trips',
  'demo2.body': 'Adds two made-up past trips, marked Sample, so Your travels and the passport stamps have something to show, for example in screenshots. They are never put in backups or exported trip files.',
  'demo2.add': 'Add sample past trips',
  'demo2.addHint': 'Adds two invented past trips marked Sample and turns on Include demo trips in Your travels',
  'demo2.remove': 'Remove sample trips',
  'demo2.removeHint': 'Deletes both sample past trips in one tap and turns Include demo trips back off if adding them turned it on. Your own trips stay as they are.',
  'demo2.added': 'Two sample past trips added. Remove them here at any time.',
  'demo2.removed': 'Sample past trips removed.',
  // The small chip on a sample trip's pass (Trips list) and the note in place of Export on its trip screen.
  'demo2.chip': 'Sample',
  'demo2.noExport': 'Sample trips can’t be exported. Remove them in Settings when you’re done.',
} as const;
