// T144 Sign reader: an offline picture dictionary of common signs (src/content/signs.json) in the 12 phrase
// languages. Search by English or by the text on the sign (typed or pasted; accents, full-width and kana folded, see
// src/core/signs.ts), filter by kind, pick a language (the trip's countries first, then the rest; the default follows
// the phrase screen's rule: ?lang=, trip country, last used, phone zone, Japanese). Each card: an original pictogram,
// the English name and a one-line meaning, the local text in large type, the reading for non-Latin scripts, and the
// "checked by a fluent speaker: not yet" caption on every model-written line. Changing language or kind fades the list
// (timed, motion.ts; instant with Reduce Motion). Params: ?lang=, ?country= (ISO2, put first in the language order).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import data from '../src/content/signs.json';
import { deviceZone, todayIn } from '../src/core/format.ts';
import { focusTrip } from '../src/core/glance.ts';
import { parseLangParam, type PhraseLang } from '../src/core/phrases.ts';
import { searchSigns, SIGN_CATEGORIES, SIGN_IDS, signCard, signCards, signFontSize, signLangOrder, type SignCard, type SignCategory, type SignNames, type SignTable } from '../src/core/signs.ts';
import { tripCountries } from '../src/core/todos.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { fadeIn } from '../src/theme/motion.ts';
import { elevated, radius, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader } from '../src/ui/hero.tsx';
import { Chip, EmptyState, Label, TextField } from '../src/ui/kit.tsx';
import { LANG_KEY, PHRASE_TABLE, usePhraseLang } from '../src/ui/phrases.ts';
import { SignIcon } from '../src/ui/signIcons.tsx';

const TABLE = data as unknown as SignTable;
type Row = { card: SignCard; found: PhraseLang | null };

const SignRow = memo(function SignRow({ row, languageName }: { row: Row; languageName: (l: PhraseLang) => string }) {
  const { t, theme } = useApp();
  const c = row.card;
  const english = t(`signs.sign.${c.id}` as Key);
  const meaning = t(`signs.meaning.${c.id}` as Key);
  const size = c.text ? signFontSize(c.text) : 20;
  const a11y = c.text
    ? t('signs.cardA11y', { english, meaning, language: languageName(c.lang), text: c.roman ?? c.text, check: c.needsCheck ? t('signs.notChecked') : '' })
    : t('signs.cardA11yMissing', { english, meaning, missing: t('signs.missing') });
  return (
    <View accessible accessibilityLabel={a11y} style={[{ padding: space.l, borderRadius: radius.l, gap: space.m, marginBottom: space.s }, elevated(theme, 'low')]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ padding: space.s, borderRadius: radius.m, backgroundColor: theme.paper }}>
          <SignIcon id={c.id} size={56} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{english}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{meaning}</Text>
        </View>
      </View>
      {c.text ? (
        <View style={{ gap: space.xs }}>
          {row.found ? <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t('signs.matchedIn', { language: languageName(row.found) })}</Text> : null}
          <Text selectable accessibilityLanguage={c.lang} maxFontSizeMultiplier={1.6} style={{ fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: '700', color: theme.ink }}>
            {c.text}
          </Text>
          {c.roman ? (
            <Text style={[typeScale.small, { color: theme.muted, fontStyle: 'italic' }]}>
              {t('signs.reading')} {c.roman}
            </Text>
          ) : null}
          {c.needsCheck ? <Text style={[typeScale.small, { fontSize: 12, color: theme.muted }]}>{t('signs.notChecked')}</Text> : null}
        </View>
      ) : (
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('signs.missing')}</Text>
      )}
    </View>
  );
});

export default function SignsScreen() {
  const params = useLocalSearchParams<{ lang?: string; country?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const { lang, setLang } = usePhraseLang(parseLangParam(params.lang));
  const [category, setCategory] = useState<SignCategory | null>(null);
  const [query, setQuery] = useState('');
  const fade = useRef(new Animated.Value(1)).current;

  const order = useMemo(() => {
    const trip = focusTrip(trips, todayIn(deviceZone()));
    const fromParam = typeof params.country === 'string' ? [params.country] : [];
    return signLangOrder(PHRASE_TABLE, [...fromParam, ...(trip ? tripCountries(trip) : [])]);
  }, [trips, params.country]);

  const names = useMemo(() => Object.fromEntries(SIGN_IDS.map((id) => [id, t(`signs.sign.${id}` as Key)])) as SignNames, [t]);
  const rows: Row[] = useMemo(() => {
    if (!query.trim()) return signCards(TABLE, lang, category).map((card) => ({ card, found: null }));
    const langs = [lang, ...order.langs.filter((l) => l !== lang)];
    return searchSigns(TABLE, query, { names, langs, category }).map((h) => {
      const shown = h.lang && h.lang !== lang ? h.lang : lang;
      return { card: signCard(TABLE, shown, h.id), found: shown !== lang ? shown : null };
    });
  }, [query, lang, category, order, names]);

  const refade = () => {
    fade.setValue(reduceMotion ? 1 : 0);
    fadeIn(fade, reduceMotion).start();
  };
  const chooseLang = (l: PhraseLang) => {
    if (l === lang) return;
    setLang(l);
    refade();
  };
  const chooseCategory = (c: SignCategory | null) => {
    if (c === category) return;
    setCategory(c);
    refade();
  };

  const languageName = (l: PhraseLang) => t(LANG_KEY[l]);
  const native = (l: PhraseLang) => PHRASE_TABLE.languages.find((x) => x.code === l)?.native ?? l;

  const header = (
    <View style={{ gap: space.l, marginBottom: space.m }}>
      <FadeInView>
        <HeroHeader tone="wallet" illustration="none" title={t('signs.heroTitle')} subtitle={t('signs.subtitle')} />
      </FadeInView>
      <TextField label={t('signs.search')} value={query} onChange={setQuery} placeholder={t('signs.searchPlaceholder')} autoCapitalize="none" />
      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('signs.language')}</Label>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('signs.language')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {order.langs.map((l) => (
            <Chip key={l} label={t('phrases.langOption', { native: native(l), english: languageName(l) })} selected={l === lang} onPress={() => chooseLang(l)} />
          ))}
        </View>
        {order.tripLangs.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="airplane" size={14} color={theme.muted} />
            </View>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('signs.langFromTrip')}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: space.s }}>
        <View accessibilityRole="header">
          <Label>{t('signs.category')}</Label>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('signs.category')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          <Chip label={t('signs.category.all')} selected={category === null} onPress={() => chooseCategory(null)} />
          {SIGN_CATEGORIES.map((c) => (
            <Chip key={c} label={t(`signs.category.${c}` as Key)} selected={category === c} onPress={() => chooseCategory(c)} />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l }}
      data={rows}
      keyExtractor={(r) => `${r.card.lang}:${r.card.id}`}
      renderItem={({ item }) => (
        <Animated.View style={{ opacity: fade }}>
          <SignRow row={item} languageName={languageName} />
        </Animated.View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState art="magnifier" title={t('signs.noResultsTitle')} body={t('signs.noResultsBody')} />}
      ListFooterComponent={<Text style={[typeScale.small, { color: theme.muted, marginTop: space.l }]}>{t('signs.disclaimer')}</Text>}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={6}
    />
  );
}
