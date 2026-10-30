// Settings › Language (docs/I18N.md): one self-contained section with a row that opens a sheet
// listing "System default", every language in its own name and, in development, the pseudo-locale.
// Switching between LTR and RTL asks to restart, because I18nManager only applies on reload.
// Design v2 (T56): an InsetGroup with one chevron row; the sheet lists choices as an inset list.
// LanguagePickerSheet is exported for the first-launch line on Themes (src/ui/LanguageHintLine.tsx).
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { resolveLocale, scriptOf } from '../core/i18n';
import {
  LOCALE_NAMES,
  PSEUDO_LOCALE,
  SHIPPING_LOCALES,
  applyDirection,
  deviceLocaleTags,
  setLocaleOverride,
  t as tNow,
  useT,
  type Locale,
} from '../i18n';
import { continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { InsetGroup, InsetRow } from './InsetGroup';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';

type Choice = { value: Locale | null; label: string; detail?: string; lang?: Locale };

/** Ask to restart after a direction change (LTR ↔ RTL), in the newly chosen language. */
function confirmRestart(locale: Locale): void {
  Alert.alert(tNow('settings.language.restartTitle'), tNow('settings.language.restartBody'), [
    {
      text: tNow('common.later'),
      style: 'cancel',
      onPress: () => {
        applyDirection(locale, false).catch(() => {});
      },
    },
    {
      text: tNow('common.restartNow'),
      onPress: () => {
        applyDirection(locale, true)
          .then((r) => {
            if (r === 'restart-needed') Alert.alert(tNow('settings.language.restartTitle'), tNow('settings.language.restartManual'));
          })
          .catch(() => {});
      },
    },
  ]);
}

/** The language list sheet: Settings › Language and the first-launch line on Themes both open it. */
export function LanguagePickerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useColorsV2();
  const { t, override, script } = useT();
  const choices = useLanguageChoices();

  const choose = async (next: Locale | null) => {
    onClose();
    if (next === override) return;
    haptic('select');
    const { locale, needsRestart } = await setLocaleOverride(next);
    if (needsRestart) confirmRestart(locale);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.language.sheetTitle')}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.language.sheetTitle')}
        style={[styles.list, continuous, { backgroundColor: c.surface }]}
      >
        {choices.map((ch, i) => {
          const selected = ch.value === override;
          const own = ch.lang ? textStyleFor(scriptOf(ch.lang), textV2.body) : textStyleFor(script, textV2.body);
          return (
            <PressableScale
              key={ch.value ?? 'system'}
              onPress={() => {
                choose(ch.value).catch(() => {});
              }}
              pressedScale={0.98}
              accessibilityRole="radio"
              accessibilityLabel={ch.detail ? t('settings.languageChoiceA11y', { language: ch.label, detail: ch.detail }) : ch.label}
              accessibilityLanguage={ch.lang}
              accessibilityState={{ selected, checked: selected }}
              style={[
                styles.option,
                i > 0 ? { borderTopColor: c.separator, borderTopWidth: StyleSheet.hairlineWidth } : null,
                selected ? { backgroundColor: c.tintSoft } : null,
              ]}
            >
              <View style={styles.flex}>
                <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[textV2.body, own, { color: selected ? c.onTintSoft : c.ink }]}>{ch.label}</Text>
                {ch.detail ? (
                  <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: selected ? c.onTintSoft : c.inkSecondary }]}>
                    {ch.detail}
                  </Text>
                ) : null}
              </View>
              {selected ? <Feather name="check" size={20} color={c.onTintSoft} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

/** "System default", every shipping language in its own name and, in development, the pseudo-locale. */
function useLanguageChoices(): Choice[] {
  const { t } = useT();
  const systemLocale = resolveLocale(deviceLocaleTags(), null);
  return [
    {
      value: null,
      label: t('settings.language.systemDefault'),
      detail: t('settings.language.systemDefaultHint', { language: LOCALE_NAMES[systemLocale] }),
    },
    ...SHIPPING_LOCALES.map((l): Choice => ({ value: l, label: LOCALE_NAMES[l], lang: l })),
    ...(__DEV__ ? [{ value: PSEUDO_LOCALE, label: t('settings.language.pseudo') } as Choice] : []),
  ];
}

export function LanguageSection() {
  const { t, override } = useT();
  const [open, setOpen] = useState(false);
  const choices = useLanguageChoices();
  const currentLabel = choices.find((ch) => ch.value === override)?.label ?? t('settings.language.systemDefault');

  return (
    <>
      <InsetGroup title={t('settings.language.title')} footer={t('settings.language.note')}>
        <InsetRow
          icon="globe"
          iconTone="sky"
          title={t('settings.language.row')}
          value={currentLabel}
          onPress={() => setOpen(true)}
          accessibilityLabel={t('settings.languageRowA11y', { language: currentLabel })}
          accessibilityHint={t('settings.language.pickerHint')}
        />
      </InsetGroup>

      <LanguagePickerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spaceV2.xxs },
  list: { borderRadius: radiusV2.group, overflow: 'hidden' },
  option: {
    minHeight: sizeV2.rowMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm + spaceV2.xxs,
  },
});
