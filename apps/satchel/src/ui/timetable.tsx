// T170 Today timetable pieces: a block on the timetable (time column, rail dot, tinted card sized by its length),
// a free-time row, the day strip across the trip, and the "Today's timetable" entry for the Trips tab and a trip.
// Logic in src/core/dayview.ts. Colours from tokens only; every control names itself; 48 pt targets.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useRef, type ComponentProps, type ComponentRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { formatDay, formatDuration, formatTime, zoneCity } from '../core/format.ts';
import { dayStrip, daySchedule, headline, openingDay, type Block, type BlockLook, type FreeBlock, type StripDay } from '../core/dayview.ts';
import type { Trip } from '../core/model.ts';
import { tripPhase } from '../core/timeline.ts';
import { daysBetween, localDate } from '../core/tz.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { elevated, fonts, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { IconBadge, toneColours, type Tone } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { useMinute } from './TripPass.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const LOOK_ICON: Record<BlockLook, IconName> = {
  flight: 'airplane',
  train: 'train',
  ferry: 'boat',
  bus: 'bus',
  transfer: 'swap-horizontal',
  car: 'car',
  carPickup: 'car',
  carReturn: 'car-outline',
  checkin: 'key',
  checkout: 'exit-outline',
  food: 'restaurant',
  tour: 'flag',
  activity: 'ticket',
  free: 'sunny',
  note: 'document-text',
};

export const LOOK_TONE: Record<BlockLook, Tone> = {
  flight: 'sea',
  train: 'teal',
  ferry: 'sea',
  bus: 'ok',
  transfer: 'ok',
  car: 'ink',
  carPickup: 'ink',
  carReturn: 'ink',
  checkin: 'accent',
  checkout: 'accent',
  food: 'warn',
  tour: 'teal',
  activity: 'accent',
  free: 'ok',
  note: 'ink',
};

export const lookKey = (l: BlockLook): Key => `today.look.${l}` as Key;

/** Height of a block card: longer plans are taller, like a timetable (clamped so a long flight stays readable). */
export function blockHeight(b: Block): number {
  const min = Math.max(0, (b.endUtc - b.startUtc) / 60_000);
  return Math.round(Math.min(200, Math.max(84, 64 + min * 0.5)));
}

/** "09:30" or "09:30 Sydney time" when the block runs on another zone's clock. */
function useClock() {
  const { t } = useApp();
  return (local: string, tz: string, other: boolean) => (other ? t('today.otherZone', { time: formatTime(local), city: zoneCity(tz) }) : formatTime(local));
}

/** The line under a block's title: route, place, arrival, "until". */
function blockDetail(b: Block, t: ReturnType<typeof useApp>['t'], lang: string): string {
  const it = b.item;
  const parts: string[] = [];
  if (b.role === 'arrive') parts.push(t('today.landsToday', { day: formatDay(localDate(it.start.local), lang) }));
  const route = [it.from?.name, it.to?.name].map((s) => (s ?? '').trim()).filter(Boolean).join(' → ');
  if (route && route !== it.title.trim()) parts.push(route);
  else if (it.place?.name && it.place.name.trim() !== it.title.trim()) parts.push(it.place.name.trim());
  else if (it.place?.address) parts.push(it.place.address.trim());
  return parts.join(' · ');
}

