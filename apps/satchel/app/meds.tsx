// T101 Medicine times across time zones (owner-1031 D, deepen Emergency + Trips). Reached from the Emergency tab and
// from each trip (?tripId=). The traveller keeps a list of medicines with their usual home times (fixed clock times or
// every N hours), only on this phone (src/state/meds.ts; never in .satchel trip files, never shared unless Share is
// tapped). For a trip it shows, per stop (zones from the bookings), the times under one of two plans: "Keep home
// time" (same moment, local clock shown) or "Shift to local time" (same clock locally; every-N-hours medicines move
// gradually, never below the medicine's own shortest gap). Doses in the usual sleep hours (Settings) are flagged.
// The "general guidance only - ask your doctor or pharmacist" line is always on screen. Maths: src/core/medtimes.ts.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { deviceZone, formatDay, todayIn, zoneCity } from '../src/core/format.ts';
import { homeZone } from '../src/core/jetlag.ts';
import {
  dailyTimes,
  draftFromMed,
  EVERY_CHOICES,
  gradualShift,
  jumpChangeMin,
  keepHomeRows,
  MAX_MEDS,
  MAX_TIMES,
  medFromDraft,
  medStops,
  minGapChoices,
  newMedDraft,
  parseClock,
  planFor,
  shiftDayTimes,
  removeMed,
  shiftLocalRows,
  STEP_CHOICES,
  upsertMed,
  type Med,
  type MedDraft,
  type MedError,
  type MedPlan,
  type MedStop,
  type MedStore,
} from '../src/core/medtimes.ts';
import { newId, type Trip } from '../src/core/model.ts';
import { orderTrips } from '../src/core/trips.ts';
import { tripPhase } from '../src/core/timeline.ts';
import type { T } from '../src/i18n/core.ts';
import { haptic } from '../src/native/device.ts';
import { shareText } from '../src/native/share.ts';
import { useApp } from '../src/state/app.tsx';
import { saveMeds, useMeds } from '../src/state/meds.ts';
import { useTrips } from '../src/state/trips.tsx';
import { fonts, radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { TimeField } from '../src/ui/DateTimeField.tsx';
import { FadeInView, SectionCard } from '../src/ui/hero.tsx';
import { useSleep } from '../src/ui/JetLagCard.tsx';
import { Body, Button, Chip, Label, PressableScale, Screen, TextField, Warning } from '../src/ui/kit.tsx';

/** "7 h", "7 h 30 min", "45 min" for a length of time in minutes (sign dropped). */
function dur(t: T, min: number): string {
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return t('meds.mins', { m: r });
  return r ? t('meds.hoursMin', { h, m: r }) : t('meds.hours', { h });
}

function dayNote(t: T, shift: number): string {
  if (shift === 1) return t('meds.day.next');
  if (shift > 1) return t('meds.day.later', { n: shift });
  if (shift === -1) return t('meds.day.prev');
  if (shift < -1) return t('meds.day.earlier', { n: -shift });
  return '';
}

function scheduleText(t: T, m: Med): string {
  return m.mode === 'interval' ? t('meds.list.interval', { h: m.everyHours ?? 24, time: m.firstAt ?? '' }) : t('meds.list.fixed', { times: m.times.join(' · ') });
}

/** Stop clock against home in words: "9 h ahead of home". */
function diffText(t: T, stop: MedStop): string {
  const d = jumpChangeMin(stop);
  if (!d) return t('meds.stop.same');
  return t(d > 0 ? 'meds.stop.ahead' : 'meds.stop.behind', { d: dur(t, d) });
}

export default function MedsScreen() {
  const { t, theme, lang } = useApp();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const { trips } = useTrips();
  const [store] = useMeds();
  const { bed, wake } = useSleep();
  const [editing, setEditing] = useState<{ id: string | null; draft: MedDraft } | null>(null);
  const [errors, setErrors] = useState<MedError[]>([]);
  const [saveError, setSaveError] = useState(false);
  const [shareError, setShareError] = useState(false);

  const phone = deviceZone();
  const choices = useMemo(() => {
    const today = todayIn(phone);
    return orderTrips(trips, today).filter((tr) => tripPhase(tr, today) !== 'past');
  }, [trips, phone]);
  const [pickedId, setPickedId] = useState<string | null>(params.tripId ?? null);
  const trip: Trip | null = trips.find((tr) => tr.id === pickedId) ?? (params.tripId ? null : choices[0] ?? null);
  const home = trip ? homeZone(trip, phone) : phone;
  const stops = useMemo(() => (trip ? medStops(trip, home) : []), [trip, home]);
  const plan: MedPlan = trip ? planFor(store, trip.id) : 'home';

  const save = async (change: (old: MedStore) => MedStore) => {
    setSaveError(false);
    const ok = await saveMeds(change);
    if (!ok) setSaveError(true);
    return ok;
  };

  const submit = async () => {
    if (!editing) return;
    const id = editing.id ?? newId('med');
    const r = medFromDraft(editing.draft, id);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    let full = false;
    const ok = await save((old) => {
      const list = upsertMed(old.meds, r.med);
      if (!list) {
        full = true;
        return old;
      }
      return { ...old, meds: list };
    });
    if (ok && !full) {
      haptic.success();
      setEditing(null);
      setErrors([]);
    }
  };

  const setPlan = (p: MedPlan) => trip && save((old) => ({ ...old, plans: { ...old.plans, [trip.id]: p } }));
  const setStep = (s: number) => save((old) => ({ ...old, stepMin: s }));

  const share = async () => {
    setShareError(false);
    const lines: string[] = [t('meds.share.title'), '', t('meds.share.home', { city: zoneCity(home) })];
    for (const m of store.meds) lines.push(t('meds.share.line', { name: m.name, dose: m.dose, times: dailyTimes(m).join(', ') }).replace(/ +:/, ':'));
    for (const s of stops) {
      lines.push('', t('meds.share.stop', { city: zoneCity(s.tz), dates: t('meds.stop.dates', { from: formatDay(s.firstDate, lang), to: formatDay(s.lastDate, lang) }) }));
      for (const m of store.meds) {
        if (plan === 'local' && m.mode === 'interval') {
          // T104: the gradual shift, one line per day with that day's times on the local clock.
          const p = gradualShift(m, home, s.tz, s.startUtc, s.endUtc, store.stepMin, bed, wake);
          lines.push(t('meds.share.line', { name: m.name, dose: m.dose, times: '' }).replace(/ +:/, ':').trim());
          for (const d of shiftDayTimes(p)) lines.push(t('f95.share.day', { date: formatDay(d.date, lang), times: d.times.join(', ') }));
          for (const c of p.clockChanges) lines.push(t('f95.share.clock', { date: formatDay(c.on, lang) }));
          lines.push(t(p.reachedOn || p.shiftMin === 0 ? 'f95.share.then' : 'f95.share.notReached', { times: dailyTimes(m).join(', ') }));
          continue;
        }
        const times =
          plan === 'home'
            ? keepHomeRows(m, s, home, bed, wake).map((r) => {
                const first = `${r.local}${dayNote(t, r.dayShift) ? ` ${dayNote(t, r.dayShift)}` : ''}`;
                return r.later ? t('f95.share.later', { first, date: formatDay(r.later.from, lang), local: `${r.later.local}${dayNote(t, r.later.dayShift) ? ` ${dayNote(t, r.later.dayShift)}` : ''}` }) : first;
              })
            : dailyTimes(m);
        lines.push(t('meds.share.line', { name: m.name, dose: m.dose, times: times.join(', ') }).replace(/ +:/, ':'));
      }
    }
    lines.push('', t('meds.guidance'));
    if ((await shareText(lines.join('\n'), t('meds.share.title'))) === 'failed') setShareError(true);
  };

  return (
    <Screen>
      <FadeInView>
        <View style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
            {t('meds.title')}
          </Text>
          <Body muted>{t('meds.intro')}</Body>
        </View>
      </FadeInView>
      <Warning text={t('meds.guidance')} />

      <SectionCard title={t('meds.list.title')} icon="medkit-outline" tone="teal">
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('meds.privacy')}</Text>
        {store.meds.length === 0 && !editing ? <Body muted>{t('meds.list.empty')}</Body> : null}
        {store.meds.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('meds.list.edit', { name: m.name })}
              accessibilityHint={t('meds.list.editHint')}
              onPress={() => {
                setErrors([]);
                setEditing({ id: m.id, draft: draftFromMed(m) });
              }}
              style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card }}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{m.dose ? `${m.name} · ${m.dose}` : m.name}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{scheduleText(t, m)}</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('meds.list.remove', { name: m.name })}
              accessibilityHint={t('meds.list.removeHint')}
              onPress={() => save((old) => ({ ...old, meds: removeMed(old.meds, m.id) }))}
              style={{ width: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
            </PressableScale>
          </View>
        ))}
        {editing ? (
          <MedForm
            key={editing.id ?? 'new'}
            title={editing.id ? t('meds.form.editTitle') : t('meds.form.newTitle')}
            draft={editing.draft}
            errors={errors}
            onChange={(draft) => setEditing({ ...editing, draft })}
            onSave={submit}
            onCancel={() => {
              setEditing(null);
              setErrors([]);
            }}
          />
        ) : store.meds.length < MAX_MEDS ? (
          <Button
            kind="secondary"
            icon="add-outline"
            label={t('meds.list.add')}
            hint={t('meds.list.addHint')}
            onPress={() => {
              setErrors([]);
              setEditing({ id: null, draft: newMedDraft() });
            }}
          />
        ) : (
          <Body muted>{t('meds.list.full')}</Body>
        )}
        {saveError ? <Warning text={t('meds.list.saveFailed')} /> : null}
      </SectionCard>

      <SectionCard title={t('meds.trip.title')} icon="airplane-outline" tone="sea">
        {!params.tripId && choices.length > 1 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('meds.trip.pick')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {choices.map((tr) => (
              <Chip key={tr.id} label={tr.name} selected={trip?.id === tr.id} hint={t('meds.trip.pickHint')} onPress={() => setPickedId(tr.id)} />
            ))}
          </View>
        ) : null}
        {!trip ? (
          <Body muted>{t('meds.trip.none')}</Body>
        ) : (
          <>
            <Label>{trip.name}</Label>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('meds.trip.home', { city: zoneCity(home) })}</Text>
            <Label>{t('meds.plan.title')}</Label>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('meds.plan.pick')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              <Chip label={t('meds.plan.home')} selected={plan === 'home'} hint={t('meds.plan.hint')} onPress={() => setPlan('home')} />
              <Chip label={t('meds.plan.local')} selected={plan === 'local'} hint={t('meds.plan.hint')} onPress={() => setPlan('local')} />
            </View>
            <Body muted>{plan === 'home' ? t('meds.plan.homeBody') : t('meds.plan.localBody')}</Body>
            {plan === 'local' && store.meds.some((m) => m.mode === 'interval') ? (
              <>
                <Label>{t('meds.plan.step')}</Label>
                <View accessibilityRole="radiogroup" accessibilityLabel={t('meds.plan.step')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                  {STEP_CHOICES.map((s) => (
                    <Chip key={s} label={t('meds.plan.stepOption', { h: s / 60 })} selected={store.stepMin === s} hint={t('meds.plan.stepHint')} onPress={() => setStep(s)} />
                  ))}
                </View>
              </>
            ) : null}
            {stops.length === 0 ? <Body muted>{t('meds.trip.noStops')}</Body> : null}
          </>
        )}
      </SectionCard>

      {trip && store.meds.length
        ? stops.map((s) => <StopCard key={`${s.tz}-${s.startUtc}`} stop={s} meds={store.meds} plan={plan} home={home} step={store.stepMin} bed={bed} wake={wake} />)
        : null}

      {store.meds.length ? (
        <View style={{ gap: space.s }}>
          <Button kind="secondary" icon="share-outline" label={t('meds.share')} hint={t('meds.shareHint')} onPress={share} />
          {shareError ? <Warning text={t('meds.shareFailed')} /> : null}
        </View>
      ) : null}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('meds.guidance')}</Text>
    </Screen>
  );
}

