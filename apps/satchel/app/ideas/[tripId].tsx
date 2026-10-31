// Places to go (T81): the trip's ideas, Unplanned first and then by planned day, with category filter chips (All,
// Eat, See, Do, Shop, Other). Each row ticks Been there (then offers a journal page for that day), opens the idea to
// edit or plan it, and opens its link when that is a web address. Free and offline; ideas travel in trip files.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../../src/core/format.ts';
import { categoryCounts, groupIdeas, ideaStats, type Idea, type IdeaFilter, type IdeaGroup } from '../../src/core/ideas.ts';
import type { Trip } from '../../src/core/model.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { space, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, HeroHeader } from '../../src/ui/hero.tsx';
import { categoryKey, CategoryFilter, IdeaRow, useBeenThere, useOpenLink } from '../../src/ui/ideas.tsx';
import { Body, Button, EmptyState, Screen } from '../../src/ui/kit.tsx';

type Row = { kind: 'head'; key: string; group: IdeaGroup } | { kind: 'idea'; key: string; idea: Idea };

export default function IdeasScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState title={t('ideas.title')} body={t('ideas.notFound')} />
      </Screen>
    );
  }
  return <Ideas trip={trip} />;
}

function Ideas({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<IdeaFilter>('all');
  const groups = useMemo(() => groupIdeas(trip, filter), [trip, filter]);
  const stats = useMemo(() => ideaStats(trip), [trip]);
  const counts = useMemo(() => categoryCounts(trip), [trip]);
  const rows = useMemo<Row[]>(() => groups.flatMap((g): Row[] => [{ kind: 'head', key: `h:${g.key}`, group: g }, ...g.ideas.map((idea): Row => ({ kind: 'idea', key: idea.id, idea }))]), [groups]);
  const toggle = useBeenThere(trip);
  const { open: openLink, failed } = useOpenLink();

  const add = useCallback(
    () => router.push({ pathname: '/idea-edit', params: { tripId: trip.id, category: filter === 'all' ? '' : filter } }),
    [router, trip.id, filter],
  );
  const openIdea = useCallback((idea: Idea) => router.push({ pathname: '/idea-edit', params: { tripId: trip.id, ideaId: idea.id } }), [router, trip.id]);

  const groupLabel = useCallback(
    (g: IdeaGroup) => {
      if (!g.day) return t('ideas.group.unplanned');
      const date = formatDay(g.day, lang);
      return g.dayNumber != null ? t('ideas.group.day', { n: g.dayNumber, date }) : t('ideas.group.outside', { date });
    },
    [t, lang],
  );

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'head') {
        const n = item.group.ideas.length;
        const label = groupLabel(item.group);
        const count = n === 1 ? t('ideas.countOne') : t('ideas.countMany', { n });
        return (
          <View accessible accessibilityRole="header" accessibilityLabel={`${label}. ${count}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s, marginTop: space.m }}>
            <Text style={[typeScale.title, { flex: 1, color: theme.ink }]}>{label}</Text>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{count}</Text>
          </View>
        );
      }
      return (
        <FadeInView>
          <IdeaRow idea={item.idea} dayLabel={null} onOpen={openIdea} onToggle={toggle} onLink={openLink} linkFailed={failed === item.idea.id} />
        </FadeInView>
      );
    },
    [groupLabel, t, theme, openIdea, toggle, openLink, failed],
  );

  const subtitle = stats.total
    ? [stats.total === 1 ? t('ideas.countOne') : t('ideas.countMany', { n: stats.total }), stats.planned ? t('ideas.slot.planned', { n: stats.planned }) : null, stats.done ? t('ideas.slot.been', { n: stats.done }) : null]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t('ideas.forTrip', { trip: trip.name }) }} />
      <FlatList
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.s }}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        extraData={failed}
        initialNumToRender={16}
        ListHeaderComponent={
          <View style={{ gap: space.m }}>
            <HeroHeader tone="map" title={t('ideas.title')} eyebrow={trip.name} subtitle={subtitle} illustration="map" compact />
            {stats.total ? <CategoryFilter value={filter} counts={counts} total={stats.total} onChange={setFilter} /> : null}
            {stats.total === 0 ? <EmptyState icon="bulb-outline" title={t('ideas.empty.title')} body={t('ideas.empty.body')} /> : null}
            {stats.total > 0 && rows.length === 0 && filter !== 'all' ? <Body muted>{t('ideas.empty.filtered', { cat: t(categoryKey(filter)) })}</Body> : null}
            <Button label={t('ideas.add')} hint={t('ideas.addHint')} icon="add" onPress={add} />
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: space.s, marginTop: space.m }}>
            <Body muted>{t('ideas.planNote')}</Body>
            <Body muted>{t('ideas.offline')}</Body>
          </View>
        }
      />
    </>
  );
}
