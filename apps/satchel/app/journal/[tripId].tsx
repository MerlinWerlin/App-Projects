// Trip journal (T64): the trip's pages grouped by trip day, each day under a colourful gradient header ("Day 3",
// date, page and photo counts), each page with its mood and weather, saved place, note and a strip of up to six
// photos. Write a page (today where the traveller is, else the trip's first / last day) or add one to a given day.
// Free, offline; photos are Satchel's own copies and never uploaded. Exports carry the text only (journal.exportNote).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../../src/core/format.ts';
import { defaultJournalDay, entryPlace, groupJournal, journalStats, type JournalDay, type JournalEntry } from '../../src/core/journal.ts';
import type { Trip } from '../../src/core/model.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, shadowOf, space, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, HeroHeader } from '../../src/ui/hero.tsx';
import { DAY_TONES, DayHeader, MOOD_ICONS, moodKey, PhotoThumb, WEATHER_ICONS, weatherKey } from '../../src/ui/journal.tsx';
import { Body, Button, EmptyState, PressableScale, Screen } from '../../src/ui/kit.tsx';

const THUMB = 76;

export default function JournalScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('journal.title')} body={t('journal.notFound')} />
      </Screen>
    );
  }
  return <Journal trip={trip} />;
}

function Journal({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const days = useMemo(() => groupJournal(trip, DAY_TONES.length), [trip]);
  const stats = useMemo(() => journalStats(trip), [trip]);
  const count = useCallback((one: Key, many: Key, n: number) => (n === 1 ? t(one) : t(many, { n })), [t]);

  const write = useCallback(
    (day: string, entryId = '') => router.push({ pathname: '/journal-edit', params: { tripId: trip.id, entryId, day } }),
    [router, trip.id],
  );

  const renderDay = useCallback(
    ({ item }: { item: JournalDay }) => {
      const date = formatDay(item.day, lang);
      const label = item.dayNumber != null ? t('journal.day', { n: item.dayNumber }) : t('journal.dayOutside');
      const meta = [count('journal.pagesOne', 'journal.pagesMany', item.entries.length), item.photoCount ? count('journal.photosOne', 'journal.photosMany', item.photoCount) : null]
        .filter(Boolean)
        .join(' · ');
      return (
        <FadeInView style={{ gap: space.s }}>
          <DayHeader tone={item.tone} label={label} date={date} meta={meta} />
          {item.entries.map((e) => (
            <EntryCard key={e.id} trip={trip} entry={e} date={date} onPress={() => write(e.day, e.id)} />
          ))}
          <Button label={t('journal.addToDay', { day: date })} hint={t('journal.addToDayHint')} kind="quiet" icon="add" onPress={() => write(item.day)} />
        </FadeInView>
      );
    },
    [lang, t, count, trip, write],
  );

  const subtitle = stats.entries
    ? t('journal.stats', {
        pages: count('journal.pagesOne', 'journal.pagesMany', stats.entries),
        days: count('journal.daysOne', 'journal.daysMany', stats.days),
        photos: count('journal.photosOne', 'journal.photosMany', stats.photos),
      })
    : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t('journal.forTrip', { trip: trip.name }) }} />
      <FlatList
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}
        data={days}
        keyExtractor={(d) => d.day}
        renderItem={renderDay}
        ListHeaderComponent={
          <View style={{ gap: space.m }}>
            <HeroHeader tone="map" title={t('journal.title')} eyebrow={trip.name} subtitle={subtitle} illustration="map" compact />
            {days.length === 0 ? (
              <EmptyState art="notebook" title={t('journal.empty.title')} body={t('journal.empty.body')} />
            ) : null}
            <Button label={t('journal.add')} hint={t('journal.addHint')} icon="create-outline" onPress={() => write(defaultJournalDay(trip))} />
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: space.s, marginTop: space.s }}>
            <Body muted>{t('journal.offline')}</Body>
            <Body muted>{t('journal.exportNote')}</Body>
          </View>
        }
      />
    </>
  );
}

const EntryCard = memo(function EntryCard({ trip, entry, date, onPress }: { trip: Trip; entry: JournalEntry; date: string; onPress: () => void }) {
  const { t, theme } = useApp();
  const place = entryPlace(trip, entry);
  const chips = [
    entry.mood ? { icon: MOOD_ICONS[entry.mood], label: t(moodKey(entry.mood)) } : null,
    entry.weather ? { icon: WEATHER_ICONS[entry.weather], label: t(weatherKey(entry.weather)) } : null,
  ].filter((c): c is { icon: (typeof MOOD_ICONS)[keyof typeof MOOD_ICONS]; label: string } => c !== null);
  const summary = [chips.map((c) => c.label).join(', '), place ? t('journal.entry.place', { name: place.name }) : '', entry.note || t('journal.entry.noNote'), entry.photos.length ? (entry.photos.length === 1 ? t('journal.photosOne') : t('journal.photosMany', { n: entry.photos.length })) : '']
    .filter(Boolean)
    .join('. ');
  return (
    <View style={[{ backgroundColor: theme.cardRaised, borderRadius: radius.l, borderWidth: theme.dark ? 1 : 0, borderColor: theme.line, overflow: 'hidden' }, shadowOf(theme, 'low')]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('journal.entry.open', { day: date, summary })}
        accessibilityHint={t('journal.entry.openHint')}
        onPress={onPress}
        style={{ padding: space.l, gap: space.s }}
      >
        {chips.length || place ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {chips.map((c) => (
              <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: theme.seaSoft, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                <Ionicons name={c.icon} size={16} color={theme.sea} />
                <Text style={[typeScale.small, { color: theme.ink }]}>{c.label}</Text>
              </View>
            ))}
            {place ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: theme.tealSoft, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                <Ionicons name="location-outline" size={16} color={theme.teal} />
                <Text numberOfLines={1} style={[typeScale.small, { color: theme.ink, maxWidth: 200 }]}>
                  {place.name}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text numberOfLines={6} style={[typeScale.body, { color: entry.note ? theme.ink : theme.muted }]}>
          {entry.note || t('journal.entry.noNote')}
        </Text>
      </PressableScale>
      {entry.photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, paddingHorizontal: space.l, paddingBottom: space.l }}>
          {entry.photos.map((p, i) => (
            <PhotoThumb key={p.id} photo={p} size={THUMB} label={t('journal.entry.photoA11y', { n: i + 1, total: entry.photos.length })} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
});
