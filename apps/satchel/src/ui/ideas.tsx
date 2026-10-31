// Shared pieces of "Places to go" (T81): category icons and names, the category filter chips, an idea row (Been
// there tick, open, link), the timeline's light "Planned" rows, and the Been there flow (tick, then offer a journal
// page for that day; never creates one by itself). Colours from theme tokens only; motion is the kit's timed press
// scale and FadeInView (no springs).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { AccessibilityInfo, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { formatDay } from '../core/format.ts';
import { canMoveIdea, IDEA_CATEGORIES, ideaSpot, ideasOn, ideaJournalDay, moveIdea, setIdeaDone, webLink, type Idea, type IdeaCategory, type IdeaFilter } from '../core/ideas.ts';
import { entriesOn } from '../core/journal.ts';
import type { Trip } from '../core/model.ts';
import type { Key } from '../i18n/en.ts';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { useTrips } from '../state/trips.tsx';
import { radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import type { IconName, Tone } from './hero.tsx';
import { IconBadge } from './hero.tsx';
import { Chip, PressableScale } from './kit.tsx';

export const IDEA_ICONS: Record<IdeaCategory, IconName> = {
  eat: 'restaurant-outline',
  see: 'eye-outline',
  do: 'bicycle-outline',
  shop: 'bag-handle-outline',
  other: 'star-outline',
};
export const IDEA_TONES: Record<IdeaCategory, Tone> = { eat: 'accent', see: 'sea', do: 'teal', shop: 'warn', other: 'ink' };
export const categoryKey = (c: IdeaCategory): Key => `ideas.cat.${c}`;
export const CATEGORIES = IDEA_CATEGORIES;

/** All / Eat / See / Do / Shop / Other chips with counts (radio semantics). */
export function CategoryFilter({ value, counts, total, onChange }: { value: IdeaFilter; counts: Record<IdeaCategory, number>; total: number; onChange: (f: IdeaFilter) => void }) {
  const { t, theme } = useApp();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('ideas.filter.label')}
      contentContainerStyle={{ gap: space.s, paddingVertical: space.xs }}
    >
      <Chip
        label={t('ideas.filter.all', { n: total })}
        a11yLabel={t('f90.ideaFilter.allA11y', { n: total })}
        hint={t('f90.ideaFilter.allHint')}
        selected={value === 'all'}
        onPress={() => onChange('all')}
      />
      {CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={t('ideas.filter.cat', { cat: t(categoryKey(c)), n: counts[c] })}
          a11yLabel={t('f90.ideaFilter.catA11y', { cat: t(categoryKey(c)), n: counts[c] })}
          hint={t('f90.ideaFilter.catHint', { cat: t(categoryKey(c)) })}
          selected={value === c}
          icon={<Ionicons name={IDEA_ICONS[c]} size={16} color={value === c ? theme.accentInk : theme.sea} />}
          onPress={() => onChange(c)}
        />
      ))}
    </ScrollView>
  );
}

/** Opens an idea's link when it is a web address; says so when the phone can't. */
export function useOpenLink() {
  const [failed, setFailed] = useState<string | null>(null);
  const open = useCallback(async (idea: Idea) => {
    const url = webLink(idea.link);
    if (!url) return;
    setFailed(null);
    try {
      await Linking.openURL(url);
    } catch {
      setFailed(idea.id);
    }
  }, []);
  return { open, failed };
}

/**
 * Ticks Been there on or off. Ticking it on offers to write (or open) the journal page for the day it was planned
 * for, else today on the trip; "Not now" leaves the journal alone.
 */
export function useBeenThere(trip: Trip) {
  const { t, lang } = useApp();
  const { saveTrip } = useTrips();
  const router = useRouter();
  return useCallback(
    async (idea: Idea) => {
      const done = !idea.done;
      if (!(await saveTrip(setIdeaDone(trip, idea.id, done)))) {
        Alert.alert(t('ideas.saveFailed.title'), t('ideas.saveFailed.body'));
        return;
      }
      if (!done) return;
      haptic.success();
      const day = ideaJournalDay(trip, idea);
      const page = entriesOn(trip, day)[0];
      Alert.alert(t('ideas.been.title'), t(page ? 'ideas.been.bodyOpen' : 'ideas.been.body', { name: idea.name, day: formatDay(day, lang) }), [
        { text: t('ideas.been.notNow'), style: 'cancel' },
        { text: t(page ? 'ideas.been.open' : 'ideas.been.write'), onPress: () => router.push({ pathname: '/journal-edit', params: { tripId: trip.id, entryId: page?.id ?? '', day } }) },
      ]);
    },
    [trip, saveTrip, router, t, lang],
  );
}