function MedForm({
  title,
  draft,
  errors,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  draft: MedDraft;
  errors: MedError[];
  onChange: (d: MedDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t, theme } = useApp();
  // T104: times are set with the system time picker (typed text only where the picker isn't available).
  const [pending, setPending] = useState('08:00');
  const [timeError, setTimeError] = useState<string | null>(null);
  const set = (patch: Partial<MedDraft>) => onChange({ ...draft, ...patch });

  const addTime = () => {
    const c = parseClock(pending);
    if (!c) return setTimeError(t('meds.form.timeBad'));
    if (draft.times.length >= MAX_TIMES) return setTimeError(t('meds.form.timesFull'));
    if (draft.times.includes(c)) return setTimeError(t('f95.time.already', { time: c }));
    setTimeError(null);
    set({ times: [...draft.times, c].sort() });
  };

  return (
    <View style={{ gap: space.m, paddingTop: space.s, borderTopWidth: 1, borderColor: theme.line }}>
      <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
        {title}
      </Text>
      <TextField label={t('meds.form.name')} value={draft.name} onChange={(name) => set({ name })} placeholder={t('meds.form.namePlaceholder')} error={errors.includes('name') ? t('meds.form.err.name') : undefined} />
      <TextField label={t('meds.form.dose')} value={draft.dose} onChange={(dose) => set({ dose })} placeholder={t('meds.form.dosePlaceholder')} />
      <Label>{t('meds.form.mode')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('meds.form.mode')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <Chip label={t('meds.form.modeFixed')} selected={draft.mode === 'fixed'} hint={t('meds.form.modeHint')} onPress={() => set({ mode: 'fixed' })} />
        <Chip label={t('meds.form.modeInterval')} selected={draft.mode === 'interval'} hint={t('meds.form.modeHint')} onPress={() => set({ mode: 'interval' })} />
      </View>

      {draft.mode === 'fixed' ? (
        <View style={{ gap: space.s }}>
          <Label>{t('meds.form.times')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {draft.times.map((time) => (
              <Chip
                key={time}
                label={time}
                selected
                icon={<Ionicons name="close" size={16} color={theme.accentInk} />}
                a11yLabel={t('meds.form.removeTime', { time })}
                hint={t('meds.form.removeTimeHint')}
                onPress={() => set({ times: draft.times.filter((x) => x !== time) })}
              />
            ))}
          </View>
          <TimeField
            label={t('f95.time.new')}
            typedLabel={t('meds.form.timeField')}
            value={pending}
            zone=""
            hint={t('f95.time.newHint')}
            onChange={(v) => {
              setTimeError(null);
              setPending(v);
            }}
            error={timeError ?? (errors.includes('times') ? t('meds.form.err.times') : undefined)}
          />
          <Button kind="quiet" icon="add-outline" label={t('f95.time.add', { time: parseClock(pending) ?? pending })} hint={t('f95.time.addHint')} onPress={addTime} />
        </View>
      ) : (
        <View style={{ gap: space.s }}>
          <Label>{t('meds.form.every')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('meds.form.every')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {EVERY_CHOICES.map((h) => (
              <Chip
                key={h}
                label={t('meds.form.everyOption', { h })}
                selected={draft.everyHours === h}
                hint={t('meds.form.everyHint')}
                onPress={() => set({ everyHours: h, minGapMin: minGapChoices(h).includes(draft.minGapMin) ? draft.minGapMin : h * 60 - 60 })}
              />
            ))}
          </View>
          <TimeField
            label={t('f95.time.first')}
            typedLabel={t('meds.form.firstAt')}
            value={draft.firstAt}
            zone=""
            hint={t('f95.time.firstHint')}
            onChange={(v) => set({ firstAt: parseClock(v) ?? v })}
            error={errors.includes('firstAt') ? t('meds.form.err.firstAt') : undefined}
          />
          <Label>{t('meds.form.minGap')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('meds.form.minGap')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {minGapChoices(draft.everyHours).map((g) => (
              <Chip key={g} label={dur(t, g)} a11yLabel={t('meds.form.minGapOption', { gap: dur(t, g) })} selected={draft.minGapMin === g} hint={t('meds.form.minGapHint')} onPress={() => set({ minGapMin: g })} />
            ))}
          </View>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('meds.form.minGapHint')}</Text>
        </View>
      )}
      <Button icon="checkmark-outline" label={t('meds.form.save')} hint={t('meds.form.saveHint')} onPress={onSave} />
      <Button kind="quiet" label={t('meds.form.cancel')} hint={t('meds.form.cancelHint')} onPress={onCancel} />
    </View>
  );
}

function StopCard({ stop, meds, plan, home, step, bed, wake }: { stop: MedStop; meds: Med[]; plan: MedPlan; home: string; step: number; bed: string; wake: string }) {
  const { t, theme, lang } = useApp();
  const city = zoneCity(stop.tz);
  const dates = t('meds.stop.dates', { from: formatDay(stop.firstDate, lang), to: formatDay(stop.lastDate, lang) });
  const body = (night: boolean) => [typeScale.body, { color: night ? theme.warn : theme.ink }];
  let nights = 0;
  const blocks = meds.map((m) => {
    if (plan === 'home') {
      const rows = keepHomeRows(m, stop, home, bed, wake);
      nights += rows.filter((r) => r.night).length;
      return (
        <View key={m.id} style={{ gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{m.name}</Text>
          {rows.map((r) => {
            const line = `${t('meds.row.home', { home: r.home, local: r.local })} ${dayNote(t, r.dayShift)}`.trim();
            return (
              <View key={r.home} accessible accessibilityLabel={[line, r.night ? t('meds.row.night') : '', r.later ? t('meds.row.later', { date: formatDay(r.later.from, lang), local: r.later.local }) : ''].filter(Boolean).join('. ')}>
                <Text style={body(r.night)}>
                  {line}
                  {r.night ? ` · ${t('meds.row.night')}` : ''}
                </Text>
                {r.later ? (
                  <Text style={[typeScale.small, { color: theme.muted }]}>
                    {`${t('meds.row.later', { date: formatDay(r.later.from, lang), local: r.later.local })} ${dayNote(t, r.later.dayShift)}`.trim()}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      );
    }
    if (m.mode === 'fixed') {
      const rows = shiftLocalRows(m, bed, wake);
      nights += rows.filter((r) => r.night).length;
      const jump = jumpChangeMin(stop);
      return (
        <View key={m.id} style={{ gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{m.name}</Text>
          {rows.map((r) => (
            <Text key={r.local} style={body(r.night)}>
              {t('meds.row.local', { local: r.local })}
              {r.night ? ` · ${t('meds.row.night')}` : ''}
            </Text>
          ))}
          {jump ? <Text style={[typeScale.small, { color: theme.muted }]}>{t(jump > 0 ? 'meds.jump.shorter' : 'meds.jump.longer', { d: dur(t, jump) })}</Text> : null}
        </View>
      );
    }
    const p = gradualShift(m, home, stop.tz, stop.startUtc, stop.endUtc, step, bed, wake);
    // Show the days up to the one it reaches local time (or the whole stop), at most 10.
    const shown = shiftDayTimes(p);
    const moving = p.shiftMin !== 0 || p.clockChanges.length > 0;
    nights += shown.reduce((n, d) => n + d.doses.filter((x) => x.night).length, 0);
    const summary =
      p.shiftMin === 0
        ? t('meds.shift.none')
        : p.shiftMin < 0
          ? t('meds.shift.earlier', { d: dur(t, p.shiftMin), step: dur(t, p.stepMin), gap: dur(t, m.minGapMin ?? 0) })
          : t('meds.shift.later', { d: dur(t, p.shiftMin), step: dur(t, p.stepMin) });
    return (
      <View key={m.id} style={{ gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{m.name}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{summary}</Text>
        {moving
          ? shown.map((d) => {
              const times = d.doses.map((x) => (x.changed && x.gapMin !== null ? t('meds.shift.gap', { time: x.local.slice(11, 16), gap: dur(t, x.gapMin) }) : x.local.slice(11, 16))).join(', ');
              const night = d.doses.some((x) => x.night);
              return (
                <Text key={d.date} style={body(night)}>
                  {t('meds.shift.day', { date: formatDay(d.date, lang), times })}
                  {night ? ` · ${t('meds.row.night')}` : ''}
                </Text>
              );
            })
          : null}
        {p.clockChanges.map((c) => (
          <Text key={c.on} style={[typeScale.small, { color: theme.muted }]}>
            {t('f95.shift.clock', { date: formatDay(c.on, lang) })}
          </Text>
        ))}
        {moving ? <Text style={[typeScale.small, { color: theme.muted }]}>{p.reachedOn ? t('meds.shift.reached', { date: formatDay(p.reachedOn, lang) }) : t('meds.shift.notReached')}</Text> : null}
        {p.reachedOn || !moving ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('meds.shift.more', { h: m.everyHours ?? 24 })}</Text> : null}
      </View>
    );
  });

  return (
    <SectionCard title={city} subtitle={`${dates} · ${diffText(t, stop)}`} icon="time-outline" tone="accent">
      {nights > 0 ? <Warning text={nights === 1 ? t('meds.stop.nightOne', { bed, wake }) : t('meds.stop.nightCount', { n: nights, bed, wake })} /> : null}
      {blocks}
    </SectionCard>
  );
}
