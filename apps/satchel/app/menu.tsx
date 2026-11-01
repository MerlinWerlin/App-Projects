// T110 "Menu helper": an offline food-word dictionary for reading menus (src/content/menu.json) in ten languages.
// Pick a language (defaults to the trip's country like the phrase cards), search in English or the local word /
// its romanisation (accent, width and kana insensitive), and see what a food usually contains (pork, shellfish, nuts,
// alcohol...). "My diet" (kept on this phone) marks the words to watch for and can hide the rest. Tap a word for a
// big-text card to show staff (app/menu-card.tsx). Optional ?lang=. General guidance only, labelled as such.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIET_IDS, MENU_LANGS, parseMenuLangParam, searchMenu, toggleDiet, watchedFlags, type DietId, type MenuFlag, type MenuLang, type MenuWord } from '../src/core/menu.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { fadeIn } from '../src/theme/motion.ts';
import { radius, shadowOf, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionHeader } from '../src/ui/hero.tsx';
import { Body, Button, Chip, PressableScale, TextField, ToggleRow, Warning } from '../src/ui/kit.tsx';
import { MENU_TABLE, useMenuDiet, useMenuLang } from '../src/ui/menu.ts';
import { LANG_KEY, PHRASE_TABLE } from '../src/ui/phrases.ts';

const DIET_KEY = (d: DietId) => `menu.diet.${d}` as Key;
const FLAG_KEY = (f: MenuFlag) => `menu.flag.${f}` as Key;

