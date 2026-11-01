// Which src/i18n string groups the docs/spec catalogues must mirror word for word (T53, folded into T67), and the
// pure merge that brings a catalogue in line. docs/spec/EN_CATALOGUE.json is the English export the translation lane
// works from; docs/spec/STRINGS_NEW.json is the lane's own key list (reference only, but kept in step for these
// groups). src/i18n/en.ts stays the single source. Groups other workers own (journal.*, travels.*, jetlag.*) are
// deliberately not listed here: they are added when those features settle.
// Refresh after changing a listed string: node tools/i18n/sync-spec-catalogues.mjs (src/i18n/specsync.test.ts checks).

/** The docs/spec catalogue files that mirror the listed groups. */
export const SPEC_CATALOGUES = ['docs/spec/EN_CATALOGUE.json', 'docs/spec/STRINGS_NEW.json'] as const;

/** Key prefixes mirrored in full (owner-1031 and runs 84-87 features). */
export const SPEC_SYNC_PREFIXES = [
  'toilets.',
  'design.',
  'citymaps.',
  'spending.',
  'essentials.',
  'phrases.',
  'privacy.',
  'help.',
  'readiness.',
  'convert.',
  'journal.',
  'travels.',
  'jetlag.',
  'emergency.fallback',
  // T72: the run-87 features (T69 trip on the map, T70 weather, T71 share plan and Your day).
  'share.',
  'brief.',
  'triproute.',
  'weather.',
  // T76: the run-88 features (T72 position picker and licences, T73 find my way back, T74 airport day, T75 smart
  // packing) and the T76 follow-ups.
  'position.',
  'licences.',
  'wayback.',
  'airport.',
  'smartpack.',
  'f88.',
  // T80: the run-89 features (T77 paste a booking, T78 when things go wrong, T79 toilets deeper) and the T80
  // follow-ups.
  'paste.',
  'trouble.',
  'toiletplus.',
  'f89.',
  // T84: the run-90 features (T81 places to go, T82 travelling together, T83 trip covers) and the T84 follow-ups,
  // plus the run-91 groups (T86 trip recap, T87 loyalty cards): re-run the sync after their strings land.
  'ideas.',
  'together.',
  'covers.',
  'f90.',
  'recap.',
  'loyalty.',
  // T91: the run-92 design sweep (hero banners, section headers).
  'look.',
  // T88: the run-91 follow-ups.
  'f91.',
  // T89 Add to Calendar (run 92).
  'calendar.',
  // T90 (run 92): travel converters.
  'units.',
  // Run 93: T93 trip to-dos, T94 map search, T95 arrival card, T92 follow-ups.
  'todos.',
  'mapsearch.',
  'arrival.',
  'f92.',
  // Run 94: T97 I'm safe, T98 plan my day, T99 bags, T96 follow-ups.
  'safe.',
  'dayplan.',
  'bags.',
  'f93.',
  // Run 95: T101 medicine times, T102 cash, T103 passport stamps, T100 follow-ups.
  'meds.',
  'cash.',
  'stamps.',
  'f94.',
  // Run 96: T105 tipping, T106 public holidays, T107 gifts, T104 follow-ups.
  'tipping.',
  'holidays.',
  'gifts.',
  'f95.',
  // Run 97: T109 stay details, T110 menu helper, T111 spending insights, T108 follow-ups.
  'stay.',
  'menu.',
  'insights.',
  'f96.',
  'inflight.',
  'callhome.',
  'customs.',
  'f97.',
  'maplayers.',
  'tripcopy.',
  'look2.',
  'leavehome.',
  'games.',
  'f100.',
  'lostbag.',
  'comehome.',
  'f101.',
  'layover.',
  'getaround.',
  'f102.',
  'f98.',
  'helpcards.',
  'driving.',
  'f99.',
] as const;

/** Single keys mirrored as well: map.online, the T48 emergency fallback wording, the Toilets tab, home country. */
export const SPEC_SYNC_KEYS = [
  'map.online',
  'emergency.noNumber',
  'emergency.missingCovered',
  'emergency.missingNone',
  'tab.toilets',
  'settings.homeCountry',
  'settings.homeCountryBody',
  'settings.homeCountryValue',
  'settings.homeCountryNone',
] as const;

export const inSpecGroups = (key: string): boolean =>
  (SPEC_SYNC_KEYS as readonly string[]).includes(key) || SPEC_SYNC_PREFIXES.some((p) => key.startsWith(p));

export type SpecDrift = { missing: string[]; stale: string[]; changed: string[] };

/** How a catalogue differs from en for the listed groups (empty lists = in line). */
export function specDrift(catalogue: Record<string, unknown>, en: Record<string, string>): SpecDrift {
  const missing = Object.keys(en).filter((k) => inSpecGroups(k) && !(k in catalogue));
  const stale = Object.keys(catalogue).filter((k) => inSpecGroups(k) && !(k in en));
  const changed = Object.keys(catalogue).filter((k) => inSpecGroups(k) && k in en && catalogue[k] !== en[k]);
  return { missing, stale, changed };
}

/**
 * The catalogue brought in line for the listed groups: changed values replaced where they stand, keys no longer in
 * en removed, new keys appended in en's order. Keys outside the groups are never touched.
 */
export function syncSpec(catalogue: Record<string, unknown>, en: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(catalogue)) {
    if (!inSpecGroups(k)) out[k] = v;
    else if (k in en) out[k] = en[k];
  }
  for (const [k, v] of Object.entries(en)) if (inSpecGroups(k) && !(k in out)) out[k] = v;
  return out;
}
