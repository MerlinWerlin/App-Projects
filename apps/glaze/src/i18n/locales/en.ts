// English catalogue: the source of truth. Its shape defines `Messages` and the valid `t()` keys
// (src/i18n/catalogue.ts). Add a string here first, then to every other locale file.
// Leaves are strings with `{placeholders}`, or plural messages { zero?, one?, two?, few?, many?, other }
// selected by `params.count`. Never use a plural category name (zero/one/two/few/many/other) as a
// namespace or key name. See docs/I18N.md.

import { PET_COPY } from '../pets.ts';
import { en as commonNs } from '../ns/common/en.ts';
import { en as tabsNs } from '../ns/tabs/en.ts';
import { en as settingsNs } from '../ns/settings/en.ts';
import { en as themesNs } from '../ns/themes/en.ts';
import { en as themeNs } from '../ns/theme/en.ts';
import { en as themeUiNs } from '../ns/themeUi/en.ts';
import { en as iconsNs } from '../ns/icons/en.ts';
import { en as addAppNs } from '../ns/addApp/en.ts';
import { en as installNs } from '../ns/install/en.ts';
import { en as iconsUiNs } from '../ns/iconsUi/en.ts';
import { en as liveNs } from '../ns/live/en.ts';
import { en as wallpaperNs } from '../ns/wallpaper/en.ts';
import { en as liveUiNs } from '../ns/liveUi/en.ts';
import { en as tipsNs } from '../ns/tips/en.ts';
import { en as feedbackNs } from '../ns/feedback/en.ts';
import { en as uiNs } from '../ns/ui/en.ts';
import { en as plusNs } from '../ns/plus/en.ts';
import { en as widgetsNs } from '../ns/widgets/en.ts';

export const en = {
  pets: PET_COPY.en,
  common: { ...commonNs,
    ok: 'OK',
    cancel: 'Cancel',
    close: 'Close',
    done: 'Done',
    save: 'Save',
    delete: 'Delete',
    retry: 'Try again',
    loading: 'Loading…',
    back: 'Back',
    next: 'Next',
    continue: 'Continue',
    learnMore: 'Learn more',
    share: 'Share',
    edit: 'Edit',
    reset: 'Reset',
    on: 'On',
    off: 'Off',
    yes: 'Yes',
    no: 'No',
    later: 'Later',
    restartNow: 'Restart now',
    showAll: 'Show all',
    error: 'Something went wrong',
    itemCount: { zero: 'No items', one: '{count} item', other: '{count} items' },
  },
  tabs: { ...tabsNs,
    themes: 'Themes',
    icons: 'Icons',
    live: 'Live',
    settings: 'Settings',
  },
  settings: { ...settingsNs,
    language: {
      title: 'Language',
      row: 'App language',
      pickerHint: 'Opens the list of languages',
      note: 'Languages other than English are machine translations awaiting review by native speakers.',
      systemDefault: 'System default',
      systemDefaultHint: 'Follows your phone ({language})',
      pseudo: 'Pseudo (testing)',
      sheetTitle: 'Choose language',
      hintLine: 'Language: {language}',
      change: 'Change',
      restartTitle: 'Restart Glaze?',
      restartBody: 'Glaze needs to restart to switch between left-to-right and right-to-left layout.',
      restartManual: 'Close Glaze and open it again to finish switching the layout direction.',
    },
  },
  // Namespaces below are owned by the screen migrations; stack titles live here already.
  themes: { ...themesNs },
  icons: { ...iconsNs },
  install: { ...installNs, title: 'Install icons' },
  live: { ...liveNs, editTitle: 'Edit loop' },
  theme: { ...themeNs, title: 'Theme' },
  wallpaper: { ...wallpaperNs, title: 'Wallpaper' },
  tips: { ...tipsNs, title: 'Tips' },
  feedback: { ...feedbackNs, title: 'Send feedback' },
  addApp: { ...addAppNs, title: 'Missing an app?' },
  ui: { ...uiNs },
  themeUi: { ...themeUiNs },
  iconsUi: { ...iconsUiNs },
  liveUi: { ...liveUiNs },
  plus: { ...plusNs },
  widgets: { ...widgetsNs },
} as const;