export const TimetableBlock = memo(function TimetableBlock({ b, onPress, last }: { b: Block; onPress: () => void; last?: boolean }) {
  const { t, theme, lang } = useApp();
  const clock = useClock();
  const tone = toneColours(theme, LOOK_TONE[b.look]);
  const live = b.state === 'now';
  const next = b.state === 'next';
  const done = b.state === 'done';
  const shownStart = b.role === 'arrive' && b.end ? b.end : b.start;
  const startText = clock(shownStart.local, shownStart.tz, shownStart.tz !== b.start.tz ? true : b.otherZone);
  const endText = b.role === 'whole' && b.end ? formatTime(b.end.local) : '';
  const endZoneOther = !!b.end && b.end.tz !== b.start.tz;
  const detail = blockDetail(b, t, lang);
  const ref = (b.item.ref ?? '').trim();
  const kindLabel = t(lookKey(b.look));
  const title = b.role === 'checkin' || b.role === 'checkout' || b.role === 'pickup' || b.role === 'return' ? `${kindLabel} · ${b.item.title}` : b.item.title || kindLabel;
  const stateWord = live ? t('today.now') : next ? t('today.next') : done ? t('today.done') : '';
  const a11y = [
    t('today.blockA11y', { time: startText, kind: kindLabel, title, state: stateWord }),
    endText ? t('today.until', { time: endText }) : '',
    detail,
    ref ? t('today.codeA11y', { ref }) : '',
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <View style={{ flexDirection: 'row', gap: space.m }}>
      {/* Time column */}
      <View style={{ width: 58, paddingTop: space.m }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[typeScale.bodyStrong, { color: done ? theme.muted : theme.ink, fontVariant: ['tabular-nums'] }]}>{formatTime(shownStart.local)}</Text>
        {endText && !endZoneOther ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{endText}</Text> : null}
      </View>
      {/* Rail */}
      <View style={{ width: 16, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ position: 'absolute', top: 0, bottom: last ? '70%' : 0, width: 2, backgroundColor: theme.line }} />
        <View
          style={{
            marginTop: space.m + 4,
            width: live ? 16 : 12,
            height: live ? 16 : 12,
            borderRadius: 8,
            backgroundColor: live ? theme.accentStrong : done ? theme.line : theme.card,
            borderWidth: live ? 3 : 2,
            borderColor: live ? theme.accentSoft : next ? theme.accentStrong : done ? theme.line : tone.fg,
          }}
        />
      </View>
      {/* Card */}
      <View style={{ flex: 1, paddingBottom: space.m }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityHint={t('today.blockHint')}
          onPress={onPress}
          style={[
            {
              minHeight: blockHeight(b),
              borderRadius: radius.m,
              padding: space.m,
              gap: space.xs,
              justifyContent: 'flex-start',
              backgroundColor: done ? theme.card : tone.bg,
              borderWidth: live || next ? 2 : 1,
              borderColor: live ? theme.accentStrong : next ? tone.fg : theme.line,
              opacity: done ? 0.72 : 1,
              borderLeftWidth: 5,
              borderLeftColor: tone.fg,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Ionicons name={LOOK_ICON[b.look]} size={18} color={tone.fg} />
            <Text style={[typeScale.caption, { color: tone.fg, flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>
              {kindLabel}
            </Text>
            {stateWord && !done ? (
              <View style={{ backgroundColor: live ? theme.accentStrong : theme.card, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 }}>
                <Text style={[typeScale.caption, { color: live ? theme.onAccent : theme.accentInk }]}>{stateWord}</Text>
              </View>
            ) : null}
            {done ? <Ionicons name="checkmark-circle" size={18} color={theme.ok} /> : null}
          </View>
          <Text style={[typeScale.bodyStrong, { color: theme.ink, fontSize: 17 }]}>{title}</Text>
          {detail ? <Text style={[typeScale.small, { color: theme.muted }]}>{detail}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: 2 }}>
            {b.otherZone || shownStart.tz !== b.start.tz ? <Meta icon="globe-outline" text={startText} /> : null}
            {b.role === 'whole' && b.end && (endZoneOther || b.endsNextDay) ? (
              <Meta icon="flag-outline" text={t(b.endsNextDay ? 'today.arrivesNextDay' : 'today.arrives', { time: clock(b.end.local, b.end.tz, endZoneOther) })} />
            ) : null}
            {ref ? <Meta icon="pricetag-outline" text={t('today.code', { ref })} mono /> : null}
          </View>
        </PressableScale>
      </View>
    </View>
  );
});

function Meta({ icon, text, mono }: { icon: IconName; text: string; mono?: boolean }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.card, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 }}>
      <Ionicons name={icon} size={12} color={theme.muted} />
      <Text style={[typeScale.small, { fontSize: 13, color: theme.ink, fontFamily: mono ? fonts.bodyBold : fonts.body, letterSpacing: mono ? 0.6 : 0 }]}>{text}</Text>
    </View>
  );
}

export const FreeRow = memo(function FreeRow({ f }: { f: FreeBlock }) {
  const { t, theme } = useApp();
  const label = f.where === 'morning' ? t('today.free.morning') : f.where === 'evening' ? t('today.free.evening') : t('today.free');
  const length = formatDuration(f.minutes);
  return (
    <View style={{ flexDirection: 'row', gap: space.m }}>
      <View style={{ width: 58 }} />
      <View style={{ width: 16, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: theme.line, opacity: 0.6 }} />
      </View>
      <View
        accessible
        accessibilityLabel={[t('today.freeA11y', { label, from: formatTime(f.from), to: formatTime(f.to), length }), f.current ? t('today.free.here') : ''].filter(Boolean).join('. ')}
        style={{
          flex: 1,
          marginBottom: space.m,
          borderRadius: radius.m,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: f.current ? theme.ok : theme.line,
          paddingVertical: space.s,
          paddingHorizontal: space.m,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s,
          minHeight: TOUCH,
        }}
      >
        <Ionicons name="sunny-outline" size={18} color={theme.ok} />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink, fontSize: 15 }]}>{label}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('today.free.length', { from: formatTime(f.from), to: formatTime(f.to), length })}</Text>
        </View>
        {f.current ? (
          <View style={{ backgroundColor: theme.okSoft, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 }}>
            <Text style={[typeScale.caption, { color: theme.ok }]}>{t('today.free.here')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

/** The day strip: one chip per trip day (weekday, date number, the day's main icon), today ringed, selected filled. */
export function DayStrip({ days, selected, onPick }: { days: StripDay[]; selected: string; onPick: (date: string) => void }) {
  const { t, theme, lang } = useApp();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const idx = Math.max(0, days.findIndex((d) => d.date === selected));
  const CHIP = 58;
  useEffect(() => {
    ref.current?.scrollTo({ x: Math.max(0, idx * (CHIP + space.s) - CHIP * 2), animated: false });
  }, [idx]);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, paddingHorizontal: space.l }} accessibilityLabel={t('today.stripLabel')}>
      {days.map((d) => {
        const on = d.date === selected;
        const wd = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d.date}T12:00:00Z`));
        const num = String(Number(d.date.slice(8, 10)));
        const dayLabel = formatDay(d.date, lang);
        const a11y = d.count === 0 ? t('today.stripDayNone', { day: dayLabel }) : d.today ? t('today.stripDayToday', { day: dayLabel, n: d.count }) : t('today.stripDay', { day: dayLabel, n: d.count });
        const fg = on ? theme.onAccent : d.past ? theme.muted : theme.ink;
        return (
          <PressableScale
            key={d.date}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a11y}
            accessibilityHint={t('today.stripHint')}
            onPress={() => onPick(d.date)}
            style={{
              width: CHIP,
              paddingVertical: space.s,
              alignItems: 'center',
              gap: 2,
              borderRadius: radius.m,
              backgroundColor: on ? theme.accentStrong : theme.card,
              borderWidth: d.today && !on ? 2 : 1,
              borderColor: d.today && !on ? theme.accentStrong : on ? theme.accentStrong : theme.line,
            }}
          >
            <Text style={[typeScale.caption, { fontSize: 11, color: fg }]}>{wd}</Text>
            <Text style={[typeScale.title, { color: fg, fontVariant: ['tabular-nums'] }]}>{num}</Text>
            {d.lead ? <Ionicons name={LOOK_ICON[d.lead]} size={14} color={on ? theme.onAccent : toneColours(theme, LOOK_TONE[d.lead]).fg} /> : <View style={{ height: 14 }} />}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/**
 * The way into the timetable: on the Trips tab (a trip on now, or starting within a week) and at the top of a trip.
 * Shows today's (or the first day's) now / next line so it's worth a glance before opening.
 */
export const TimetableEntry = memo(function TimetableEntry({ trip, compact }: { trip: Trip; compact?: boolean }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const now = useMinute();
  const day = openingDay(trip, now);
  const s = daySchedule(trip, day, now);
  const head = headline(s);
  const strip = dayStrip(trip, now);
  const isToday = strip.find((d) => d.date === day)?.today ?? false;
  const title = isToday ? t('today.open') : t('today.openDays');
  let line = '';
  if (head) {
    const at = head.role === 'arrive' && head.end ? head.end : head.start;
    const name = head.item.title || t(lookKey(head.look));
    if (head.state === 'now') line = t('today.headNow', { title: name, time: formatTime((head.end ?? head.start).local) });
    else {
      const mins = Math.round((head.startUtc - now) / 60_000);
      line = mins <= 12 * 60 ? t('today.headNext', { title: name, in: formatDuration(mins) }) : t('today.headNextAt', { title: name, time: `${formatDay(localDate(at.local), lang)} ${formatTime(at.local)}` });
    }
  } else if (s.dayNumber) line = t('today.dayOf', { n: s.dayNumber, total: s.totalDays });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, line].filter(Boolean).join('. ')}
      accessibilityHint={t('today.openHint')}
      onPress={() => router.push({ pathname: '/today/[tripId]', params: { tripId: trip.id } })}
      style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: compact ? space.m : space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }]}
    >
      <IconBadge name="calendar" tone="accent" />
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
        {line ? <Text style={[typeScale.small, { color: theme.muted }]} numberOfLines={2}>{line}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </PressableScale>
  );
});

/** The trip the Trips tab offers a timetable for: one on now, else one starting within 7 days. */
export function timetableTrip(trips: Trip[], today: string): Trip | null {
  const on = trips.filter((tr) => tripPhase(tr, today) === 'active' && tr.items.length);
  if (on.length) return on.sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
  const soon = trips.filter((tr) => tr.items.length && tr.startDate > today && daysBetween(today, tr.startDate) <= 7);
  return soon.sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] ?? null;
}
