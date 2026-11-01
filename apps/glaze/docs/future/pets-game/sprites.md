# Pet sprites (parked)

Original 16×16 pixel grids authored for Glaze on 26 October 2026 (no third-party art), copied from `src/core/islandPets.ts` at commit `7927df4`. Removed from the app in T198.

Palette (from `src/ui/IslandPetArt.tsx`): `#` outline and `e` eye `#35283F`, `w` belly / muzzle `#FFF5E5`, `o` the pet's body colour, `.` transparent. Pose accents drawn on top: sleep "z" `#E9DDF5`, eat bowl `#F2C252`, play ball `#E478A5`, cheer heart `#E478A5`.

```ts
export const PETS = [
  { id: 'cat', name: 'Mushy', color: '#C5A6F4', rows: [
    '................', '..##........##..', '..###......###..', '..#o########o#..',
    '..#oooooooooo#..', '..#oooooooooo#..', '..#ooeooooeoo#..', '..#oooooooooo#..',
    '...#oowwwwwo#...', '....##wwww##....', '....#oooooo#..#.', '...#oooooooo#o#.',
    '...#oooooooo##..', '....#oo##oo#....', '....#######.....', '................',
  ] },
  { id: 'fox', name: 'Pip', color: '#F0A36A', rows: [
    '................', '.###........###.', '..#o#......#o#..', '..#oo######oo#..',
    '..#oooooooooo#..', '...#oeooooeo#...', '...#oooooooo#...', '....#wwwwww#....',
    '.....##ww##.....', '.....#oooo#.....', '....#oowwoo#..#.', '....#oowwoo#oow#',
    '....#oooooo#ow#.', '.....#o##o###...', '.....######.....', '................',
  ] },
  { id: 'bunny', name: 'Clover', color: '#F5DBAC', rows: [
    '...##....##.....', '..#oo#..#oo#....', '..#oo#..#oo#....', '..#oo#..#oo#....',
    '...#o####o#.....', '..#oooooooo#....', '..#ooeooeoo#....', '..#oooooooo#....',
    '...#owwwwo#.....', '....######......', '....#oooo#......', '...#oowwoo#.....',
    '...#oowwoo##....', '....#oooo#ww#...', '....######......', '................',
  ] },
] as const;
```
