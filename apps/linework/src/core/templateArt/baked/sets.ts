// Template sets whose art is generated (occlude.ts / helper geometry) and therefore baked into finished path strings
// by scripts/bake-templates.ts (T117). `name` is the exported array, `file` the generator module and the baked file
// name. Add every new generated batch here, run the bake script, and import it in templates.ts from ./templateArt/baked/.
export const BAKED_SETS: readonly { name: string; file: string }[] = [
  { name: 'cute', file: 'cute' },
  { name: 'heroes', file: 'heroes' },
  { name: 'game', file: 'game' },
  { name: 'movies', file: 'movies' },
  { name: 'fairytales', file: 'fairytales' },
  { name: 'kids', file: 'kids' },
  { name: 'kawaiiFood', file: 'kawaiiFood' },
  { name: 'kawaiiFriends', file: 'kawaiiFriends' },
  { name: 'sealife', file: 'sealife' },
  { name: 'animals2', file: 'animals2' },
  { name: 'figures', file: 'figures' },
  { name: 'stilllife2', file: 'stilllife2' },
  { name: 'places2', file: 'places2' },
  { name: 'fantasy2', file: 'fantasy2' },
  { name: 'shapes2', file: 'shapes2' },
  { name: 'flash', file: 'flash' },
  { name: 'game2', file: 'game2' },
  { name: 'heroes2', file: 'heroes2' },
];
