// T110 full-screen menu word to show staff, like the phrase card (app/phrase-card.tsx): high contrast, the local word
// in the largest type it allows (Dynamic Type scales it further; the card scrolls), the English above it, how to say
// it for non-Latin scripts, and what it usually contains (the flags your diet watches for first). The screen stays
// awake while it is open. Params: ?lang= and ?word= (an id from src/content/menu.json).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuWord, parseMenuLangParam, type MenuFlag } from '../src/core/menu.ts';
import { cardFontSize } from '../src/core/phrases.ts';
import type { Key } from '../src/i18n/en.ts';
import { useScreenAwake } from '../src/native/keepAwake.ts';
import { useApp } from '../src/state/app.tsx';
import { radius, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView } from '../src/ui/hero.tsx';
import { Body, Button } from '../src/ui/kit.tsx';
import { MENU_TABLE, useMenuDiet, useMenuLang } from '../src/ui/menu.ts';
import { LANG_KEY } from '../src/ui/phrases.ts';

const FLAG_KEY = (f: MenuFlag) => `menu.flag.${f}` as Key;
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

export default function MenuCardScreen() {
  const params = useLocalSearchParams<{ lang?: string; word?: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useMenuLang(parseMenuLangParam(params.lang));
  const [diets] = useMenuDiet();
  const id = first(params.word);
  const word = useMemo(() => menuWord(MENU_TABLE, lang, id, diets), [lang, id, diets]);
  useScreenAwake('satchel-menu-word');
  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/menu', params: { lang } }));
  const size = word ? cardFontSize(word.text) : 32;
  const sep = t('menu.listSeparator');
  const label = (s: string) => <Text style={[typeScale.caption, { fontSize: 13, color: theme.muted }]}>{s}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          {label(t(LANG_KEY[lang]))}
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('menu.card.showThis')}
          </Text>
        </View>
        {word ? (
          <FadeInView style={{ gap: space.xl, flexGrow: 1, justifyContent: 'center' }}>
            <View style={{ gap: space.xs }}>
              {label(t('menu.card.english'))}
              <Text style={[typeScale.title, { color: theme.ink }]}>{word.en}</Text>
            </View>
            <Text
              selectable
              accessibilityLanguage={lang}
              maxFontSizeMultiplier={1.6}
              style={{ fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: '700', color: theme.ink }}
            >
              {word.text}
            </Text>
            {word.roman ? (
              <View style={{ gap: space.xs }}>
                {label(t('menu.card.sayIt'))}
                <Text selectable style={{ fontSize: 22, lineHeight: 30, fontStyle: 'italic', color: theme.ink }}>
                  {word.roman}
                </Text>
              </View>
            ) : null}
            {word.watch.length ? (
              <View
                accessible
                accessibilityLabel={t('menu.watch', { list: word.watch.map((f) => t(FLAG_KEY(f))).join(sep) })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.dangerSoft }}
              >
                <Ionicons name="alert-circle" size={22} color={theme.danger} />
                <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.danger }]}>{t('menu.watch', { list: word.watch.map((f) => t(FLAG_KEY(f))).join(sep) })}</Text>
              </View>
            ) : null}
            {word.flags.length ? <Body muted>{t('menu.contains', { list: word.flags.map((f) => t(FLAG_KEY(f))).join(sep) })}</Body> : null}
          </FadeInView>
        ) : (
          <Body>{t('menu.card.missing')}</Body>
        )}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('menu.guidance')}</Text>
      </ScrollView>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: insets.bottom + space.l, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.card }}>
        <Button label={t('menu.card.close')} hint={t('menu.card.closeHint')} onPress={close} />
      </View>
    </View>
  );
}
