// T66 jet lag and time zones: the trip-screen card ("Home vs here" clocks, the next good time to call home and a
// link to the plan) and the pieces the Time zones screen (app/jetlag.tsx) is built from. All maths is in
// src/core/jetlag.ts. Colours are theme tokens (light and dark); motion is FadeInView only (timed, no springs).
// T68: bed and wake times come from Settings ("Usual sleep"); awake hours for calls run from wake to bed, and the
// finder looks at today and the next three home days.
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { deviceZone, formatDay, zoneCity } from '../core/format.ts';
import { formatOffset } from '../core/glance.ts';
import { awakeHours, CALL_DAYS_AHEAD, callDays, jetLagView, nextCall, windowNow, WORKING, type CallDay, type CallWindow, type JetLagView, type LegPlan, type Range } from '../core/jetlag.ts';
import type { Trip } from '../core/model.ts';
import { fromUtc, localDate } from '../core/tz.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, SectionCard } from './hero.tsx';
import { Button, Chip } from './kit.tsx';

/** Now, refreshed every minute (the clocks have no seconds). */
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** The usual-sleep setting (Settings, T68) and the awake hours it gives the call finder. */
export function useSleep(): { bed: string; wake: string; awake: Range } {
  const { prefs } = useApp();
  const bed = prefs.sleepBed;
  const wake = prefs.sleepWake;
  const awake = useMemo(() => awakeHours(wake, bed), [wake, bed]);
  return { bed, wake, awake };
}

/** The trip's jet-lag view at the current minute (null when it never leaves the home clock). */
export function useJetLag(trip: Trip | undefined): { view: JetLagView | null; now: number } {
  const now = useMinute();
  const { bed, wake } = useSleep();
  const view = useMemo(() => (trip ? jetLagView(trip, deviceZone(), now, wake, bed) : null), [trip, now, wake, bed]);
  return { view, now };
}

/** "9h", "5h 30m": a clock gap without its sign. */
const gap = (min: number) => formatOffset(Math.abs(min)).replace(/^[+−]/, '');

/** "Tokyo is 9h ahead of home" / "... behind home" / "... same time as home". */
export function diffText(t: T, view: JetLagView): string {
  const city = view.there ? zoneCity(view.there.tz) : '';
  if (!view.diffNow) return t('jetlag.same', { city });
  return t(view.diffNow > 0 ? 'jetlag.ahead' : 'jetlag.behind', { city, d: gap(view.diffNow) });
}

function Clock({ label, tz, now, homeDate, big }: { label: string; tz: string; now: number; homeDate: string; big?: boolean }) {
  const { t, theme } = useApp();
  const wall = fromUtc(now, tz);
  const time = wall.slice(11, 16);
  const date = localDate(wall);
  const day = date > homeDate ? t('jetlag.nextDay') : date < homeDate ? t('jetlag.prevDay') : '';
  const city = zoneCity(tz);
  return (
    <View accessible accessibilityLabel={t('jetlag.clockA11y', { label, city, time, day })} style={{ flex: 1, gap: 2 }}>
      <Text style={[typeScale.caption, { color: theme.muted }]}>{label}</Text>
      <Text style={[big ? typeScale.displayXL : typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{time}</Text>
      <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.teal }]}>
        {city}
      </Text>
      {day ? <Text style={[typeScale.small, { color: theme.muted }]}>{day}</Text> : null}
    </View>
  );
}

/** "Home vs here": two live clocks side by side and how far apart they are. */
export const ClockPair = memo(function ClockPair({ view, now, big }: { view: JetLagView; now: number; big?: boolean }) {
  const { t, theme } = useApp();
  if (!view.there) return null;
  const homeDate = localDate(fromUtc(now, view.home));
  return (
    <View style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', gap: space.l }}>
        <Clock label={t('jetlag.home')} tz={view.home} now={now} homeDate={homeDate} big={big} />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: theme.line }} />
        <Clock label={t(view.there.kind === 'here' ? 'jetlag.here' : 'jetlag.there')} tz={view.there.tz} now={now} homeDate={homeDate} big={big} />
      </View>
      <Text style={[typeScale.small, { color: theme.muted }]}>{diffText(t, view)}</Text>
    </View>
  );
});

const range = (r: Range) => ({ from: r.from, to: r.to });

function windowVars(w: CallWindow, city: string) {
  return { city, thereFrom: w.there.from, thereTo: w.there.to, homeFrom: w.home.from, homeTo: w.home.to };
}

