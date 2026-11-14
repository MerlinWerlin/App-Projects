// T170 Today timetable (owner, 14 Nov: "a today like schedule sorta like a school day but pretty with a tomorrow as
// well but like an option to check each day"). One trip day at a time as a timetable: Today / Tomorrow at the top,
// the day strip across the whole trip below it, then the day as a vertical timeline (time column, rail, blocks sized
// by length, free time as dashed gaps, Now and Next highlighted) and tonight's stay. Swipe sideways for the next or
// previous day. Times are each booking's own wall clock; a block in another zone names its city. Offline; logic in
// src/core/dayview.ts. A trip with nothing on it shows "Add your itinerary" with the ways to bring it in.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, ScrollView, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayStrip, daySchedule, openingDay, todayTomorrow, tripToday } from '../../src/core/dayview.ts';
import { formatDay, formatDuration, formatTime, zoneCity } from '../../src/core/format.ts';
import type { Trip } from '../../src/core/model.ts';
import { addDays } from '../../src/core/tz.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { elevated, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { IconBadge } from '../../src/ui/hero.tsx';
import { Body, Button, EmptyState, PressableScale, Screen } from '../../src/ui/kit.tsx';
import { DayStrip, FreeRow, lookKey, TimetableBlock } from '../../src/ui/timetable.tsx';
import { useMinute } from '../../src/ui/TripPass.tsx';

