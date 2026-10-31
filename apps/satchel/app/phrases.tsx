// T56 "Show a local": travel phrases in the local language, fully offline (src/content/phrases.json). A language
// picker (defaults to the trip's country, else the last one used, else the phone's zone, else Japanese), then the
// phrases, "Where is the toilet?" first: English over the local text and, for non-Latin scripts, how to say it.
// Tap a phrase for the full-screen card (app/phrase-card.tsx). Optional ?lang= and ?phrase= (opens that card).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseLangParam, parsePhraseParam, phraseCards, type PhraseCard, type PhraseLang, PHRASE_LANGS } from '../src/core/phrases.ts';
import { useApp } from '../src/state/app.tsx';
import { fadeIn } from '../src/theme/motion.ts';
import { radius, shadowOf, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader } from '../src/ui/hero.tsx';
import { Chip, Label, PressableScale } from '../src/ui/kit.tsx';
import { LANG_KEY, PHRASE_TABLE, usePhraseLang } from '../src/ui/phrases.ts';

export default function PhrasesScreen() {
  const params = useLocalSearchParams<{ lang?: string; phrase?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, from, setLang } = usePhraseLang(parseLangParam(params.lang));
  const cards = useMemo(() => phraseCards(PHRASE_TABLE, lang), [lang]);
  const fade = useRef(new Animated.Value(1)).current;

  const open = useCallback((l: PhraseLang, id: string) => router.push({ pathname: '/phrase-card', params: { lang: l, phrase: id } }), [router]);

  // ?phrase= opens that card straight away, once.
  const opened = useRef(false);
  const wanted = parsePhraseParam(params.phrase);
  useEffect(() => {
    if (opened.current || !wanted) return;
    opened.current = true;
    open(lang, wanted);
  }, [wanted, lang, open]);

  const choose = (l: PhraseLang) => {
    if (l === lang) return;
    setLang(l);
    fade.setValue(0);
    fadeIn(fade, reduceMotion).start();
  };

  const languageName = (l: PhraseLang) => t(LANG_KEY[l]);
  const native = (l: PhraseLang) => PHRASE_TABLE.languages.find((x) => x.code === l)?.native ?? l;

  const header = (
    <View style={{ gap: space.l, marginBottom: space.m }}>
      <FadeInView>
        <HeroHeader tone="wallet" illustration="none" title={t('phrases.heroTitle')} subtitle={t('phrases.subtitle')} />
      </FadeInView>
      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('phrases.language')}</Label>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('phrases.language')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {PHRASE_LANGS.map((l) => (
            <Chip key={l} label={t('phrases.langOption', { native: native(l), english: languageName(l) })} selected={l === lang} onPress={() => choose(l)} />
          ))}
        </View>
        {from === 'trip' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="airplane" size={14} color={theme.muted} />
            </View>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('phrases.langFromTrip')}</Text>
          </View>
        ) : null}
      </View>
      <View accessibilityRole="header">
        <Label>{t('phrases.list')}</Label>
      </View>
    </View>
  );

  const renderItem = ({ item: c }: { item: PhraseCard }) => (
    <Animated.View style={{ opacity: fade, marginBottom: space.s }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('phrases.rowA11y', { english: c.english, language: languageName(c.lang) })}
        accessibilityHint={t('phrases.rowHint')}
        onPress={() => open(c.lang, c.id)}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.m,
            padding: space.l,
            borderRadius: radius.l,
            backgroundColor: theme.cardRaised,
            borderWidth: theme.dark ? 1 : 0,
            borderColor: theme.line,
          },
          shadowOf(theme, 'low'),
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.small, { color: theme.muted }]}>{c.english}</Text>
          <Text accessibilityLanguage={c.lang} style={{ fontSize: 22, lineHeight: 30, fontWeight: '700', color: theme.ink }}>
            {c.text}
          </Text>
          {c.roman ? <Text style={[typeScale.small, { color: theme.muted, fontStyle: 'italic' }]}>{c.roman}</Text> : null}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="expand-outline" size={20} color={theme.accentInk} />
        </View>
      </PressableScale>
    </Animated.View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l }}
      data={cards}
      keyExtractor={(c) => `${c.lang}:${c.id}`}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListFooterComponent={<Text style={[typeScale.small, { color: theme.muted, marginTop: space.l }]}>{t('phrases.disclaimer')}</Text>}
      initialNumToRender={8}
    />
  );
}
