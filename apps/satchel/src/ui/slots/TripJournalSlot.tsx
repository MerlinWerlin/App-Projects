// Slot on the trip timeline header, owned by T64: the trip journal. While the trip is on (in the zone the traveller
// is in) it is a "Today's page" prompt on a warm gradient that opens today's page (new or existing); otherwise a
// card with the journal's page / day / photo counts that opens the Journal screen.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { entriesOn, journalStats, journalToday, showTodayPrompt } from '../../core/journal.ts';
import type { Trip } from '../../core/model.ts';
import { useApp } from '../../state/app.tsx';
import { elevated, radius, shadowOf, space, typeScale } from '../../theme/tokens.ts';
import { FadeInView, GradientFill, IconBadge } from '../hero.tsx';
import { PressableScale } from '../kit.tsx';

export function TripJournalSlot({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const stats = useMemo(() => journalStats(trip), [trip]);
  const today = journalToday(trip);
  const during = showTodayPrompt(trip);
  const todays = useMemo(() => entriesOn(trip, today), [trip, today]);
  const count = (one: Parameters<typeof t>[0], many: Parameters<typeof t>[0], n: number) => (n === 1 ? t(one) : t(many, { n }));
  const summaryLine = t('journal.stats', {
    pages: count('journal.pagesOne', 'journal.pagesMany', stats.entries),
    days: count('journal.daysOne', 'journal.daysMany', stats.days),
    photos: count('journal.photosOne', 'journal.photosMany', stats.photos),
  });
  const openJournal = () => router.push(`/journal/${trip.id}`);

  if (during) {
    const first = todays[0];
    const body = first ? t('journal.today.written') : t('journal.today.prompt');
    const action = first ? t('journal.today.continue') : t('journal.today.write');
    const openToday = () => router.push({ pathname: '/journal-edit', params: { tripId: trip.id, entryId: first?.id ?? '', day: today } });
    return (
      <FadeInView style={{ gap: space.s }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('journal.today.a11y', { summary: `${body} ${action}` })}
          accessibilityHint={t('journal.today.hint')}
          onPress={openToday}
          style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.wallet[0] }, shadowOf(theme, 'low')]}
        >
          <GradientFill tone="wallet" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={first ? 'book' : 'create-outline'} size={22} color={theme.heroAccent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('journal.today.title')}</Text>
              <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{body}</Text>
              <Text style={[typeScale.small, { fontFamily: typeScale.bodyStrong.fontFamily, color: theme.heroMuted }]}>{action}</Text>
            </View>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Ionicons name="chevron-forward" size={18} color={theme.heroMuted} />
            </View>
          </View>
        </PressableScale>
        {stats.entries ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('journal.slot.a11y', { summary: summaryLine })}
            accessibilityHint={t('journal.slot.hint')}
            onPress={openJournal}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.s }}
          >
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Ionicons name="journal-outline" size={18} color={theme.sea} />
            </View>
            <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.sea }]}>{`${t('journal.slot.title')} · ${summaryLine}`}</Text>
          </PressableScale>
        ) : null}
      </FadeInView>
    );
  }

  const headline = stats.entries ? summaryLine : t('journal.slot.none');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('journal.slot.a11y', { summary: stats.entries ? summaryLine : `${t('journal.slot.none')}. ${t('journal.slot.noneBody')}` })}
      accessibilityHint={t('journal.slot.hint')}
      onPress={openJournal}
      style={[
        elevated(theme, 'low'),
        { borderRadius: radius.l, padding: space.l, gap: space.s },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="journal-outline" tone="teal" />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.caption, { color: theme.muted }]}>{t('journal.slot.title')}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{headline}</Text>
        </View>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      </View>
      {stats.entries ? null : <Text style={[typeScale.small, { color: theme.muted }]}>{t('journal.slot.noneBody')}</Text>}
    </PressableScale>
  );
}