export default function MenuScreen() {
  const params = useLocalSearchParams<{ lang?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, from, setLang } = useMenuLang(parseMenuLangParam(params.lang));
  const [diets, setDiets] = useMenuDiet();
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [onlyWatch, setOnlyWatch] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const watching = useMemo(() => watchedFlags(diets), [diets]);
  const filterOn = onlyWatch && watching.length > 0;
  const words = useMemo(() => searchMenu(MENU_TABLE, lang, query, { diets, onlyWatch: filterOn }), [lang, query, diets, filterOn]);
  const total = useMemo(() => searchMenu(MENU_TABLE, lang, '').length, [lang]);

  const sep = t('menu.listSeparator');
  const flagList = (fs: MenuFlag[]) => fs.map((f) => t(FLAG_KEY(f))).join(sep);
  const languageName = (l: MenuLang) => t(LANG_KEY[l]);
  const native = (l: MenuLang) => PHRASE_TABLE.languages.find((x) => x.code === l)?.native ?? l;

  const choose = (l: MenuLang) => {
    if (l === lang) return;
    setLang(l);
    fade.setValue(0);
    fadeIn(fade, reduceMotion).start();
  };

  const header = (
    <View style={{ gap: space.l, marginBottom: space.m }}>
      <FadeInView>
        <HeroHeader tone="wallet" illustration="none" title={t('menu.heroTitle')} subtitle={t('menu.subtitle')} />
      </FadeInView>
      <Warning text={t('menu.guidance')} />

      <View style={{ gap: space.s }}>
        <SectionHeader title={t('menu.language')} icon="language-outline" tone="sea" />
        <View accessibilityRole="radiogroup" accessibilityLabel={t('menu.language')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {MENU_LANGS.map((l) => (
            <Chip key={l} label={t('menu.langOption', { native: native(l), english: languageName(l) })} selected={l === lang} onPress={() => choose(l)} />
          ))}
        </View>
        {from === 'trip' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="airplane" size={14} color={theme.muted} />
            </View>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('menu.langFromTrip')}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: space.s }}>
        <SectionHeader title={t('menu.diet')} icon="nutrition-outline" tone="warn" />
        <Body muted={!watching.length}>{watching.length ? t('menu.dietSummary', { list: flagList(watching) }) : t('menu.dietNone')}</Body>
        <Button
          kind="quiet"
          icon={pickerOpen ? 'checkmark' : 'options-outline'}
          label={pickerOpen ? t('menu.dietDone') : diets.length ? t('menu.dietChange') : t('menu.dietChoose')}
          hint={pickerOpen ? t('menu.dietDoneHint') : t('menu.dietChooseHint')}
          onPress={() => setPickerOpen(!pickerOpen)}
        />
        {pickerOpen ? (
          <View accessibilityLabel={t('menu.dietPicker')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {DIET_IDS.map((d) => {
              const on = diets.includes(d);
              return (
                <PressableScale
                  key={d}
                  accessibilityRole="checkbox"
                  accessibilityLabel={t(DIET_KEY(d))}
                  accessibilityState={{ checked: on }}
                  onPress={() => setDiets((old) => toggleDiet(old, d))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.xs,
                    minHeight: TOUCH,
                    paddingHorizontal: space.l,
                    borderRadius: radius.pill,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? theme.accent : theme.line,
                    backgroundColor: on ? theme.accentSoft : theme.cardRaised,
                  }}
                >
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? theme.accentInk : theme.muted} />
                  </View>
                  <Text style={[typeScale.bodyStrong, { color: on ? theme.accentInk : theme.ink }]}>{t(DIET_KEY(d))}</Text>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        {watching.length ? <ToggleRow label={t('menu.onlyWatch')} hint={t('menu.onlyWatchHint')} value={onlyWatch} onChange={setOnlyWatch} /> : null}
      </View>

      <View style={{ gap: space.s }}>
        <SectionHeader title={t('menu.words')} icon="restaurant-outline" tone="accent" />
        <TextField label={t('menu.search')} value={query} onChange={setQuery} placeholder={t('menu.searchPlaceholder')} autoCapitalize="none" />
        <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
          {words.length === total ? t('menu.count', { n: total }) : t('menu.countFiltered', { n: words.length, total })}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item: w }: { item: MenuWord }) => {
    const watch = w.watch.length > 0;
    const specific = w.flags.some((f) => f === 'pork' || f === 'beef' || f === 'poultry');
    const others = w.flags.filter((f) => !w.watch.includes(f) && !(f === 'meat' && specific));
    const a11yFlags = [watch ? t('menu.watch', { list: flagList(w.watch) }) : '', w.flags.length ? t('menu.contains', { list: flagList(w.flags) }) : ''].filter(Boolean).join('. ');
    return (
      <Animated.View style={{ opacity: fade, marginBottom: space.s }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('menu.rowA11y', { english: w.en, local: w.text, flags: a11yFlags })}
          accessibilityHint={t('menu.rowHint')}
          onPress={() => router.push({ pathname: '/menu-card', params: { lang, word: w.id } })}
          style={[
            {
              minHeight: TOUCH,
              gap: space.s,
              padding: space.l,
              borderRadius: radius.l,
              backgroundColor: theme.cardRaised,
              borderWidth: watch ? 1.5 : theme.dark ? 1 : 0,
              borderColor: watch ? theme.danger : theme.line,
            },
            shadowOf(theme, 'low'),
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typeScale.small, { color: theme.muted }]}>{w.en}</Text>
              <Text accessibilityLanguage={lang} style={{ fontSize: 22, lineHeight: 30, fontWeight: '700', color: theme.ink }}>
                {w.text}
              </Text>
              {w.roman ? <Text style={[typeScale.small, { color: theme.muted, fontStyle: 'italic' }]}>{w.roman}</Text> : null}
            </View>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={watch ? 'alert-circle' : 'expand-outline'} size={22} color={watch ? theme.danger : theme.accentInk} />
            </View>
          </View>
          {w.watch.length || others.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {w.watch.map((f) => (
                <View key={f} style={{ paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: theme.dangerSoft }}>
                  <Text style={[typeScale.small, { color: theme.danger, fontWeight: '700' }]}>{t(FLAG_KEY(f))}</Text>
                </View>
              ))}
              {others.map((f) => (
                <View key={f} style={{ paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}>
                  <Text style={[typeScale.small, { color: theme.ink }]}>{t(FLAG_KEY(f))}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </PressableScale>
      </Animated.View>
    );
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l }}
      data={words}
      keyExtractor={(w) => `${lang}:${w.id}`}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={<Body muted>{filterOn && !query.trim() ? t('menu.emptyWatch') : t('menu.empty', { q: query.trim() })}</Body>}
      ListFooterComponent={<Text style={[typeScale.small, { color: theme.muted, marginTop: space.l }]}>{t('menu.unchecked')}</Text>}
      initialNumToRender={10}
    />
  );
}
