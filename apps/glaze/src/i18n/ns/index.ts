// Per-namespace catalogue pieces, one folder per namespace so screen migrations never edit the
// same file. Merged into src/i18n/locales/<locale>.ts (deep merge, namespace file wins).
import type { LocaleMessages } from '../catalogue.ts';

import { es as common_es, fr as common_fr, de as common_de, it as common_it, ptBR as common_ptBR, ja as common_ja, ko as common_ko, zhHans as common_zhHans, hi as common_hi, ar as common_ar } from './common/index.ts';
import { es as tabs_es, fr as tabs_fr, de as tabs_de, it as tabs_it, ptBR as tabs_ptBR, ja as tabs_ja, ko as tabs_ko, zhHans as tabs_zhHans, hi as tabs_hi, ar as tabs_ar } from './tabs/index.ts';
import { es as settings_es, fr as settings_fr, de as settings_de, it as settings_it, ptBR as settings_ptBR, ja as settings_ja, ko as settings_ko, zhHans as settings_zhHans, hi as settings_hi, ar as settings_ar } from './settings/index.ts';
import { es as themes_es, fr as themes_fr, de as themes_de, it as themes_it, ptBR as themes_ptBR, ja as themes_ja, ko as themes_ko, zhHans as themes_zhHans, hi as themes_hi, ar as themes_ar } from './themes/index.ts';
import { es as theme_es, fr as theme_fr, de as theme_de, it as theme_it, ptBR as theme_ptBR, ja as theme_ja, ko as theme_ko, zhHans as theme_zhHans, hi as theme_hi, ar as theme_ar } from './theme/index.ts';
import { es as themeUi_es, fr as themeUi_fr, de as themeUi_de, it as themeUi_it, ptBR as themeUi_ptBR, ja as themeUi_ja, ko as themeUi_ko, zhHans as themeUi_zhHans, hi as themeUi_hi, ar as themeUi_ar } from './themeUi/index.ts';
import { es as icons_es, fr as icons_fr, de as icons_de, it as icons_it, ptBR as icons_ptBR, ja as icons_ja, ko as icons_ko, zhHans as icons_zhHans, hi as icons_hi, ar as icons_ar } from './icons/index.ts';
import { es as addApp_es, fr as addApp_fr, de as addApp_de, it as addApp_it, ptBR as addApp_ptBR, ja as addApp_ja, ko as addApp_ko, zhHans as addApp_zhHans, hi as addApp_hi, ar as addApp_ar } from './addApp/index.ts';
import { es as install_es, fr as install_fr, de as install_de, it as install_it, ptBR as install_ptBR, ja as install_ja, ko as install_ko, zhHans as install_zhHans, hi as install_hi, ar as install_ar } from './install/index.ts';
import { es as iconsUi_es, fr as iconsUi_fr, de as iconsUi_de, it as iconsUi_it, ptBR as iconsUi_ptBR, ja as iconsUi_ja, ko as iconsUi_ko, zhHans as iconsUi_zhHans, hi as iconsUi_hi, ar as iconsUi_ar } from './iconsUi/index.ts';
import { es as live_es, fr as live_fr, de as live_de, it as live_it, ptBR as live_ptBR, ja as live_ja, ko as live_ko, zhHans as live_zhHans, hi as live_hi, ar as live_ar } from './live/index.ts';
import { es as wallpaper_es, fr as wallpaper_fr, de as wallpaper_de, it as wallpaper_it, ptBR as wallpaper_ptBR, ja as wallpaper_ja, ko as wallpaper_ko, zhHans as wallpaper_zhHans, hi as wallpaper_hi, ar as wallpaper_ar } from './wallpaper/index.ts';
import { es as liveUi_es, fr as liveUi_fr, de as liveUi_de, it as liveUi_it, ptBR as liveUi_ptBR, ja as liveUi_ja, ko as liveUi_ko, zhHans as liveUi_zhHans, hi as liveUi_hi, ar as liveUi_ar } from './liveUi/index.ts';
import { es as tips_es, fr as tips_fr, de as tips_de, it as tips_it, ptBR as tips_ptBR, ja as tips_ja, ko as tips_ko, zhHans as tips_zhHans, hi as tips_hi, ar as tips_ar } from './tips/index.ts';
import { es as feedback_es, fr as feedback_fr, de as feedback_de, it as feedback_it, ptBR as feedback_ptBR, ja as feedback_ja, ko as feedback_ko, zhHans as feedback_zhHans, hi as feedback_hi, ar as feedback_ar } from './feedback/index.ts';
import { es as ui_es, fr as ui_fr, de as ui_de, it as ui_it, ptBR as ui_ptBR, ja as ui_ja, ko as ui_ko, zhHans as ui_zhHans, hi as ui_hi, ar as ui_ar } from './ui/index.ts';
import { es as plus_es, fr as plus_fr, de as plus_de, it as plus_it, ptBR as plus_ptBR, ja as plus_ja, ko as plus_ko, zhHans as plus_zhHans, hi as plus_hi, ar as plus_ar } from './plus/index.ts';
import { es as widgets_es, fr as widgets_fr, de as widgets_de, it as widgets_it, ptBR as widgets_ptBR, ja as widgets_ja, ko as widgets_ko, zhHans as widgets_zhHans, hi as widgets_hi, ar as widgets_ar } from './widgets/index.ts';

