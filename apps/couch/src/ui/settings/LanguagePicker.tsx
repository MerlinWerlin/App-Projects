/**
 * Settings: app language (owner-1016 R3). 'Phone language' follows the phone; otherwise one of the
 * shipped locales, each shown in its own language (nativeName) with the English name as the screen
 * reader hint. Switching between Arabic and the left-to-right languages needs a restart to flip the
 * layout: we confirm with an Alert (in the newly chosen language), then src/native/rtl applyDirection.
 *
 * Design v2 (T68): the drawing moved into app/settings.tsx (an InsetGroupedList value row that opens
 * check rows in place). This hook keeps the choice logic, so the rows stay plain v2 Rows.
 */
import { Alert, I18nManager } from 'react-native';
import type { LanguagePref } from '../../core/prefs';
import { t as translate } from '../../i18n/core';
import { directionPlan } from '../../i18n/direction';
import { LOCALES, localeInfo, resolveLocale, type LocaleCode } from '../../i18n/locales';
import { useT } from '../../i18n/react';
import { applyDirection, syncDirectionOnStart } from '../../native/rtl';
import { deviceLanguageTags } from '../../native/localization';
import { usePrefs } from '../../state/prefs';

function resolvePref(p: LanguagePref): LocaleCode {
  return p === 'system' ? resolveLocale(deviceLanguageTags()) : p;
}

/** Give AsyncStorage a moment to persist the new language before the bundle restarts. */
const PERSIST_MS = 400;

export interface LanguageOption {
  value: LanguagePref;
  /** Shown and spoken: the language in its own script ('Phone language' for system). */
  label: string;
  /** Screen-reader hint: the English name (or which language the phone uses). */
  hint: string;
  /** Visible second line (only for 'Phone language'). */
  subtitle?: string;
}

export function useLanguageChoice(): {
  value: LanguagePref;
  /** The current choice as shown in the row. */
  current: string;
  options: LanguageOption[];
  choose: (language: LanguagePref) => void;
} {
  const t = useT();
  const { prefs, set } = usePrefs();
  const phone = localeInfo(resolveLocale(deviceLanguageTags()));
  const current = prefs.language === 'system' ? t('core.settings.language.system') : localeInfo(prefs.language).nativeName;

  const choose = (language: LanguagePref) => {
    if (language === prefs.language) return;
    const prev = resolvePref(prefs.language);
    const next = resolvePref(language);
    set({ language });
    const plan = directionPlan(prev, next, !!I18nManager.isRTL);
    if (!plan.reload) return;
    // Ask in the language just chosen: that is the one the person can read.
    Alert.alert(
      translate('core.settings.language.restartTitle', undefined, next),
      translate('core.settings.language.restartMessage', { language: localeInfo(next).nativeName }, next),
      [
        {
          text: translate('core.settings.language.restartLater', undefined, next),
          style: 'cancel',
          onPress: () => {
            syncDirectionOnStart(next);
          },
        },
        {
          text: translate('core.settings.language.restartNow', undefined, next),
          onPress: () => {
            setTimeout(() => void applyDirection(next), PERSIST_MS);
          },
        },
      ],
      { cancelable: false },
    );
  };

  const systemHint = t('core.settings.language.systemHint', { language: phone.nativeName });
  const options: LanguageOption[] = [
    { value: 'system', label: t('core.settings.language.system'), hint: systemHint, subtitle: systemHint },
    ...LOCALES.map((l) => ({ value: l.code as LanguagePref, label: l.nativeName, hint: l.englishName })),
  ];

  return { value: prefs.language, current, options, choose };
}
