// First-launch language line (docs/RELEASE_STANDARD.md §1): "Language: English · Change" under the Themes
// title in the very first session only. Non-blocking; tapping it opens the language sheet and hides it for
// good (rules in src/core/languageHint.ts, storage in src/store/languageHint.ts). Language also stays in
// Settings › Language.
// T173 (premium UI, onboarding slice): Dynamic Type cap on the line (footnote role).
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { LOCALE_NAMES, useT } from '../i18n';
import { dismissLanguageHint, useLanguageHint } from '../store/languageHint';
import { fontScaleCap, sizeV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { LanguagePickerSheet } from './LanguageSection';
import { PressableScale } from './PressableScale';

export function LanguageHintLine() {
  const { c } = useColorsV2();
  const { t, locale, script } = useT();
  const show = useLanguageHint();
  const [open, setOpen] = useState(false);
  const line = t('settings.language.hintLine', { language: LOCALE_NAMES[locale] });
  const type = [textV2.footnote, textStyleFor(script, textV2.footnote)];

  return (
    <>
      {show ? (
        <PressableScale
          onPress={() => {
            haptic('select');
            dismissLanguageHint();
            setOpen(true);
          }}
          pressedScale={0.98}
          accessibilityRole="button"
          accessibilityLabel={line}
          accessibilityHint={t('settings.language.pickerHint')}
          style={styles.row}
        >
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type, { color: c.inkSecondary }]}>
            {line}
            {' · '}{/* i18n-ignore */}
            <Text style={[styles.change, { color: c.tint }]}>{t('settings.language.change')}</Text>
          </Text>
        </PressableScale>
      ) : null}
      <LanguagePickerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: sizeV2.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  change: { fontWeight: '600' },
});
