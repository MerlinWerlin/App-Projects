/**
 * First-launch language line (release standard 1): "Language: English · Change" above the remote, first
 * session only (src/core/languageHint.ts). Small and in the page flow, so it never covers a control.
 * "Change" opens Settings with the language picker already open. The language shows by its own name
 * (nativeName). The row follows the layout direction, so it mirrors in Arabic like the rest of the app.
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { localeInfo } from '../i18n/locales';
import { useLocale, useT } from '../i18n/react';
import { useLanguageHint } from '../state/languageHint';
import { fonts } from '../theme/tokens';
import { Text } from './Text';

export function LanguageHint({ ink }: { ink: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { visible, dismiss } = useLanguageHint();
  if (!visible) return null;
  const language = localeInfo(locale).nativeName;
  return (
    <View style={styles.row}>
      <Text scaleRole="meta" style={[styles.text, { color: ink }]}>
        {t('ui.languageHint.current', { language })}
      </Text>
      <Text scaleRole="meta" style={[styles.text, { color: ink }]} importantForAccessibility="no" accessibilityElementsHidden>
        ·
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.languageHint.changeLabel')}
        accessibilityHint={t('ui.languageHint.changeHint')}
        hitSlop={12}
        onPress={() => {
          dismiss();
          router.push({ pathname: '/settings', params: { open: 'language' } });
        }}
        style={styles.change}
      >
        <Text scaleRole="meta" style={[styles.text, styles.link, { color: ink }]}>
          {t('ui.languageHint.change')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6 },
  text: { fontFamily: fonts.text, fontSize: 13 },
  change: { minHeight: 32, justifyContent: 'center' },
  link: { fontFamily: fonts.textSemi, textDecorationLine: 'underline' },
});
