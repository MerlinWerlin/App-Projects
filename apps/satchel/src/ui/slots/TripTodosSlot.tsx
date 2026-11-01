// Slot on the trip timeline header, owned by T93: Trip to-dos. A card with how many to-dos are open (and how many are
// overdue / due soon) and the next one; a tap opens the full To-dos screen. Renders nothing once the trip has ended.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { Trip } from '../../core/model.ts';
import { showReadiness } from '../../core/readiness.ts';
import { todoCounts, todoList } from '../../core/todos.ts';
import { useApp } from '../../state/app.tsx';
import { elevated, radius, space, typeScale } from '../../theme/tokens.ts';
import { IconBadge } from '../hero.tsx';
import { PressableScale } from '../kit.tsx';
import { useMapsOnPhone } from '../ReadinessCard.tsx';
import { todoTitle } from '../todos.tsx';

export function TripTodosSlot({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const maps = useMapsOnPhone();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const list = useMemo(() => todoList(trip, now, { catalog: maps.catalog, installed: maps.installed }), [trip, now, maps]);
  if (!showReadiness(trip, now)) return null;
  const c = todoCounts(list);
  const headline = c.open === 0 ? t('todos.slot.none') : c.open === 1 ? t('todos.slot.openOne') : t('todos.slot.open', { n: c.open });
  const detail = [c.overdue ? t('todos.slot.overdue', { n: c.overdue }) : null, c.soon ? t('todos.slot.soon', { n: c.soon }) : null].filter(Boolean).join(' · ');
  const first = list.open[0];
  const next = first ? t('todos.slot.next', { title: todoTitle(t, first) }) : '';
  const tone = c.overdue ? 'danger' : c.soon ? 'warn' : 'ok';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('todos.slot.a11y', { summary: [headline, detail, next].filter(Boolean).join('. ') })}
      accessibilityHint={t('todos.slot.hint')}
      onPress={() => router.push(`/todos/${trip.id}`)}
      style={[
        elevated(theme, 'low'),
        { borderRadius: radius.l, padding: space.l, gap: space.s },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="checkbox-outline" tone={tone} />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.caption, { color: theme.muted }]}>{t('todos.title')}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{headline}</Text>
        </View>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      </View>
      {detail ? <Text style={[typeScale.small, { color: c.overdue ? theme.danger : theme.warn }]}>{detail}</Text> : null}
      {next ? (
        <Text numberOfLines={1} style={[typeScale.body, { color: theme.ink }]}>
          {next}
        </Text>
      ) : null}
    </PressableScale>
  );
}
