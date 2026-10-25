// T35 (release standard): one quiet line on the first launch naming the language in use, with Change opening
// Settings > Language. Never a prompt or a blocking screen; it lasts one session and hides at once when tapped.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { languageName } from '../../core/languageHint.ts';
import { useApp } from '../../state/app.tsx';
import { fonts, space, TOUCH } from '../../theme/tokens.ts';
import { PressableScale } from '../kit.tsx';

export function LanguageHintSlot() {
  const { t, theme, lang, languageHint, dismissLanguageHint } = useApp();
  const router = useRouter();
  if (!languageHint) return null;
  const name = languageName(lang);
  const change = () => {
    dismissLanguageHint();
    router.push('/settings');
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>{t('language.hint', { name })} ·</Text>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={t('language.hintChangeA11y', { name })}
        accessibilityHint={t('language.hintChangeHint')}
        onPress={change}
        style={{ minHeight: TOUCH, justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink, textDecorationLine: 'underline' }}>{t('language.hintChange')}</Text>
      </PressableScale>
    </View>
  );
}
