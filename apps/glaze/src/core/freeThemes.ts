// Glaze 1.0.41 (owner 2026-11-15: "pick 10 which you think would be pretty good as free ... put the
// remainder behind a paywall ... $3 a year ... the 10 free ones are the free trial ... make one or two
// of them really good ... the first tab they open should be the free ones"): the free set, in the
// order the Themes tab's Free section shows it. Every other gallery theme needs Glaze Plus (the yearly
// subscription). The catalogue's own `plus` flags stay false (changing them would re-version every
// pack); the app decides here, so the free set can change with an app update alone.
//  - Featured (owner): Alpine Starlight first, then Cloud Atelier ("the pink-cloud one with the whale").
//  - The 8 bundled starter packs + Cloud Atelier (bundled in 1.0.41) + Deep Sea (in the app since 1.0.3):
//    all 10 work offline on a fresh install.
//  - Deep Sea over Starry Night: its five pieces are one consistent glowing-teal set; Starry Night's
//    flat copper moon in an orange ring clashes with its painterly space pieces.
// Pure TS (Node-tested).

/** The free themes, in Free-section order (featured first). */
export const FREE_THEME_IDS: readonly string[] = Object.freeze([
  'alpine-starlight',
  'cloud-atelier',
  'aurora-haven',
  'cobalt-caravan',
  'cherry-arcade',
  'boba-bear-club',
  'espresso-hour',
  'lemon-lagoon',
  'honeywood',
  'deep-sea',
]);

/** The owner's standout picks, shown first and larger in the Free section. */
export const FEATURED_FREE_IDS: readonly string[] = Object.freeze(['alpine-starlight', 'cloud-atelier']);

const FREE = new Set(FREE_THEME_IDS);

/** True for one of the ten free themes. */
export function isFreeTheme(id: string | null | undefined): boolean {
  return typeof id === 'string' && FREE.has(id);
}

/** The free themes found in `pool`, in Free-section order. */
export function freeThemesIn<T extends { id: string }>(pool: readonly T[]): T[] {
  const byId = new Map(pool.map((t) => [t.id, t] as const));
  return FREE_THEME_IDS.flatMap((id) => {
    const t = byId.get(id);
    return t ? [t] : [];
  });
}
