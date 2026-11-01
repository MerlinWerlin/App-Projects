// T135 trip gaps, the UI side (logic in src/core/gaps.ts):
// - TripGapsCard: the "Trip gaps" hero card on the trip screen (count, each gap with a one-line reason, Add a stay /
//   Add a journey opening the add-booking form prefilled with the dates, kind and zone, Open booking for clashes,
//   and Dismiss kept per trip on this phone, with a way to show dismissed gaps again).
// - GapsBriefRow: the Your day row when tonight has no stay.
// - gapsDetail: the readiness row's sentence; openGapAdd: the add form for a gap.
// Tokens only, 48 pt targets, every control labelled; the card fades in (timed, static with Reduce Motion).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatDay } from '../core/format.ts';
import {
  dismissedFor,
  dismissGap,
  findGaps,
  GAPS_DISMISSED_KEY,
  NO_DISMISSALS,
  restoreGaps,
  tonightGap,
  type Gap,
  type GapAdd,
  type GapDismissals,
  type GapKind,
} from '../core/gaps.ts';
import { isTransport, type Item, type LocalDate, type Trip } from '../core/model.ts';
import type { Check } from '../core/readiness.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { elevated, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, GradientFill, IconBadge, toneColours, type IconName, type Tone } from './hero.tsx';
import { kindKey } from './kinds.tsx';
import { PressableScale } from './kit.tsx';
import { durationText } from './layovers.tsx';

/** Shown before "Show all". */
const FIRST_FEW = 3;

// ------------------------------------------------------------------ dismissals (this phone only)

/** [dismissed ids for this trip, dismiss one, show them all again, loaded]. */
export function useGapDismissals(tripId: string): [string[], (id: string) => void, () => void, boolean] {
  const [store, setStore, loaded] = usePersisted<GapDismissals>(GAPS_DISMISSED_KEY, NO_DISMISSALS);
  const ids = useMemo(() => dismissedFor(store, tripId), [store, tripId]);
  return [ids, (id) => setStore((old) => dismissGap(old, tripId, id)), () => setStore((old) => restoreGaps(old, tripId)), loaded];
}

type Router = ReturnType<typeof useRouter>;

/** The add-booking form for a gap: kind, first date, check-out / last date and the zone filled in. */
export function openGapAdd(router: Router, tripId: string, add: GapAdd) {
  router.push({ pathname: '/item-edit', params: { tripId, kind: add.kind, date: add.date, tz: add.tz, ...(add.until ? { until: add.until } : {}) } });
}

// ------------------------------------------------------------------ words

const LOOK: Record<GapKind, { icon: IconName; tone: Tone }> = {
  night: { icon: 'bed-outline', tone: 'accent' },
  move: { icon: 'trail-sign-outline', tone: 'sea' },
  stayClash: { icon: 'copy-outline', tone: 'warn' },
  legClash: { icon: 'git-compare-outline', tone: 'warn' },
  checkInLate: { icon: 'time-outline', tone: 'warn' },
  lateArrival: { icon: 'alarm-outline', tone: 'warn' },
  noWayHome: { icon: 'home-outline', tone: 'accent' },
};

const itemName = (t: T, i: Item | undefined) => (i ? i.title.trim() || i.place?.name?.trim() || t(kindKey(i.kind)) : '');

export const gapTitle = (t: T, g: Gap) => t(`gaps.title.${g.kind}`);

/** The one-line reason under a gap's title. */
export function gapReason(t: T, g: Gap, lang: string): string {
  const day = (d: LocalDate) => formatDay(d, lang);
  const [a, b] = g.items;
  const d = durationText(t, g.minutes ?? 0);
  switch (g.kind) {
    case 'night':
      return g.nights === 1 ? t('gaps.reason.nightOne', { date: day(g.from) }) : t('gaps.reason.night', { range: t('gaps.range', { from: day(g.from), to: day(g.to) }), n: g.nights ?? 0 });
    case 'move':
      return g.fromPlace || g.toPlace
        ? t('gaps.reason.move', { from: g.fromPlace || itemName(t, a), to: g.toPlace || itemName(t, b) })
        : t('gaps.reason.moveNoNames', { date: day(g.to) });
    case 'stayClash':
      if ((g.nights ?? 0) > 1) return t('gaps.reason.stayClash', { a: itemName(t, a), b: itemName(t, b), n: g.nights ?? 0 });
      if (g.nights === 1) return t('gaps.reason.stayClashOne', { a: itemName(t, a), b: itemName(t, b), date: day(g.from) });
      return t('gaps.reason.stayClashTime', { a: itemName(t, a), b: itemName(t, b), d });
    case 'legClash':
      return t('gaps.reason.legClash', { a: itemName(t, a), b: itemName(t, b), d });
    case 'checkInLate':
      return t('gaps.reason.checkInLate', { stay: itemName(t, b), leg: itemName(t, a), d });
    case 'lateArrival':
      return t('gaps.reason.lateArrival', { leg: itemName(t, a), stay: itemName(t, b), date: day(g.to), out: day(g.from) });
    case 'noWayHome':
      return t('gaps.reason.noWayHome', { date: day(g.from) });
  }
}

