// T114 Call home planner pieces: the awake-hours stepper, the 24 h who-is-awake strip with its text summary, a
// person's "right now" card with tap-to-call / message / FaceTime, and the entry points (Your day row, readiness row,
// Jet lag button). All maths is in src/core/callhome.ts; people are kept on this phone only (src/state/callhome.ts).
// Colours are theme tokens; every control is 48 pt or more and names itself to screen readers.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import {
  briefCall,
  callLinks,
  dayZonesFor,
  daysFrom,
  HOURS_STEP_MIN,
  nextWindow,
  personNow,
  stepHours,
  stripAt,
  stripTicks,
  wrapsMidnight,
  dayHours,
  type Awake,
  type CallDay,
  type CallHomeStore,
  type CallPerson,
  type Hours,
} from '../core/callhome.ts';
import { deviceZone, formatDay, zoneCity } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { fromUtc, localDate } from '../core/tz.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useCallHome } from '../state/callhome.ts';
import type { Theme } from '../theme/tokens.ts';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { useMinute } from './JetLagCard.tsx';
import { Button, PressableScale } from './kit.tsx';

/** '24:00' reads as "midnight". */
export const showClock = (t: T, s: string): string => (s === '24:00' ? t('callhome.midnight') : s);

/** A stand-in trip for when the planner opens without one: the traveller is on the phone's clock. */
export function phoneTrip(): Trip {
  return { id: '', name: '', startDate: '', endDate: '', homeTz: deviceZone(), items: [], createdAt: '' };
}

/** Opens a tel: / sms: / facetime: link; false (never throws) when the phone can't. */
export async function openLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------------------------- hours stepper

function StepButton({ icon, label, onPress }: { icon: 'remove' | 'add'; label: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: TOUCH,
        height: TOUCH,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: theme.line,
        backgroundColor: theme.card,
        alignItems: 'center',
      }}
    >
      <Ionicons name={icon} size={22} color={theme.ink} />
    </PressableScale>
  );
}

function HourRow({ label, value, onStep }: { label: string; value: string; onStep: (delta: number) => void }) {
  const { t, theme } = useApp();
  const time = showClock(t, value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
      <Text style={[typeScale.body, { color: theme.ink, flex: 1, fontVariant: ['tabular-nums'] }]}>{t('callhome.hours.value', { label, time })}</Text>
      <StepButton icon="remove" label={t('callhome.hours.earlierA11y', { label, time })} onPress={() => onStep(-HOURS_STEP_MIN)} />
      <StepButton icon="add" label={t('callhome.hours.laterA11y', { label, time })} onPress={() => onStep(HOURS_STEP_MIN)} />
    </View>
  );
}

/** Awake from / until, each moved in 30-minute steps; the ends never meet. */
export function HoursField({ hours, onChange }: { hours: Hours; onChange: (h: Hours) => void }) {
  const { t, theme } = useApp();
  return (
    <View style={{ gap: space.xs }}>
      <HourRow label={t('callhome.hours.from')} value={hours.from} onStep={(d) => onChange(stepHours(hours, 'from', d))} />
      <HourRow label={t('callhome.hours.to')} value={hours.to} onStep={(d) => onChange(stepHours(hours, 'to', d))} />
      {wrapsMidnight(hours) ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('callhome.hours.wraps')}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------- strip

export const awakeColour = (theme: Theme, s: Awake): string => (s === 'both' ? theme.ok : s === 'you' ? theme.accent : s === 'them' ? theme.sea : theme.line);

/** The legend for the strip (shown once above the days). */
export function StripLegend({ name }: { name: string }) {
  const { t, theme } = useApp();
  const items: { s: Awake; label: string }[] = [
    { s: 'both', label: t('callhome.legend.both') },
    { s: 'you', label: t('callhome.legend.you') },
    { s: 'them', label: t('callhome.legend.them', { name }) },
    { s: 'neither', label: t('callhome.legend.neither') },
  ];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m }}>
      {items.map((i) => (
        <View key={i.s} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: awakeColour(theme, i.s) }} />
          <Text style={[typeScale.small, { color: theme.muted }]}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** One day's summary in words (also the strip's spoken text). */
export function daySummary(t: T, day: CallDay, name: string): string {
  if (!day.windows.length) return t('callhome.day.noOverlap');
  const list = day.windows
    .map((w) => {
      const base = t('callhome.day.window', { from: w.youFrom, to: showClock(t, w.youTo), themFrom: w.themFrom, themTo: w.themTo, name });
      const notes = [w.fromBefore ? t('callhome.day.fromBefore') : '', w.intoNext ? t('callhome.day.carriesOn') : ''].filter(Boolean);
      return notes.length ? `${base}, ${notes.join(', ')}` : base;
    })
    .join('; ');
  return t('callhome.day.windows', { list });
}

/** The 24 h strip for one day: who is awake, in token colours, with hour marks and a "now" line on today. */
export const DayStrip = memo(function DayStrip({ day, now }: { day: CallDay; now: number }) {
  const { theme } = useApp();
  const ticks = stripTicks(day);
  const nowAt = now >= day.startUtc && now < day.endUtc ? stripAt(day, now) : null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 2 }}>
      <View style={{ height: 22, borderRadius: radius.s, overflow: 'hidden', flexDirection: 'row', backgroundColor: theme.line }}>
        {day.runs.map((r) => (
          <View key={r.startUtc} style={{ flex: r.endUtc - r.startUtc, backgroundColor: awakeColour(theme, r.state) }} />
        ))}
        {nowAt !== null ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `${Math.round(nowAt * 1000) / 10}%`, backgroundColor: theme.ink }} />
        ) : null}
      </View>
      <View style={{ height: 16 }}>
        {ticks.map((k) => (
          <Text
            key={k.label}
            style={[typeScale.small, { position: 'absolute', left: `${Math.round(k.at * 1000) / 10}%`, fontSize: 11, lineHeight: 16, color: theme.muted }]}
          >
            {k.label}
          </Text>
        ))}
      </View>
    </View>
  );
});