/** Call windows for today and the next CALL_DAYS_AHEAD home days, for a pair of zones. */
function useCallDays(view: JetLagView, now: number, hours: Range): CallDay[] {
  const thereTz = view.there?.tz ?? null;
  const homeDate = localDate(fromUtc(now, view.home));
  return useMemo(() => (thereTz ? callDays(view.home, thereTz, homeDate, hours) : []), [view.home, thereTz, homeDate, hours.from, hours.to]);
}

/** One line for the trip card: now is good, the next good time (today or a later day), or no overlap. */
function CallSummary({ view, now }: { view: JetLagView; now: number }) {
  const { t, theme, lang } = useApp();
  const { awake } = useSleep();
  const days = useCallDays(view, now, awake);
  if (!view.there) return null;
  const city = zoneCity(view.there.tz);
  const next = nextCall(days, now);
  const today = days[0]?.date;
  const text =
    next && now >= next.window.startUtc
      ? t('jetlag.call.now')
      : next && next.date === today
        ? t('jetlag.call.next', windowVars(next.window, city))
        : next
          ? t('jetlag.call.nextOn', { ...windowVars(next.window, city), day: formatDay(next.date, lang) })
          : t('jetlag.call.noneAhead', { ...range(awake), days: CALL_DAYS_AHEAD + 1 });
  return (
    <View accessible style={{ gap: 2 }}>
      <Text style={[typeScale.caption, { color: theme.muted }]}>{t('jetlag.call.title')}</Text>
      <Text style={[typeScale.body, { color: theme.ink }]}>{text}</Text>
    </View>
  );
}

/** The good-time-to-call finder: awake or working hours, every window today and the next days, or "no overlap" plainly. */
export function CallFinder({ view, now }: { view: JetLagView; now: number }) {
  const { t, theme, lang } = useApp();
  const { awake } = useSleep();
  const [working, setWorking] = useState(false);
  const hours = working ? WORKING : awake;
  const days = useCallDays(view, now, hours);
  if (!view.there) return null;
  const city = zoneCity(view.there.tz);
  const current = windowNow(days[0]?.windows ?? [], now);
  const anyWindow = days.some((d) => d.windows.some((w) => w.endUtc > now));
  return (
    <SectionCard title={t('jetlag.call.title')} icon="call-outline" tone="sea">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('jetlag.call.title')}>
        <Chip label={t('jetlag.call.hoursA11y', { name: t('jetlag.call.awake'), ...range(awake) })} selected={!working} onPress={() => setWorking(false)} />
        <Chip label={t('jetlag.call.hoursA11y', { name: t('jetlag.call.working'), ...range(WORKING) })} selected={working} onPress={() => setWorking(true)} />
      </View>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('jetlag.call.basis', { ...range(hours), days: CALL_DAYS_AHEAD })}</Text>
      {current ? <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{t('jetlag.call.now')}</Text> : null}
      {!anyWindow ? (
        <View accessible style={{ backgroundColor: theme.warnSoft, borderRadius: radius.m, padding: space.m }}>
          <Text style={[typeScale.body, { color: theme.ink }]}>{t('jetlag.call.noneAhead', { ...range(hours), days: CALL_DAYS_AHEAD + 1 })}</Text>
        </View>
      ) : (
        days.map((d, k) => {
          const ws = d.windows.filter((w) => w.endUtc > now);
          return (
            <View key={d.date} style={{ gap: space.xs }}>
              <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted, marginTop: k ? space.s : 0 }]}>
                {k === 0 ? t('jetlag.call.today') : t('jetlag.call.dayHeader', { day: formatDay(d.date, lang) })}
              </Text>
              {ws.length === 0 ? (
                <Text style={[typeScale.small, { color: theme.ink }]}>{k === 0 ? t('jetlag.call.none', range(hours)) : t('jetlag.call.noneDay')}</Text>
              ) : (
                ws.map((w) => (
                  <View
                    key={w.startUtc}
                    accessible
                    accessibilityLabel={t('jetlag.call.windowA11y', windowVars(w, city))}
                    style={{ backgroundColor: w === current ? theme.okSoft : theme.seaSoft, borderRadius: radius.m, paddingHorizontal: space.m, paddingVertical: space.s }}
                  >
                    <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('jetlag.call.window', windowVars(w, city))}</Text>
                  </View>
                ))
              )}
            </View>
          );
        })
      )}
    </SectionCard>
  );
}

/** "Flying east: clocks go 9h ahead". */
export const legSummary = (t: T, p: LegPlan) => t(p.leg.direction === 'east' ? 'jetlag.plan.east' : 'jetlag.plan.west', { d: gap(p.leg.shift) });