/** The readiness row's sentence (src/core/gaps.ts gapsCheck). */
export function gapsDetail(t: T, c: Check): string {
  if (c.reason !== 'found') return t('gaps.readiness.ok');
  return (c.done ?? 0) === 1 ? t('gaps.readiness.foundOne') : t('gaps.readiness.foundMany', { n: c.done ?? 0 });
}

// ------------------------------------------------------------------ the card

/** Original glyph: a route between two stops with a break in the middle, and a spark where it breaks. Decorative. */
export const GapsGlyph = memo(function GapsGlyph({ size = 22 }: { size?: number }) {
  const { theme } = useApp();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M3.5 18.5 C 6 18.5, 7 15, 9 13.4" stroke={theme.heroInk} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M15 10.6 C 17 9, 18 5.5, 20.5 5.5" stroke={theme.heroInk} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={[2.5, 2.5]} />
      <Circle cx={3.5} cy={18.5} r={2.3} fill={theme.heroAccent} />
      <Circle cx={20.5} cy={5.5} r={2.3} fill={theme.heroAccent} />
      <Path d="M12 8.6 L12.8 11.2 L15.4 12 L12.8 12.8 L12 15.4 L11.2 12.8 L8.6 12 L11.2 11.2 Z" fill={theme.heroAccent} />
    </Svg>
  );
});

/** A small rounded action, 48 pt tall, labelled. */
function Action({ label, a11y, hint, icon, strong, onPress }: { label: string; a11y?: string; hint: string; icon: IconName; strong?: boolean; onPress: () => void }) {
  const { theme } = useApp();
  const fg = strong ? theme.onAccent : theme.ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{
        minHeight: TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.l,
        borderRadius: radius.pill,
        backgroundColor: strong ? theme.accentStrong : theme.card,
        borderWidth: strong ? 0 : 1,
        borderColor: theme.line,
      }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={16} color={fg} />
      </View>
      <Text style={[typeScale.bodyStrong, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

const GapRow = memo(function GapRow({ g, tripId, onDismiss }: { g: Gap; tripId: string; onDismiss: (id: string) => void }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const look = LOOK[g.kind];
  const { fg } = toneColours(theme, look.tone);
  const title = gapTitle(t, g);
  const reason = gapReason(t, g, lang);
  const when = g.from === g.to ? formatDay(g.from, lang) : t('gaps.range', { from: formatDay(g.from, lang), to: formatDay(g.to, lang) });
  const first = g.items[0];
  return (
    <View style={{ gap: space.s, paddingVertical: space.m }}>
      <View accessible accessibilityLabel={t('gaps.rowA11y', { title, reason })} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
        <IconBadge name={look.icon} tone={look.tone} size="s" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.caption, { color: fg }]}>{when}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{reason}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingLeft: space.xl + space.m }}>
        {g.add ? (
          g.add.kind === 'hotel' ? (
            <Action strong icon="bed-outline" label={t('gaps.add.stay')} hint={t('gaps.add.stayHint')} onPress={() => g.add && openGapAdd(router, tripId, g.add)} />
          ) : (
            <Action strong icon="airplane-outline" label={t('gaps.add.journey')} hint={t('gaps.add.journeyHint')} onPress={() => g.add && openGapAdd(router, tripId, g.add)} />
          )
        ) : first ? (
          <Action strong icon="create-outline" label={t('gaps.open')} a11y={t('gaps.openA11y', { title: itemName(t, first) })} hint={t('gaps.openHint')} onPress={() => router.push(`/item/${first.id}`)} />
        ) : null}
        <Action icon="eye-off-outline" label={t('gaps.dismiss')} a11y={t('gaps.dismissA11y', { title })} hint={t('gaps.dismissHint')} onPress={() => onDismiss(g.id)} />
      </View>
    </View>
  );
});