/** A day: "Wed 11 Nov · Tokyo", the strip and the windows in words. */
export const DayBlock = memo(function DayBlock({ day, name, now }: { day: CallDay; name: string; now: number }) {
  const { t, theme, lang } = useApp();
  const header = t('callhome.day.header', { day: formatDay(day.date, lang), city: zoneCity(day.tz) });
  const summary = daySummary(t, day, name);
  const hours = dayHours(day);
  const length = hours !== 24 ? t('callhome.day.length', { n: hours }) : '';
  return (
    <View
      accessible
      accessibilityLabel={t('callhome.day.a11y', {
        day: formatDay(day.date, lang),
        city: zoneCity(day.tz),
        summary: length ? `${summary} ${length}` : summary,
      })}
      style={{ gap: space.xs, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}
    >
      <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{header}</Text>
      <DayStrip day={day} now={now} />
      <Text style={[typeScale.small, { color: day.windows.length ? theme.ink : theme.warn, fontVariant: ['tabular-nums'] }]}>{summary}</Text>
      {length ? <Text style={[typeScale.small, { color: theme.muted }]}>{length}</Text> : null}
    </View>
  );
});

// ------------------------------------------------------------------------------------------------- right now

/** "It's 03:10 for Mum - asleep" (with "tomorrow" / "yesterday" when their date differs). */
export function nowLine(t: T, person: CallPerson, youTz: string, now: number): string {
  const n = personNow(person, youTz, now);
  if (!n) return '';
  const vars = { time: n.time, name: person.name, day: n.dayDiff > 0 ? t('callhome.now.tomorrow') : t('callhome.now.yesterday') };
  if (n.dayDiff === 0) return t(n.awake ? 'callhome.now.awake' : 'callhome.now.asleep', vars);
  return t(n.awake ? 'callhome.now.awakeDay' : 'callhome.now.asleepDay', vars);
}

/** "Good time to call now, until 21:00" / "Next good time: 18:30 (09:30 for Mum)" / tomorrow / none. */
export function nextLine(t: T, person: CallPerson, days: readonly CallDay[], now: number, lang: string): { text: string; now: boolean } {
  const w = nextWindow(days, now);
  const youTz = days[0]?.tz ?? 'UTC';
  const today = days[0]?.date ?? '';
  if (!w) return { text: t('callhome.next.none'), now: false };
  if (w.now) {
    const end = fromUtc(w.endUtc, youTz);
    const until = localDate(end) > today && end.slice(11, 16) === '00:00' ? t('callhome.midnight') : end.slice(11, 16);
    return { text: t('callhome.next.now', { until }), now: true };
  }
  const start = fromUtc(w.startUtc, youTz);
  const vars = { from: start.slice(11, 16), themFrom: fromUtc(w.startUtc, person.tz).slice(11, 16), name: person.name, day: formatDay(localDate(start), lang) };
  const date = localDate(start);
  return { text: t(date === today ? 'callhome.next.today' : date === days[1]?.date ? 'callhome.next.tomorrow' : 'callhome.next.later', vars), now: false };
}

function LinkButton({
  icon,
  label,
  a11y,
  hint,
  onPress,
}: {
  icon: 'call' | 'chatbubble' | 'videocam';
  label: string;
  a11y: string;
  hint: string;
  onPress: () => void;
}) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.l,
        borderRadius: radius.pill,
        backgroundColor: theme.seaSoft,
      }}
    >
      <Ionicons name={icon} size={18} color={theme.sea} />
      <Text style={[typeScale.bodyStrong, { color: theme.sea }]}>{label}</Text>
    </PressableScale>
  );
}

