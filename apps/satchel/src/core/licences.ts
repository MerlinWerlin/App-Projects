// T72: what Settings > Licences and credits lists: the data, fonts, icons and libraries Satchel ships or calls, each
// with its licence and where to read it. The single source is docs/THIRD_PARTY.md; licences.test.ts checks this
// list against it and against package.json, so a new dependency can't ship without a row here. Names and licence
// names are proper names (not translated); `what` / `credit` are catalogue keys (src/i18n/en/licences.ts).

export type LicenceEntry = {
  id: string;
  /** The project or data source, as it names itself. */
  name: string;
  /** The licence's short name, e.g. 'ODbL 1.0', 'CC BY 4.0', 'MIT'. */
  licence: string;
  /** Where to read the licence or the source's terms. */
  url?: string;
  /** Catalogue key: what Satchel uses it for. */
  what?: string;
  /** Catalogue key: the attribution line the licence asks for, shown as written. */
  credit?: string;
  /** npm packages this row covers (checked against package.json dependencies). */
  packages?: readonly string[];
};

export type LicenceSection = { id: 'data' | 'fonts' | 'libraries' | 'platform' | 'content'; title: string; entries: readonly LicenceEntry[] };

const EXPO_MODULES = [
  'expo',
  'expo-router',
  'expo-asset',
  'expo-battery',
  'expo-brightness',
  'expo-clipboard',
  'expo-constants',
  'expo-contacts',
  'expo-document-picker',
  'expo-file-system',
  'expo-font',
  'expo-haptics',
  'expo-image-picker',
  'expo-keep-awake',
  'expo-linking',
  'expo-local-authentication',
  'expo-localization',
  'expo-location',
  'expo-network',
  'expo-sharing',
  'expo-splash-screen',
  'expo-status-bar',
  'expo-updates',
] as const;

export const LICENCE_SECTIONS: readonly LicenceSection[] = [
  {
    id: 'data',
    title: 'licences.sectionData',
    entries: [
      {
        id: 'osm',
        name: 'OpenStreetMap',
        licence: 'ODbL 1.0',
        url: 'https://www.openstreetmap.org/copyright',
        what: 'licences.osm.what',
        credit: 'licences.osm.credit',
      },
      { id: 'protomaps', name: 'Protomaps basemap', licence: 'ODbL 1.0 (data), BSD (code)', url: 'https://protomaps.com', what: 'licences.protomaps.what' },
      {
        id: 'metno',
        name: 'MET Norway Locationforecast',
        licence: 'CC BY 4.0',
        url: 'https://api.met.no/doc/License',
        what: 'licences.met.what',
        credit: 'licences.met.credit',
      },
      { id: 'noaa', name: 'NOAA solar equations', licence: 'Public domain', url: 'https://gml.noaa.gov/grad/solcalc/calcdetails.html', what: 'licences.noaa.what' },
    ],
  },
  {
    id: 'fonts',
    title: 'licences.sectionFonts',
    entries: [
      { id: 'inter', name: 'Inter', licence: 'SIL OFL 1.1', url: 'https://openfontlicense.org', what: 'licences.inter.what', packages: ['@expo-google-fonts/inter'] },
      { id: 'spacegrotesk', name: 'Space Grotesk', licence: 'SIL OFL 1.1', url: 'https://openfontlicense.org', what: 'licences.spaceGrotesk.what', packages: ['@expo-google-fonts/space-grotesk'] },
      { id: 'ionicons', name: 'Ionicons (@expo/vector-icons)', licence: 'MIT', url: 'https://github.com/ionic-team/ionicons/blob/main/LICENSE', what: 'licences.ionicons.what', packages: ['@expo/vector-icons'] },
    ],
  },
  {
    id: 'libraries',
    title: 'licences.sectionLibraries',
    entries: [
      { id: 'expo', name: 'Expo SDK', licence: 'MIT', url: 'https://github.com/expo/expo/blob/main/LICENSE', what: 'licences.expo.what', packages: EXPO_MODULES },
      { id: 'react', name: 'React', licence: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE', packages: ['react', 'react-dom'] },
      { id: 'react-native', name: 'React Native', licence: 'MIT', url: 'https://github.com/facebook/react-native/blob/main/LICENSE', packages: ['react-native'] },
      { id: 'maps', name: 'react-native-maps', licence: 'MIT', url: 'https://github.com/react-native-maps/react-native-maps/blob/master/LICENSE', packages: ['react-native-maps'] },
      { id: 'safearea', name: 'react-native-safe-area-context', licence: 'MIT', packages: ['react-native-safe-area-context'] },
      { id: 'screens', name: 'react-native-screens', licence: 'MIT', packages: ['react-native-screens'] },
      { id: 'svg', name: 'react-native-svg', licence: 'MIT', packages: ['react-native-svg'] },
      { id: 'iap', name: 'expo-iap', licence: 'MIT', url: 'https://github.com/hyochan/expo-iap/blob/main/LICENSE', packages: ['expo-iap'] },
      { id: 'asyncstorage', name: 'Async Storage', licence: 'MIT', packages: ['@react-native-async-storage/async-storage'] },
      { id: 'datetimepicker', name: 'DateTimePicker', licence: 'MIT', packages: ['@react-native-community/datetimepicker'] },
    ],
  },
  {
    id: 'platform',
    title: 'licences.sectionPlatform',
    entries: [
      { id: 'systemmap', name: 'Apple Maps', licence: 'Apple terms', what: 'licences.systemMap.what' },
      { id: 'updates', name: 'Expo updates', licence: 'Expo terms', what: 'licences.updates.what' },
    ],
  },
  {
    id: 'content',
    title: 'licences.sectionContent',
    entries: [
      { id: 'emergency', name: 'Emergency numbers', licence: 'Satchel', what: 'licences.content.emergency' },
      { id: 'samples', name: 'Sample trip and map points', licence: 'Satchel', what: 'licences.content.samples' },
      { id: 'art', name: 'App icon and art', licence: 'Satchel', what: 'licences.content.art' },
    ],
  },
];

/**
 * T76: a short plain-words summary of each licence family the list uses (catalogue keys, general guidance and not
 * legal advice). Licences without one (vendor terms, Satchel's own) show just their name.
 */
export const LICENCE_SUMMARIES: Readonly<Record<string, string>> = {
  MIT: 'f88.licences.summary.mit',
  'SIL OFL 1.1': 'f88.licences.summary.ofl',
  'ODbL 1.0': 'f88.licences.summary.odbl',
  'ODbL 1.0 (data), BSD (code)': 'f88.licences.summary.odblBsd',
  'CC BY 4.0': 'f88.licences.summary.ccby',
  'Public domain': 'f88.licences.summary.pd',
};

/** The summary key for an entry's licence, or null. */
export const summaryKey = (e: Pick<LicenceEntry, 'licence'>): string | null => LICENCE_SUMMARIES[e.licence] ?? null;

/** Every npm package the list covers. */
export const coveredPackages = (): string[] => LICENCE_SECTIONS.flatMap((s) => s.entries.flatMap((e) => [...(e.packages ?? [])]));

/** Every catalogue key the list refers to (section titles, what, credit). */
export const licenceKeys = (): string[] =>
  LICENCE_SECTIONS.flatMap((s) => [s.title, ...s.entries.flatMap((e) => [e.what, e.credit, summaryKey(e)].filter((k): k is string => !!k))]);