type TranslatedLocale = 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-Hans' | 'hi' | 'ar';
/** Namespace pieces by locale. */
export const NS_TRANSLATIONS: Readonly<Record<TranslatedLocale, LocaleMessages>> = {
  'es': { common: common_es, tabs: tabs_es, settings: settings_es, themes: themes_es, theme: theme_es, themeUi: themeUi_es, icons: icons_es, addApp: addApp_es, install: install_es, iconsUi: iconsUi_es, live: live_es, wallpaper: wallpaper_es, liveUi: liveUi_es, tips: tips_es, feedback: feedback_es, ui: ui_es, plus: plus_es, widgets: widgets_es } as LocaleMessages,
  'fr': { common: common_fr, tabs: tabs_fr, settings: settings_fr, themes: themes_fr, theme: theme_fr, themeUi: themeUi_fr, icons: icons_fr, addApp: addApp_fr, install: install_fr, iconsUi: iconsUi_fr, live: live_fr, wallpaper: wallpaper_fr, liveUi: liveUi_fr, tips: tips_fr, feedback: feedback_fr, ui: ui_fr, plus: plus_fr, widgets: widgets_fr } as LocaleMessages,
  'de': { common: common_de, tabs: tabs_de, settings: settings_de, themes: themes_de, theme: theme_de, themeUi: themeUi_de, icons: icons_de, addApp: addApp_de, install: install_de, iconsUi: iconsUi_de, live: live_de, wallpaper: wallpaper_de, liveUi: liveUi_de, tips: tips_de, feedback: feedback_de, ui: ui_de, plus: plus_de, widgets: widgets_de } as LocaleMessages,
  'it': { common: common_it, tabs: tabs_it, settings: settings_it, themes: themes_it, theme: theme_it, themeUi: themeUi_it, icons: icons_it, addApp: addApp_it, install: install_it, iconsUi: iconsUi_it, live: live_it, wallpaper: wallpaper_it, liveUi: liveUi_it, tips: tips_it, feedback: feedback_it, ui: ui_it, plus: plus_it, widgets: widgets_it } as LocaleMessages,
  'pt-BR': { common: common_ptBR, tabs: tabs_ptBR, settings: settings_ptBR, themes: themes_ptBR, theme: theme_ptBR, themeUi: themeUi_ptBR, icons: icons_ptBR, addApp: addApp_ptBR, install: install_ptBR, iconsUi: iconsUi_ptBR, live: live_ptBR, wallpaper: wallpaper_ptBR, liveUi: liveUi_ptBR, tips: tips_ptBR, feedback: feedback_ptBR, ui: ui_ptBR, plus: plus_ptBR, widgets: widgets_ptBR } as LocaleMessages,
  'ja': { common: common_ja, tabs: tabs_ja, settings: settings_ja, themes: themes_ja, theme: theme_ja, themeUi: themeUi_ja, icons: icons_ja, addApp: addApp_ja, install: install_ja, iconsUi: iconsUi_ja, live: live_ja, wallpaper: wallpaper_ja, liveUi: liveUi_ja, tips: tips_ja, feedback: feedback_ja, ui: ui_ja, plus: plus_ja, widgets: widgets_ja } as LocaleMessages,
  'ko': { common: common_ko, tabs: tabs_ko, settings: settings_ko, themes: themes_ko, theme: theme_ko, themeUi: themeUi_ko, icons: icons_ko, addApp: addApp_ko, install: install_ko, iconsUi: iconsUi_ko, live: live_ko, wallpaper: wallpaper_ko, liveUi: liveUi_ko, tips: tips_ko, feedback: feedback_ko, ui: ui_ko, plus: plus_ko, widgets: widgets_ko } as LocaleMessages,
  'zh-Hans': { common: common_zhHans, tabs: tabs_zhHans, settings: settings_zhHans, themes: themes_zhHans, theme: theme_zhHans, themeUi: themeUi_zhHans, icons: icons_zhHans, addApp: addApp_zhHans, install: install_zhHans, iconsUi: iconsUi_zhHans, live: live_zhHans, wallpaper: wallpaper_zhHans, liveUi: liveUi_zhHans, tips: tips_zhHans, feedback: feedback_zhHans, ui: ui_zhHans, plus: plus_zhHans, widgets: widgets_zhHans } as LocaleMessages,
  'hi': { common: common_hi, tabs: tabs_hi, settings: settings_hi, themes: themes_hi, theme: theme_hi, themeUi: themeUi_hi, icons: icons_hi, addApp: addApp_hi, install: install_hi, iconsUi: iconsUi_hi, live: live_hi, wallpaper: wallpaper_hi, liveUi: liveUi_hi, tips: tips_hi, feedback: feedback_hi, ui: ui_hi, plus: plus_hi, widgets: widgets_hi } as LocaleMessages,
  'ar': { common: common_ar, tabs: tabs_ar, settings: settings_ar, themes: themes_ar, theme: theme_ar, themeUi: themeUi_ar, icons: icons_ar, addApp: addApp_ar, install: install_ar, iconsUi: iconsUi_ar, live: live_ar, wallpaper: wallpaper_ar, liveUi: liveUi_ar, tips: tips_ar, feedback: feedback_ar, ui: ui_ar, plus: plus_ar, widgets: widgets_ar } as LocaleMessages,
};

type Tree = { [k: string]: unknown };
const isObj = (x: unknown): x is Tree => !!x && typeof x === 'object' && !Array.isArray(x);

/** Deep merge: `extra` adds to / overrides `base`. Plural messages are leaves only if `extra` replaces them whole. */
export function mergeCatalogue<T extends object>(base: T, extra: object): T {
  const out: Tree = { ...(base as Tree) };
  for (const [k, v] of Object.entries(extra as Tree)) {
    out[k] = isObj(v) && isObj(out[k]) ? mergeCatalogue(out[k] as Tree, v) : v;
  }
  return out as T;
}
