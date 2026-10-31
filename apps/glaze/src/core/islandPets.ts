// Original pixel companions. The native Live Activity uses the same checked-in pixel grid.
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
export type PetId = (typeof PETS)[number]['id'];
export const PET_MOODS = ['happy', 'playful', 'sleepy'] as const;
export type PetMood = (typeof PET_MOODS)[number];
export const isPetId = (v: unknown): v is PetId => PETS.some(p => p.id === v);
export const isPetMood = (v: unknown): v is PetMood => PET_MOODS.some(m => m === v);
export const petById = (v: unknown) => PETS.find(p => p.id === v) ?? PETS[0];
export type PetSession = { id: string; pet: PetId; mood: PetMood; startedAt: number };
export type PetStatus = { enabled: boolean; session: PetSession | null };

export function decodePetStatus(raw: unknown): PetStatus {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid pet status');
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled !== 'boolean') throw new Error('Invalid pet permission');
  if (r.active === false) return { enabled: r.enabled, session: null };
  if (r.active !== true || typeof r.id !== 'string' || !r.id || !isPetId(r.pet) || !isPetMood(r.mood) ||
      typeof r.startedAt !== 'number' || !Number.isFinite(r.startedAt) || r.startedAt <= 0) {
    throw new Error('Invalid pet session');
  }
  return { enabled: r.enabled, session: { id: r.id, pet: r.pet, mood: r.mood, startedAt: r.startedAt } };
}