function DayPage({ trip, date, now, width }: { trip: Trip; date: string; now: number; width: number }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => daySchedule(trip, date, now), [trip, date, now]);
  const today = tripToday(trip, now);
  const rel = date === today ? t('today.heading.today') : date === addDays(today, 1) ? t('today.heading.tomorrow') : date === addDays(today, -1) ? t('today.heading.yesterday') : '';
  const live = s.blocks.find((b) => b.state === 'now');
  const next = s.blocks.find((b) => b.state === 'next');
  const blocks = s.rows.filter((r) => r.type === 'block');
  const lastKey = blocks.length ? blocks[blocks.length - 1].key : '';
  const onlyFree = s.rows.length === 1 && s.rows[0].type === 'free' && s.rows[0].where === 'day';
  return (
    <ScrollView style={{ width }} contentContainerStyle={{ paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
      {/* Day heading */}
      <View accessible accessibilityRole="header" style={{ gap: 2 }}>
        {rel ? <Text style={[typeScale.caption, { color: theme.accentInk }]}>{rel}</Text> : null}
        <Text style={[typeScale.displayM, { color: theme.ink }]}>{formatDay(date, lang)}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>
          {[s.dayNumber ? t('today.dayOf', { n: s.dayNumber, total: s.totalDays }) : t('today.outside'), t('today.zoneTime', { city: zoneCity(s.zone) })].join(' · ')}
        </Text>
      </View>

      {/* Now / Next at a glance */}
      {live || next ? (
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {live ? (
            <View accessible style={[elevated(theme, 'low'), { flex: 1, borderRadius: radius.m, padding: space.m, gap: 2, borderWidth: 2, borderColor: theme.accentStrong }]}>
              <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t('today.nowUntil', { time: formatTime((live.end ?? live.start).local) })}</Text>
              <Text style={[typeScale.bodyStrong, { color: theme.ink }]} numberOfLines={2}>
                {live.item.title || t(lookKey(live.look))}
              </Text>
            </View>
          ) : null}
          {next ? (
            <View accessible style={[elevated(theme, 'low'), { flex: 1, borderRadius: radius.m, padding: space.m, gap: 2 }]}>
              <Text style={[typeScale.caption, { color: theme.sea }]}>{t('today.nextIn', { in: formatDuration(Math.max(0, (next.startUtc - now) / 60_000)) })}</Text>
              <Text style={[typeScale.bodyStrong, { color: theme.ink }]} numberOfLines={2}>
                {next.item.title || t(lookKey(next.look))}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* The timetable */}
      {onlyFree ? (
        <View style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, gap: space.s, alignItems: 'flex-start' }]}>
          <IconBadge name="sunny" tone="ok" size="l" />
          <Text style={[typeScale.title, { color: theme.ink }]}>{t('today.free.day')}</Text>
          <Body muted>{t('today.free.dayBody')}</Body>
        </View>
      ) : (
        <View>
          {s.rows.map((r) =>
            r.type === 'block' ? (
              <TimetableBlock key={r.key} b={r} last={r.key === lastKey} onPress={() => router.push(`/item/${r.item.id}`)} />
            ) : (
              <FreeRow key={r.key} f={r} />
            ),
          )}
        </View>
      )}

      {/* Tonight */}
      {s.tonight ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t('today.tonight')}. ${t('today.tonightAt', { name: s.tonight.place?.name || s.tonight.title })}`}
          accessibilityHint={t('today.tonightHint')}
          onPress={() => router.push(`/item/${s.tonight!.id}`)}
          style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m }]}
        >
          <IconBadge name="moon" tone="sea" />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.caption, { color: theme.sea }]}>{t('today.tonight')}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('today.tonightAt', { name: s.tonight.place?.name || s.tonight.title })}</Text>
            {s.tonight.place?.address ? <Text style={[typeScale.small, { color: theme.muted }]}>{s.tonight.place.address}</Text> : null}
          </View>
        </PressableScale>
      ) : null}

      <Button
        label={t('today.addToDay')}
        hint={t('today.addToDayHint')}
        kind="quiet"
        icon="add"
        onPress={() => router.push({ pathname: '/itinerary', params: { tripId: trip.id, day: date } })}
      />
    </ScrollView>
  );
}

export default function TodayScreen() {
  const { tripId, day: dayParam } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const { t, theme, lang, reduceMotion } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const now = useMinute();
  const trip = trips.find((x) => x.id === tripId);
  const strip = useMemo(() => (trip ? dayStrip(trip, now) : []), [trip, now]);
  const dates = useMemo(() => strip.map((d) => d.date), [strip]);
  const [selected, setSelected] = useState<string | null>(typeof dayParam === 'string' && dayParam ? dayParam : null);
  const current = selected && dates.includes(selected) ? selected : trip ? openingDay(trip, now) : '';
  const index = Math.max(0, dates.indexOf(current));
  const pager = useRef<FlatList<string>>(null);
  const tt = trip ? todayTomorrow(trip, now) : null;

  const go = useCallback(
    (date: string) => {
      setSelected(date);
      const i = dates.indexOf(date);
      if (i >= 0) pager.current?.scrollToIndex({ index: i, animated: !reduceMotion });
    },
    [dates, reduceMotion],
  );

  const onSwipe = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    const d = dates[i];
    if (d && d !== current) {
      setSelected(d);
      AccessibilityInfo.announceForAccessibility(formatDay(d, lang));
    }
  };

  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('today.route')} body={t('today.notFound')} />
      </Screen>
    );
  }

  if (!trip.items.length) {
    return (
      <>
        <Stack.Screen options={{ title: trip.name }} />
        <Screen>
          <EmptyState
            art="notebook"
            title={t('today.empty.title')}
            body={t('today.empty.body')}
            action={
              <View style={{ gap: space.s, alignSelf: 'stretch' }}>
                <Button label={t('today.import')} hint={t('today.importHint')} icon="download-outline" onPress={() => router.push({ pathname: '/itinerary', params: { tripId: trip.id } })} />
                <Button
                  label={t('itin.manual')}
                  hint={t('itin.manualHint')}
                  kind="quiet"
                  icon="add"
                  onPress={() => router.push({ pathname: '/item-edit', params: { tripId: trip.id, kind: 'activity', date: trip.startDate } })}
                />
              </View>
            }
          />
        </Screen>
      </>
    );
  }

  const quick: { label: string; date: string | null }[] = [
    { label: strip.some((d) => d.today) ? t('today.tab.today') : t('today.tab.firstDay'), date: tt?.today ?? null },
    { label: t('today.tab.tomorrow'), date: tt?.tomorrow ?? null },
  ];

  return (
    <>
      <Stack.Screen options={{ title: trip.name }} />
      <View style={{ flex: 1, backgroundColor: theme.paper }}>
        {/* Today / Tomorrow */}
        <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l, paddingTop: space.m }} accessibilityRole="tablist">
          {quick.map((q) => {
            const on = !!q.date && q.date === current;
            return (
              <PressableScale
                key={q.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled: !q.date }}
                accessibilityLabel={q.label}
                accessibilityHint={t('today.tabHint')}
                disabled={!q.date}
                onPress={() => q.date && go(q.date)}
                style={{
                  flex: 1,
                  minHeight: TOUCH,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? theme.ink : theme.card,
                  borderWidth: 1,
                  borderColor: on ? theme.ink : theme.line,
                  opacity: q.date ? 1 : 0.45,
                }}
              >
                <Text style={[typeScale.bodyStrong, { color: on ? theme.paper : theme.ink }]}>{q.label}</Text>
              </PressableScale>
            );
          })}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('today.import')}
            accessibilityHint={t('today.importHint')}
            onPress={() => router.push({ pathname: '/itinerary', params: { tripId: trip.id, day: current } })}
            style={{ width: TOUCH, minHeight: TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentStrong }}
          >
            <Text style={[typeScale.title, { color: theme.onAccent }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              +
            </Text>
          </PressableScale>
        </View>
        {/* Every day of the trip */}
        <View style={{ paddingVertical: space.m }}>
          <DayStrip days={strip} selected={current} onPick={go} />
        </View>
        {/* One page per day, swipe between them */}
        <FlatList
          ref={pager}
          data={dates}
          keyExtractor={(d) => d}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onSwipe}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          extraData={now}
          renderItem={({ item: date }) => <DayPage trip={trip} date={date} now={now} width={width} />}
        />
      </View>
    </>
  );
}