/** One idea: Been there tick, the idea (opens the editor), and an Open link button for a web address. */
export const IdeaRow = memo(function IdeaRow({
  idea,
  dayLabel,
  onOpen,
  onToggle,
  onLink,
  linkFailed,
}: {
  idea: Idea;
  /** "Day 2" when shown outside its day group (the trip screen card); null inside one. */
  dayLabel: string | null;
  onOpen: (idea: Idea) => void;
  onToggle: (idea: Idea) => void;
  onLink: (idea: Idea) => void;
  linkFailed: boolean;
}) {
  const { t, theme } = useApp();
  const done = idea.done === true;
  const url = webLink(idea.link);
  const cat = t(categoryKey(idea.category));
  const meta = [cat, dayLabel, idea.spotName ? t('ideas.row.at', { name: idea.spotName }) : typeof idea.lat === 'number' ? t('ideas.row.onMap') : null, done ? t('ideas.row.been') : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View
      style={[
        { backgroundColor: theme.cardRaised, borderRadius: radius.l, borderWidth: theme.dark ? 1 : 0, borderColor: theme.line, padding: space.s, gap: space.xs },
        shadowOf(theme, 'low'),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <PressableScale
          accessibilityRole="checkbox"
          accessibilityLabel={t('ideas.row.beenA11y', { name: idea.name })}
          accessibilityHint={t(done ? 'ideas.row.beenOffHint' : 'ideas.row.beenHint')}
          accessibilityState={{ checked: done }}
          onPress={() => onToggle(idea)}
          style={{ width: TOUCH, alignItems: 'center' }}
        >
          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={done ? theme.ok : theme.muted} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('ideas.row.a11y', { name: idea.name, meta, note: idea.note ?? '' })}
          accessibilityHint={t('ideas.row.hint')}
          onPress={() => onOpen(idea)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs }}
        >
          <IconBadge name={IDEA_ICONS[idea.category]} tone={IDEA_TONES[idea.category]} size="s" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.bodyStrong, { color: done ? theme.muted : theme.ink }]}>{idea.name}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{meta}</Text>
            {idea.note ? (
              <Text numberOfLines={2} style={[typeScale.small, { color: theme.ink }]}>
                {idea.note}
              </Text>
            ) : null}
          </View>
        </PressableScale>
      </View>
      {url ? (
        <View style={{ flexDirection: 'row', paddingLeft: TOUCH + space.xs }}>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={t('ideas.row.link', { name: idea.name })}
            accessibilityHint={t('ideas.row.linkHint')}
            onPress={() => onLink(idea)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
          >
            <Ionicons name="open-outline" size={16} color={theme.sea} />
            <Text style={[typeScale.bodyStrong, { fontSize: 14, color: theme.sea }]}>{t('ideas.row.linkLabel')}</Text>
          </PressableScale>
        </View>
      ) : idea.link ? (
        <Text style={[typeScale.small, { color: theme.muted, paddingLeft: TOUCH + space.xs }]} numberOfLines={1}>
          {idea.link}
        </Text>
      ) : null}
      {linkFailed ? (
        <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.danger, paddingLeft: TOUCH + space.xs }]}>
          {t('ideas.row.linkFailed')}
        </Text>
      ) : null}
    </View>
  );
});

/** See on map moves ideas past others that have a map spot, so every move changes the numbers on the map. */
const hasSpot = (i: Idea) => ideaSpot(i) !== null;

/**
 * T84: Move earlier / Move later for a planned idea on See on map. The day's order is stored on the trip, and the
 * map numbers the ideas in that order after the day's bookings. Hidden when the idea has nowhere to move.
 */
export function IdeaOrderButtons({ tripId, ideaId, name }: { tripId: string; ideaId: string; name: string }) {
  const { t, theme } = useApp();
  const { trips, saveTrip } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) return null;
  const can = canMoveIdea(trip, ideaId, hasSpot);
  if (!can.up && !can.down) return null;
  const move = async (dir: -1 | 1) => {
    const next = moveIdea(trip, ideaId, dir, hasSpot);
    if (next === trip) return;
    if (!(await saveTrip(next))) {
      Alert.alert(t('ideas.saveFailed.title'), t('ideas.saveFailed.body'));
      return;
    }
    haptic.tap();
    AccessibilityInfo.announceForAccessibility(t(dir < 0 ? 'f90.order.movedUp' : 'f90.order.movedDown', { name }));
  };
  const button = (dir: -1 | 1, enabled: boolean) => (
    <PressableScale
      key={dir}
      accessibilityRole="button"
      accessibilityLabel={t(dir < 0 ? 'f90.order.upA11y' : 'f90.order.downA11y', { name })}
      accessibilityHint={t(dir < 0 ? 'f90.order.upHint' : 'f90.order.downHint')}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => move(dir)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: enabled ? theme.seaSoft : theme.cardRaised, opacity: enabled ? 1 : 0.5 }}
    >
      <Ionicons name={dir < 0 ? 'arrow-up' : 'arrow-down'} size={16} color={enabled ? theme.sea : theme.muted} />
      <Text style={[typeScale.bodyStrong, { fontSize: 14, color: enabled ? theme.sea : theme.muted }]}>{t(dir < 0 ? 'f90.order.up' : 'f90.order.down')}</Text>
    </PressableScale>
  );
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingLeft: 32 + space.m }}>{[button(-1, can.up), button(1, can.down)]}</View>;
}

/** The trip timeline's light "Planned" rows for one day: a dashed outline, the category icon and the idea's name. */
export function PlannedIdeas({ trip, day }: { trip: Trip; day: string }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const list = ideasOn(trip, day);
  if (!list.length) return null;
  return (
    <View style={{ gap: space.xs }}>
      {list.map((i) => (
        <PressableScale
          key={i.id}
          accessibilityRole="button"
          accessibilityLabel={t(i.done ? 'ideas.planned.a11yBeen' : 'ideas.planned.a11y', { name: i.name, cat: t(categoryKey(i.category)) })}
          accessibilityHint={t('ideas.planned.hint')}
          onPress={() => router.push({ pathname: '/idea-edit', params: { tripId: trip.id, ideaId: i.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.m, borderRadius: radius.m, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name={i.done ? 'checkmark-circle' : IDEA_ICONS[i.category]} size={18} color={i.done ? theme.ok : theme.sea} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{t(i.done ? 'ideas.planned.been' : 'ideas.planned.label')}</Text>
            <Text style={[typeScale.body, { color: theme.ink }]} numberOfLines={1}>
              {i.name}
            </Text>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}