/** The Trip gaps card. Nothing until the trip has a journey or a stay. */
export function TripGapsCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const [dismissed, dismiss, restore, loaded] = useGapDismissals(trip.id);
  const [all, setAll] = useState(false);
  const booked = useMemo(() => (trip.items ?? []).some((i) => isTransport(i.kind) || i.kind === 'hotel'), [trip]);
  const r = useMemo(() => findGaps(trip, dismissed), [trip, dismissed]);
  if (!booked || !loaded) return null;
  const count = r.gaps.length;
  const shown = all ? r.gaps : r.gaps.slice(0, FIRST_FEW);
  const headline = count === 0 ? t('gaps.card.none') : count === 1 ? t('gaps.card.countOne') : t('gaps.card.countMany', { n: count });
  return (
    <FadeInView>
      <View style={[elevated(theme, 'mid'), { borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.card }]}>
        <View style={{ padding: space.l, gap: space.s, backgroundColor: theme.hero[count ? 'wallet' : 'map'][0] }}>
          <GradientFill tone={count ? 'wallet' : 'map'} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
              <GapsGlyph />
            </View>
            <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.heroMuted, flex: 1 }]}>
              {t('gaps.card.eyebrow')}
            </Text>
            {count ? (
              <View accessible accessibilityLabel={t('gaps.card.countA11y', { n: count })} style={{ backgroundColor: theme.heroChip, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                <Text style={[typeScale.caption, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{count}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{headline}</Text>
          <Text style={[typeScale.body, { color: theme.heroMuted }]}>{count ? t('gaps.card.sub') : t('gaps.card.noneBody')}</Text>
        </View>
        <View style={{ paddingHorizontal: space.l, paddingBottom: space.s }}>
          {shown.map((g, i) => (
            <View key={g.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}>
              <GapRow g={g} tripId={trip.id} onDismiss={dismiss} />
            </View>
          ))}
          {count > FIRST_FEW ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={all ? t('gaps.card.showFewer') : t('gaps.card.showAll', { n: count })}
              accessibilityHint={all ? t('gaps.card.showFewerHint') : t('gaps.card.showAllHint')}
              accessibilityState={{ expanded: all }}
              onPress={() => setAll((v) => !v)}
              style={{ minHeight: TOUCH, justifyContent: 'center', borderTopWidth: 1, borderTopColor: theme.line }}
            >
              <Text style={[typeScale.bodyStrong, { color: theme.accentInk }]}>{all ? t('gaps.card.showFewer') : t('gaps.card.showAll', { n: count })}</Text>
            </PressableScale>
          ) : null}
          {r.dismissed ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={r.dismissed === 1 ? t('gaps.card.restoreOne') : t('gaps.card.restoreMany', { n: r.dismissed })}
              accessibilityHint={t('gaps.card.restoreHint')}
              onPress={restore}
              style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.s, borderTopWidth: 1, borderTopColor: theme.line }}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name="eye-outline" size={16} color={theme.muted} />
              </View>
              <Text style={[typeScale.small, { color: theme.muted }]}>{r.dismissed === 1 ? t('gaps.card.restoreOne') : t('gaps.card.restoreMany', { n: r.dismissed })}</Text>
            </PressableScale>
          ) : null}
          <Text style={[typeScale.small, { color: theme.muted, paddingVertical: space.s }]}>{t('gaps.card.privacy')}</Text>
        </View>
      </View>
    </FadeInView>
  );
}

// ------------------------------------------------------------------ Your day

/** "No stay booked for tonight" on the Your day card; a tap opens a new stay from tonight. */
export function GapsBriefRow({ trip, today }: { trip: Trip; today: LocalDate }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [dismissed] = useGapDismissals(trip.id);
  const g = useMemo(() => tonightGap(trip, today, dismissed), [trip, today, dismissed]);
  if (!g?.add) return null;
  const add: GapAdd = { ...g.add, date: today };
  const line = t('gaps.brief.tonight');
  return (
    <View>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={line}
        accessibilityHint={t('gaps.brief.tonightHint', { trip: trip.name })}
        onPress={() => openGapAdd(router, trip.id, add)}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}
      >
        <GapsGlyph size={18} />
        <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
          {line}
        </Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="add-circle-outline" size={18} color={theme.heroAccent} />
        </View>
      </PressableScale>
    </View>
  );
}