/** Call / Message / FaceTime (FaceTime on iPhone only), or a note when no phone is saved. */
export function CallButtons({ person }: { person: CallPerson }) {
  const { t, theme } = useApp();
  const [failed, setFailed] = useState(false);
  const links = callLinks(person.phone);
  if (!links) return <Text style={[typeScale.small, { color: theme.muted }]}>{t('callhome.noPhone')}</Text>;
  const go = async (url: string) => setFailed(!(await openLink(url)));
  const name = person.name;
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <LinkButton
          icon="call"
          label={t('callhome.call')}
          a11y={t('callhome.callA11y', { name })}
          hint={t('callhome.callHint')}
          onPress={() => go(links.call)}
        />
        <LinkButton
          icon="chatbubble"
          label={t('callhome.message')}
          a11y={t('callhome.messageA11y', { name })}
          hint={t('callhome.messageHint')}
          onPress={() => go(links.message)}
        />
        {Platform.OS === 'ios' ? (
          <LinkButton
            icon="videocam"
            label={t('callhome.facetime')}
            a11y={t('callhome.facetimeA11y', { name })}
            hint={t('callhome.facetimeHint')}
            onPress={() => go(links.facetime)}
          />
        ) : null}
      </View>
      {failed ? (
        <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.danger }]}>
          {t('callhome.openFailed')}
        </Text>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------- entry points

/** "Your day" row: "Good time to call Mum until 21:00". Nothing with nobody saved. */
export function CallHomeBriefRow({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [store] = useCallHome();
  const now = useMinute();
  const b = useMemo(() => briefCall(trip, store, now), [trip, store, now]);
  if (!b) return null;
  const name = b.person.name;
  const line =
    b.kind === 'now'
      ? t('callhome.brief.now', { name, until: showClock(t, b.at) })
      : b.kind === 'later'
        ? t(b.dayOffset ? 'callhome.brief.tomorrow' : 'callhome.brief.today', { name, from: b.at })
        : t('callhome.brief.none', { name });
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={line}
        accessibilityHint={t('callhome.brief.hint')}
        onPress={() => router.push({ pathname: '/callhome', params: { tripId: trip.id } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="call-outline" size={18} color={theme.heroAccent} />
        </View>
        <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk, flex: 1 }]}>
          {line}
        </Text>
      </PressableScale>
    </>
  );
}

/** Readiness card row (not scored): how many people back home are set up, one tap to the planner. */
export function CallHomeReadyRow({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [store] = useCallHome();
  const n = store.people.length;
  const detail = n === 0 ? t('callhome.ready.none') : n === 1 ? t('callhome.ready.one') : t('callhome.ready.some', { n });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('callhome.ready.a11y', { detail })}
      accessibilityHint={t('callhome.openHint')}
      onPress={() => router.push({ pathname: '/callhome', params: { tripId: trip.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s, borderTopWidth: 1, borderTopColor: theme.line }}
    >
      <IconBadge name="call-outline" tone="sea" size="s" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('callhome.ready.title')}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{detail}</Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </View>
    </PressableScale>
  );
}

/** "Plan calls home" button (Jet lag screen). */
export function CallHomeButton({ tripId }: { tripId: string }) {
  const { t } = useApp();
  const router = useRouter();
  return (
    <Button
      label={t('callhome.open')}
      hint={t('callhome.openHint')}
      kind="secondary"
      icon="call-outline"
      onPress={() => router.push({ pathname: '/callhome', params: { tripId } })}
    />
  );
}

/** Today and tomorrow for one person (for the right-now card), with the trip's hand-set day zones (T116). */
export function useNextDays(trip: Trip, store: CallHomeStore, person: CallPerson, now: number): CallDay[] {
  const zones = dayZonesFor(store, trip.id);
  return useMemo(() => daysFrom(trip, now, store.me, person, 2, zones), [trip, now, store.me, person, zones]);
}
