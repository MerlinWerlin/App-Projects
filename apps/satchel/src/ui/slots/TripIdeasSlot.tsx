// Slot on the trip timeline header, owned by T81: Places to go. A card with how many ideas the trip has (and how
// many are planned / been to), the top few, and Add an idea; the card opens the full Ideas screen.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { ideaStats, topIdeas } from '../../core/ideas.ts';
import type { Trip } from '../../core/model.ts';
import { useApp } from '../../state/app.tsx';
import { elevated, radius, space, typeScale } from '../../theme/tokens.ts';
import { IconBadge } from '../hero.tsx';
import { categoryKey, IDEA_ICONS } from '../ideas.tsx';
import { Button, PressableScale } from '../kit.tsx';

export function TripIdeasSlot({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const stats = useMemo(() => ideaStats(trip), [trip]);
  const top = useMemo(() => topIdeas(trip, 3), [trip]);
  const headline = stats.total ? (stats.total === 1 ? t('ideas.countOne') : t('ideas.countMany', { n: stats.total })) : t('ideas.slot.none');
  const detail = stats.total ? [stats.planned ? t('ideas.slot.planned', { n: stats.planned }) : null, stats.done ? t('ideas.slot.been', { n: stats.done }) : null].filter(Boolean).join(' · ') : t('ideas.slot.noneBody');
  const names = top.map((i) => `${i.name} (${t(categoryKey(i.category))})`).join(', ');
  return (
    <View
      style={[
        elevated(theme, 'low'),
        { borderRadius: radius.l, padding: space.l, gap: space.s },
      ]}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('ideas.slot.a11y', { summary: [headline, detail, names].filter(Boolean).join('. ') })}
        accessibilityHint={t('ideas.slot.hint')}
        onPress={() => router.push(`/ideas/${trip.id}`)}
        style={{ gap: space.s }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <IconBadge name="bulb-outline" tone="accent" />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{t('ideas.title')}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{headline}</Text>
          </View>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </View>
        </View>
        {detail ? <Text style={[typeScale.small, { color: theme.muted }]}>{detail}</Text> : null}
        {top.map((i) => (
          <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Ionicons name={i.done ? 'checkmark-circle' : IDEA_ICONS[i.category]} size={18} color={i.done ? theme.ok : theme.sea} />
            <Text numberOfLines={1} style={[typeScale.body, { flex: 1, color: i.done ? theme.muted : theme.ink }]}>
              {i.name}
            </Text>
          </View>
        ))}
      </PressableScale>
      <Button label={t('ideas.add')} hint={t('ideas.addHint')} kind="quiet" icon="add" onPress={() => router.push({ pathname: '/idea-edit', params: { tripId: trip.id } })} />
    </View>
  );
}
