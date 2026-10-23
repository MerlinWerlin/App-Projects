// English strings for the `tips` namespace (merged into src/i18n/locales/en.ts).
// Add keys here first, then the same paths to every sibling locale file (docs/I18N.md).
export const en = {
  intro: 'Short notes on how Glaze works with iOS. Tips appear next to the feature they explain; hide any you don’t need and bring them back here.',
  showAll: 'Show all tips again',
  showAllDone: 'All tips will show again',
  allShowing: 'All tips are already showing',
  hidden: 'Hidden',
  showing: 'Showing',
  showAgain: 'Show again',
  hide: 'Hide',
  toggleA11y: '{action}: {tip}',
  rowA11y: '{title}. {body} Shows on {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    one: '{count} hidden tip will show again',
    other: '{count} hidden tips will show again',
  },
  groups: {
    start: 'Getting started',
    themes: 'Themes',
    wallpaper: 'Photos and wallpapers',
    icons: 'Icons, shapes and overrides',
    install: 'Installing icons',
    live: 'Live Lock Screen',
  },
  places: {
    firstRun: 'Themes tab',
    themes: 'Theme preview',
    wallpaper: 'Wallpaper maker',
    icons: 'Icons tab',
    install: 'Install icons',
    live: 'Live Lock tab',
    shapes: 'Icon shape settings',
    override: 'Icons tab',
    addApp: 'Icons tab',
  },
  items: {
    iconsAdded: {
      title: 'Icons are added, not replaced',
      body: 'iOS does not let any app change another app’s icon. Glaze adds a themed shortcut that opens the real app; move the originals to the App Library.',
    },
    bulkInstall: {
      title: 'Install every icon at once',
      body: 'Glaze puts your whole set in one profile, so you install once in Settings instead of making a shortcut per app.',
    },
    liveLock: {
      title: 'Make your Lock Screen move',
      body: 'Loop your own video or GIF on the Lock Screen from the Live Lock tab.',
    },
    themePick: {
      title: 'Start from a theme',
      body: 'Open a theme to preview its wallpaper and icons together. You can still change the shape, colours or any single icon afterwards.',
    },
    photoBackground: {
      title: 'Use your own photo',
      body: 'Glaze can’t set wallpapers itself. Save the result to Photos, then choose it in Settings › Wallpaper.',
    },
    wallpaperSave: {
      title: 'Applying a saved wallpaper',
      body: 'In Settings › Wallpaper, tap Add New Wallpaper and pick the image from Photos. It is already sized for your iPhone, so no zooming is needed.',
    },
    iconShapes: {
      title: 'How shapes look on iPhone',
      body: 'iOS shows added icons inside its own rounded square. Circle and blob shapes sit on a background colour inside that square.',
    },
    iconOverride: {
      title: 'Use your own image for one icon',
      body: 'An override changes one app’s icon in this theme, or in all themes if you choose. Restore brings back the theme icon and keeps your image.',
    },
    missingApp: {
      title: 'App not in the list?',
      body: 'Glaze can’t see which apps are installed, so it uses a catalogue. Add your own app and image, made here or in any image tool.',
    },
    installNotVerified: {
      title: '“Not Verified” is expected',
      body: 'The profile is made on your phone and isn’t signed, so Settings shows Not Verified. It only adds Home Screen icons.',
    },
    liveLoop: {
      title: 'Where loops really move',
      body: 'On iOS 26 the full Glaze build loops on the Lock Screen; on older iOS a Live Photo plays when you long-press. Expo Go shows a preview only.',
    },
  },
} as const;
