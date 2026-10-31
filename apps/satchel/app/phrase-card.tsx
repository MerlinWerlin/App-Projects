// T56 full-screen phrase card to show someone: high contrast (ink on card, both themes), the local text in the
// largest type the line allows (Dynamic Type scales it further; the card scrolls so nothing is cut), the English
// above it and, for non-Latin scripts, how to say it. Previous / Next step through the phrases with a timed fade;
// Close sits at the bottom for one-handed use. The screen stays awake while the card is open (expo-keep-awake, as
// on the ticket view). Params: ?phrase= (default "toilet") and ?lang= (default from the trip, see src/ui/phrases.ts).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardFontSize, parseLangParam, parsePhraseParam, PHRASE_IDS, phraseCard, type PhraseId } from '../src/core/phrases.ts';
import { useScreenAwake } from '../src/native/keepAwake.ts';
import { useApp } from '../src/state/app.tsx';
import { duration, fadeIn, fadeOut } from '../src/theme/motion.ts';
import { radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { Body, Button, PressableScale } from '../src/ui/kit.tsx';
import { LANG_KEY, PHRASE_TABLE, usePhraseLang } from '../src/ui/phrases.ts';

export default function PhraseCardScreen() {
  const params = useLocalSearchParams<{ lang?: string; phrase?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = usePhraseLang(parseLangParam(params.lang));
  const [id, setId] = useState<PhraseId>(() => parsePhraseParam(params.phrase) ?? 'toilet');
  const card = useMemo(() => phraseCard(PHRASE_TABLE, lang, id), [lang, id]);
  const fade = useRef(new Animated.Value(1)).current;
  useScreenAwake('satchel-phrase');

  const index = PHRASE_IDS.indexOf(id);
  const step = (by: number) => {
    const next = PHRASE_IDS[(index + by + PHRASE_IDS.length) % PHRASE_IDS.length];
    fadeOut(fade, reduceMotion).start(() => {
      setId(next);
      fadeIn(fade, reduceMotion, duration.base).start();
    });
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/phrases'));
  const language = t(LANG_KEY[lang]);
  const size = card ? cardFontSize(card.text) : 32;

  const label = (s: string) => <Text style={[typeScale.caption, { fontSize: 13, color: theme.muted }]}>{s}</Text>;
  const stepButton = (by: number, icon: 'chevron-back' | 'chevron-forward', a11y: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => step(by)}
      style={{ width: TOUCH + space.s, height: TOUCH + space.s, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={24} color={theme.ink} />
    </PressableScale>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          {label(language)}
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('phrases.card.showThis')}
          </Text>
        </View>
        {card ? (
          <Animated.View style={{ opacity: fade, gap: space.xl, flexGrow: 1, justifyContent: 'center' }}>
            <View style={{ gap: space.xs }}>
              {label(t('phrases.card.english'))}
              <Text style={[typeScale.title, { color: theme.ink }]}>{card.english}</Text>
            </View>
            <Text
              selectable
              accessibilityLanguage={card.lang}
              maxFontSizeMultiplier={1.6}
              style={{ fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: '700', color: theme.ink }}
            >
              {card.text}
            </Text>
            {card.roman ? (
              <View style={{ gap: space.xs }}>
                {label(t('phrases.card.sayIt'))}
                <Text selectable style={{ fontSize: 22, lineHeight: 30, fontStyle: 'italic', color: theme.ink }}>
                  {card.roman}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        ) : (
          <Body>{t('phrases.card.missing')}</Body>
        )}
      </ScrollView>
      <View style={{ gap: space.m, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: insets.bottom + space.l, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {stepButton(-1, 'chevron-back', t('phrases.card.prev'))}
          <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>
            {t('phrases.card.position', { n: index + 1, total: PHRASE_IDS.length })}
          </Text>
          {stepButton(1, 'chevron-forward', t('phrases.card.next'))}
        </View>
        <Button label={t('phrases.card.close')} hint={t('phrases.card.closeHint')} onPress={close} />
      </View>
    </View>
  );
}