/** One flight journey's plan: sleep days before, light windows after, and what to do next. */
export function PlanSection({ plan, today }: { plan: LegPlan; today: string }) {
  const { t, theme, lang } = useApp();
  const { leg } = plan;
  const upcoming = plan.before.filter((d) => d.date >= today);
  const passed = upcoming.length < plan.before.length;
  return (
    <View style={{ gap: space.s }}>
      <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
        {t(leg.which === 'outbound' ? 'jetlag.plan.outbound' : 'jetlag.plan.return')}
      </Text>
      <Text style={[typeScale.body, { color: theme.ink }]}>
        {t('jetlag.plan.leg', { from: zoneCity(leg.fromTz), to: zoneCity(leg.toTz), day: formatDay(localDate(leg.departs.local), lang) })}
      </Text>
      <Text style={[typeScale.bodyStrong, { color: theme.teal }]}>{legSummary(t, plan)}</Text>

      <Text style={[typeScale.caption, { color: theme.muted, marginTop: space.s }]}>{t('jetlag.plan.before')}</Text>
      <Text style={[typeScale.small, { color: theme.ink }]}>{t(leg.direction === 'east' ? 'jetlag.plan.beforeEast' : 'jetlag.plan.beforeWest')}</Text>
      {upcoming.map((d) => {
        const vars = { day: formatDay(d.date, lang), bed: d.bed, wake: d.wake };
        return (
          <View key={d.date} accessible accessibilityLabel={t('jetlag.plan.sleepDayA11y', vars)} style={{ backgroundColor: theme.tealSoft, borderRadius: radius.m, paddingHorizontal: space.m, paddingVertical: space.s }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('jetlag.plan.sleepDay', vars)}</Text>
          </View>
        );
      })}
      {passed ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('jetlag.plan.passed')}</Text> : null}

      <Text style={[typeScale.caption, { color: theme.muted, marginTop: space.s }]}>{t('jetlag.plan.after')}</Text>
      {plan.arrival.length === 0 ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('jetlag.plan.closeAlready')}</Text> : null}
      {plan.arrival.map((d) => (
        <View key={d.date} style={{ gap: space.xs, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{formatDay(d.date, lang)}</Text>
          {d.seek.map((r) => (
            <Text key={`s${r.from}`} accessibilityLabel={t('jetlag.plan.seekA11y', range(r))} style={[typeScale.body, { color: theme.ok, fontVariant: ['tabular-nums'] }]}>
              {t('jetlag.plan.seek', range(r))}
            </Text>
          ))}
          {d.avoid.map((r) => (
            <Text key={`a${r.from}`} accessibilityLabel={t('jetlag.plan.avoidA11y', range(r))} style={[typeScale.body, { color: theme.warn, fontVariant: ['tabular-nums'] }]}>
              {t('jetlag.plan.avoid', range(r))}
            </Text>
          ))}
          {!d.seek.length && !d.avoid.length ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('jetlag.plan.localTimes')}</Text> : null}
        </View>
      ))}
      {plan.arrival.length ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('jetlag.plan.settled')}</Text> : null}
    </View>
  );
}

/** The disclaimer, always shown with a plan. */
export function Disclaimer() {
  const { t, theme } = useApp();
  const { bed, wake } = useSleep();
  return (
    <View accessible style={{ backgroundColor: theme.warnSoft, borderRadius: radius.m, borderLeftWidth: 4, borderLeftColor: theme.warn, padding: space.m, gap: space.xs }}>
      <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('jetlag.plan.disclaimer')}</Text>
      <Text style={[typeScale.small, { color: theme.ink }]}>{t('jetlag.plan.basis', { bed, wake })}</Text>
    </View>
  );
}

/** Trip-screen card: Home vs here clocks, the next good time to call, and the plan link. Nothing for a trip at home. */
export function JetLagCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const { view, now } = useJetLag(trip);
  if (!view) return null;
  const plan = view.plans[0];
  return (
    <FadeInView>
      <SectionCard title={t('jetlag.title')} icon="time-outline" tone="teal">
        <ClockPair view={view} now={now} />
        <CallSummary view={view} now={now} />
        {plan ? (
          <View style={{ gap: 2 }}>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{t('jetlag.plan.title')}</Text>
            <Text style={[typeScale.body, { color: theme.ink }]}>{t('jetlag.plan.ready', { summary: legSummary(t, plan) })}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('jetlag.plan.disclaimer')}</Text>
          </View>
        ) : null}
        <Button label={t('jetlag.open')} hint={t('jetlag.openHint')} kind="secondary" icon="globe-outline" onPress={() => router.push({ pathname: '/jetlag', params: { tripId: trip.id } })} />
      </SectionCard>
    </FadeInView>
  );
}
