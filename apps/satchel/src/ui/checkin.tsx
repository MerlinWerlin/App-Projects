// T143 check-in times (logic in src/core/checkin.ts; every time on the booking's own clock, offline).
// - CheckinTripCard: the trip-screen card, next window first (open / overdue, then the next to open), each row opens
//   its booking. An original boarding-gate drawing (react-native-svg, theme tokens only) fades in with a timed
//   transition (FadeInView, motion.ts); with Reduce Motion it is simply shown.
// - ItemCheckinSlot: on a booking's screen: its windows, "Mark checked in", a Calendar reminder (src/core/ics.ts
//   primitives, shared like Add to Calendar) and the per-booking settings (opening hours 24/30/36/48/72 or custom,
//   closing and bag-drop minutes, car desk hours). Saved on the Item as `checkin`.
// - CheckinBriefRow: the Your day row "Online check-in for EA 25 opens 09:15 today".
// - checkinDetail: the readiness row's sentence.
// Defaults are always labelled "Usual time, check your booking"; no company is named and no rule is claimed.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import {
  CHECKIN_OPENS_H,
  CLOSE_STEP,
  MAX_CLOSE_MIN,
  MAX_OPENS_H,
  OPENS_CHOICES,
  USUAL_CLOSE_MIN,
  briefCheckin,
  briefCheckout,
  flightScope,
  isDone,
  isOut,
  itemStatus,
  pickupOutsideDesk,
  readCheckin,
  reminderIcs,
  setDone,
  setOut,
  splitMinutes,
  tripStatus,
  windowsFor,
  withCheckin,
  type CheckinInfo,
  type Moment,
  type WindowStatus,
} from '../core/checkin.ts';
import { formatDay, todayIn, zoneCity } from '../core/format.ts';
import { isClock, readAirport } from '../core/leaveby.ts';
import type { Item, Trip } from '../core/model.ts';
import type { Check } from '../core/readiness.ts';
import { addDays, localDate, localTime } from '../core/tz.ts';
import type { T } from '../i18n/core.ts';
import { shareCalendarFile } from '../native/calendarFile.ts';
import { useApp } from '../state/app.tsx';
import { useTrips } from '../state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, SectionCard } from './hero.tsx';
import { useMinute } from './JetLagCard.tsx';
import { Body, Button, Chip, Label, PressableScale, TextField, ToggleRow } from './kit.tsx';

// ------------------------------------------------------------------ text helpers

export function durText(t: T, min: number): string {
  const { d, h, m } = splitMinutes(min);
  if (d) return h ? t('checkin.dur.dh', { d, h }) : t('checkin.dur.d', { d });
  if (h) return m ? t('checkin.dur.hm', { h, m }) : t('checkin.dur.h', { h });
  return t('checkin.dur.m', { m });
}

/** "09:15 today" / "09:15 tomorrow" / "09:15 Tue 3 Apr" on the window's clock (+ ", Tokyo time" when asked). */
export function whenText(t: T, m: Moment, tz: string, now: number, lang: string, city = false): string {
  const time = localTime(m.local);
  const day = localDate(m.local);
  const today = todayIn(tz, now);
  const w =
    day === today
      ? t('checkin.when.today', { time })
      : day === addDays(today, 1)
        ? t('checkin.when.tomorrow', { time })
        : day === addDays(today, -1)
          ? t('checkin.when.yesterday', { time })
          : t('checkin.when.day', { time, day: formatDay(day, lang) });
  return city ? t('checkin.when.zone', { when: w, city: zoneCity(tz) }) : w;
}

export function kindText(t: T, s: WindowStatus): string {
  const w = s.window;
  if (w.kind === 'online') return w.opens ? t('checkin.kind.online') : t('checkin.kind.counter');
  return t(`checkin.kind.${w.kind}`);
}

export function stateText(t: T, s: WindowStatus, now: number, lang: string, city = false): string {
  const w = s.window;
  const when = (m: Moment) => whenText(t, m, w.tz, now, lang, city);
  if (s.state === 'done') return w.kind === 'stayOut' ? t('f106.checkout.state.done') : t('checkin.state.done');
  if (s.state === 'past') return t('checkin.state.past');
  if (w.kind === 'desk' && w.opens && w.closes) {
    const hours = t('checkin.state.deskHours', { from: localTime(w.opens.local), to: localTime(w.closes.local) });
    return s.state === 'later' && s.minutes !== null ? `${hours} · ${t('checkin.state.opensIn', { in: durText(t, s.minutes), when: when(w.opens) })}` : hours;
  }
  if (w.kind === 'stayIn' && w.opens) {
    if (s.state === 'later') return s.minutes !== null && s.minutes < 48 * 60 ? t('checkin.state.stayFromIn', { when: when(w.opens), in: durText(t, s.minutes) }) : t('checkin.state.stayFrom', { when: when(w.opens) });
    return t('checkin.state.stayOpen', { when: when(w.opens) });
  }
  if (w.kind === 'stayOut' && w.closes) return t('checkin.state.stayBy', { when: when(w.closes) });
  if (s.state === 'later' && w.opens && s.minutes !== null) return t('checkin.state.opensIn', { in: durText(t, s.minutes), when: when(w.opens) });
  if (s.state === 'overdue' && w.closes) return t('checkin.state.overdue', { when: when(w.closes) });
  if (s.state === 'open' && w.closes) return w.opens ? t('checkin.state.openCloses', { when: when(w.closes) }) : t('checkin.state.closesIn', { in: durText(t, s.minutes ?? 0), when: when(w.closes) });
  return '';
}

/** What the readiness row says. */
export function checkinDetail(t: T, c: Check): string {
  if (c.reason === 'overdue') return t('checkin.readiness.overdue');
  if (c.reason === 'open') return (c.done ?? 0) === 1 ? t('checkin.readiness.openOne') : t('checkin.readiness.openMany', { n: c.done ?? 0 });
  return t('checkin.readiness.ok');
}

const itemName = (i: Item) => (i.number ?? '').trim() || i.title.trim() || '';

// ------------------------------------------------------------------ art

/** Original drawing: a boarding gate with a clock (journeys) or a room key with a clock (stays). Tokens only. */
function CheckinArt({ stay }: { stay: boolean }) {
  const { t, theme } = useApp();
  return (
    <FadeInView>
      <View accessible accessibilityRole="image" accessibilityLabel={t(stay ? 'checkin.artKey' : 'checkin.artGate')}>
        <Svg width={84} height={64} viewBox="0 0 84 64">
          <Rect x={2} y={54} width={80} height={4} rx={2} fill={theme.line} />
          {stay ? (
            <>
              <Circle cx={22} cy={30} r={12} stroke={theme.accent} strokeWidth={4} fill="none" />
              <Line x1={33} y1={30} x2={62} y2={30} stroke={theme.accent} strokeWidth={4} strokeLinecap="round" />
              <Line x1={54} y1={30} x2={54} y2={39} stroke={theme.accent} strokeWidth={4} strokeLinecap="round" />
              <Line x1={61} y1={30} x2={61} y2={37} stroke={theme.accent} strokeWidth={4} strokeLinecap="round" />
              <Rect x={14} y={44} width={22} height={8} rx={2} fill={theme.seaSoft} stroke={theme.sea} strokeWidth={1.5} />
            </>
          ) : (
            <>
              <Path d="M8 54 V18 Q8 10 16 10 H44 Q52 10 52 18 V54" stroke={theme.sea} strokeWidth={4} fill="none" strokeLinejoin="round" />
              <Rect x={16} y={18} width={28} height={9} rx={2} fill={theme.seaSoft} />
              <Line x1={20} y1={22.5} x2={38} y2={22.5} stroke={theme.sea} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 3" />
              <Path d="M22 54 V40 H38 V54" stroke={theme.muted} strokeWidth={2} fill="none" />
            </>
          )}
          <Circle cx={68} cy={18} r={12} fill={theme.cardRaised} stroke={theme.ink} strokeWidth={2} />
          <Line x1={68} y1={18} x2={68} y2={11} stroke={theme.ink} strokeWidth={2} strokeLinecap="round" />
          <Line x1={68} y1={18} x2={73} y2={21} stroke={theme.accent} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </View>
    </FadeInView>
  );
}

// ------------------------------------------------------------------ rows

const STATE_ICON: Record<WindowStatus['state'], 'time-outline' | 'radio-button-on' | 'alert-circle' | 'checkmark-circle' | 'remove-circle-outline'> = {
  later: 'time-outline',
  open: 'radio-button-on',
  overdue: 'alert-circle',
  done: 'checkmark-circle',
  past: 'remove-circle-outline',
};

function WindowRow({ s, now, city, name, onPress }: { s: WindowStatus; now: number; city: boolean; name?: string; onPress?: () => void }) {
  const { t, theme, lang } = useApp();
  const colour = s.state === 'overdue' ? theme.danger : s.state === 'open' ? theme.warn : s.state === 'done' ? theme.ok : theme.muted;
  const head = name ? `${kindText(t, s)} · ${name}` : kindText(t, s);
  const line = stateText(t, s, now, lang, city);
  const notes = [s.window.usual && s.state !== 'done' && s.state !== 'past' ? t('checkin.usual') : '', s.window.skipped ? t('checkin.skipped') : ''].filter(Boolean);
  const body = (
    <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start', minHeight: TOUCH, paddingVertical: space.xs }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
        <Ionicons name={STATE_ICON[s.state]} size={20} color={colour} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{head}</Text>
        <Text style={[typeScale.small, { color: s.state === 'overdue' ? theme.danger : theme.ink, fontVariant: ['tabular-nums'] }]}>{line}</Text>
        {notes.map((n) => (
          <Text key={n} style={[typeScale.caption, { color: theme.muted }]}>
            {n}
          </Text>
        ))}
      </View>
      {onPress ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center' }}>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      ) : null}
    </View>
  );
  const label = [head, line, ...notes].join('. ');
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('checkin.openItemHint')} onPress={onPress}>
      {body}
    </PressableScale>
  );
}

// ------------------------------------------------------------------ trip card

const TRIP_ROWS = 3;

/** The trip-screen card: the next windows first. Hidden when no booking has a window still to come. */
export function CheckinTripCard({ trip }: { trip: Trip }) {
  const { t } = useApp();
  const router = useRouter();
  const now = useMinute();
  const list = useMemo(() => tripStatus(trip, now).filter((s) => s.state !== 'done'), [trip, now]);
  if (!list.length) return null;
  const byId = new Map(trip.items.map((i) => [i.id, i]));
  const shown = list.slice(0, TRIP_ROWS);
  const stay = shown[0].window.kind === 'stayIn' || shown[0].window.kind === 'stayOut';
  return (
    <SectionCard title={t('checkin.title')} subtitle={t('checkin.tripSubtitle')} icon="time-outline" tone="sea">
      <CheckinArt stay={stay} />
      {shown.map((s) => {
        const it = byId.get(s.window.itemId);
        return (
          <WindowRow
            key={`${s.window.itemId}-${s.window.kind}`}
            s={s}
            now={now}
            city
            name={it ? itemName(it) : undefined}
            onPress={it ? () => router.push(`/item/${it.id}`) : undefined}
          />
        );
      })}
      {list.length > TRIP_ROWS ? <Body muted>{t('checkin.more', { n: list.length - TRIP_ROWS })}</Body> : null}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ booking slot

function useSaveCheckin(item: Item) {
  const { saveItem } = useTrips();
  const { t } = useApp();
  return async (next: CheckinInfo | undefined) => {
    if (!(await saveItem(withCheckin(item, next)))) Alert.alert(t('checkin.saveFailed.title'), t('checkin.saveFailed.body'));
  };
}

function OffsetStepper({ label, value, usual, onChange }: { label: string; value: number | undefined; usual: number; onChange: (v: number | undefined) => void }) {
  const { t, theme } = useApp();
  const n = value ?? usual;
  const text = value === undefined ? t('checkin.offset.usualValue', { n }) : t('checkin.offset.value', { n });
  const step = (dir: 1 | -1) => onChange(Math.max(0, Math.min(MAX_CLOSE_MIN, n + dir * CLOSE_STEP)));
  const btn = (dir: 1 | -1) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t(dir > 0 ? 'checkin.offset.moreA11y' : 'checkin.offset.lessA11y')}
      onPress={() => step(dir)}
      style={{ width: TOUCH, height: TOUCH, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardRaised }}
    >
      <Ionicons name={dir > 0 ? 'add' : 'remove'} size={20} color={theme.ink} />
    </PressableScale>
  );
  return (
    <View style={{ gap: space.xs }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        {btn(-1)}
        <Text accessibilityLiveRegion="polite" style={[typeScale.body, { color: theme.ink, flex: 1, fontVariant: ['tabular-nums'] }]}>
          {text}
        </Text>
        {btn(1)}
      </View>
      {value !== undefined ? <Button label={t('checkin.offset.reset')} hint={t('checkin.offset.resetHint')} kind="quiet" onPress={() => onChange(undefined)} /> : null}
    </View>
  );
}

function Settings({ item }: { item: Item }) {
  const { t } = useApp();
  const save = useSaveCheckin(item);
  const own = readCheckin(item.checkin) ?? {};
  const [custom, setCustom] = useState(own.opensH !== undefined && !OPENS_CHOICES.includes(own.opensH) ? String(own.opensH) : '');
  const [customOpen, setCustomOpen] = useState(own.opensH !== undefined && !OPENS_CHOICES.includes(own.opensH));
  const [customErr, setCustomErr] = useState('');
  const flight = item.kind === 'flight';
  const usualClose = flight ? USUAL_CLOSE_MIN[flightScope(item).scope] : item.kind === 'ferry' ? USUAL_CLOSE_MIN.ferry : USUAL_CLOSE_MIN.train;
  const typedBag = flight && !!readAirport(item.airport)?.bagDrop;
  const opensSel = own.opensH ?? (flight ? CHECKIN_OPENS_H : undefined);
  const setOpens = (h: number | undefined) => save({ ...own, opensH: h });
  const saveCustom = () => {
    const n = Number(custom.trim());
    if (!Number.isInteger(n) || n < 1 || n > MAX_OPENS_H) {
      setCustomErr(t('checkin.opens.customBad'));
      return;
    }
    setCustomErr('');
    setOpens(n);
  };
  return (
    <View style={{ gap: space.m }}>
      <Label>{t('checkin.opens.label')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('checkin.opens.label')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {flight ? null : (
          <Chip label={t('checkin.opens.none')} selected={opensSel === undefined && !customOpen} hint={t('checkin.opens.hint')} onPress={() => {
              setCustomOpen(false);
              setOpens(undefined);
            }} />
        )}
        {OPENS_CHOICES.map((h) => (
          <Chip
            key={h}
            label={t('checkin.opens.choice', { n: h })}
            a11yLabel={t('checkin.opens.choiceA11y', { n: h })}
            hint={t('checkin.opens.hint')}
            selected={!customOpen && opensSel === h}
            onPress={() => {
              setCustomOpen(false);
              // The usual 24 h on a flight is stored as "not set", so it stays labelled usual.
              setOpens(flight && h === CHECKIN_OPENS_H ? undefined : h);
            }}
          />
        ))}
        <Chip label={t('checkin.opens.custom')} hint={t('checkin.opens.hint')} selected={customOpen} onPress={() => setCustomOpen(true)} />
      </View>
      {customOpen ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('checkin.opens.customLabel')} value={custom} onChange={setCustom} inputMode="numeric" error={customErr || undefined} />
          <Button label={t('checkin.opens.customSave')} hint={t('checkin.opens.customSaveHint')} kind="secondary" onPress={saveCustom} />
        </View>
      ) : null}
      <OffsetStepper label={t('checkin.closes.label')} value={own.closesMin} usual={usualClose} onChange={(v) => save({ ...own, closesMin: v })} />
      {flight ? typedBag ? <Body muted>{t('checkin.bagTyped')}</Body> : <OffsetStepper label={t('checkin.bag.label')} value={own.bagDropMin} usual={usualClose} onChange={(v) => save({ ...own, bagDropMin: v })} /> : null}
    </View>
  );
}

function DeskHours({ item }: { item: Item }) {
  const { t } = useApp();
  const save = useSaveCheckin(item);
  const own = readCheckin(item.checkin) ?? {};
  const [from, setFrom] = useState(own.deskFrom ?? '');
  const [to, setTo] = useState(own.deskTo ?? '');
  const [err, setErr] = useState('');
  const submit = () => {
    const f = from.trim();
    const tt = to.trim();
    if (!isClock(f) || !isClock(tt)) {
      setErr(t('checkin.desk.bad'));
      return;
    }
    setErr('');
    save({ ...own, deskFrom: f, deskTo: tt });
  };
  return (
    <View style={{ gap: space.s }}>
      <Label>{t('checkin.desk.title')}</Label>
      {own.deskFrom ? null : <Body muted>{t('checkin.desk.note')}</Body>}
      <TextField label={t('checkin.desk.from')} value={from} onChange={setFrom} autoCapitalize="none" error={err || undefined} />
      <TextField label={t('checkin.desk.to')} value={to} onChange={setTo} autoCapitalize="none" />
      <Button label={t('checkin.desk.save')} hint={t('checkin.desk.saveHint')} kind="secondary" onPress={submit} />
      {own.deskFrom ? (
        <Button
          label={t('checkin.desk.clear')}
          hint={t('checkin.desk.clearHint')}
          kind="quiet"
          onPress={() => {
            setFrom('');
            setTo('');
            save({ ...own, deskFrom: undefined, deskTo: undefined });
          }}
        />
      ) : null}
    </View>
  );
}

/** The booking screen's check-in card (flights, booked trains / ferries, stays, hire cars). */
export function ItemCheckinSlot({ item }: { item: Item }) {
  const { t, theme, lang } = useApp();
  const now = useMinute();
  const save = useSaveCheckin(item);
  const [open, setOpen] = useState(false);
  const status = useMemo(() => itemStatus(item, now), [item, now]);
  const journey = item.kind === 'flight' || ((item.kind === 'train' || item.kind === 'ferry') && windowsFor(item).length > 0);
  if (!status.length && item.kind !== 'car') return null;
  const done = isDone(item);
  const name = itemName(item);
  // The reminder: the first window still to open, else one still to close (not a stay's check-out).
  const next = status.find((s) => s.state === 'later' && s.window.opens) ?? status.find((s) => s.state === 'open' && s.window.closes && s.window.kind !== 'stayOut');
  const remind = async () => {
    if (!next) return;
    const kind = kindText(t, next);
    const opening = next.state === 'later' && !!next.window.opens;
    const words = {
      summary: t(opening ? 'checkin.remind.summaryOpens' : 'checkin.remind.summaryCloses', { kind, name }),
      description: t('checkin.remind.description', { kind, name, state: stateText(t, next, now, lang, true), note: t(next.window.usual ? 'checkin.remind.noteUsual' : 'checkin.remind.noteOwn') }),
    };
    const r = reminderIcs(next.window, words, Date.now());
    if (!r) return;
    const res = await shareCalendarFile(`checkin-${item.id.replace(/[^A-Za-z0-9_-]+/g, '')}.ics`, r.text, t('checkin.remind.shareTitle'));
    if (res !== 'shared') Alert.alert(t('checkin.remind.failedTitle'), t('checkin.remind.failedBody'));
  };
  const scope = item.kind === 'flight' ? flightScope(item) : null;
  return (
    <SectionCard title={t('checkin.title')} subtitle={t('checkin.itemSubtitle')} icon="time-outline" tone="sea">
      {status.length ? <CheckinArt stay={item.kind === 'hotel'} /> : null}
      {status.map((s) => (
        <WindowRow key={s.window.kind} s={s} now={now} city={false} />
      ))}
      {scope ? (
        <Text style={[typeScale.caption, { color: theme.muted }]}>
          {t(scope.scope === 'domestic' ? 'checkin.scope.domestic' : 'checkin.scope.international', { n: USUAL_CLOSE_MIN[scope.scope] })}
          {scope.guessed ? ` ${t('checkin.scope.guessed')}` : ''}
        </Text>
      ) : null}
      {item.kind === 'car' && pickupOutsideDesk(item) ? <Text style={[typeScale.small, { color: theme.danger }]}>{t('checkin.deskOutside')}</Text> : null}
      {status.length ? <ToggleRow label={t('checkin.mark')} hint={t('checkin.markHint')} value={done} onChange={(v) => save(readCheckin(setDone(item, v, Date.now()).checkin))} /> : null}
      {/* T146: stays get their own "Mark checked out" tick (kept on Item.checkin, dropped by Plan this trip again). */}
      {status.some((s) => s.window.kind === 'stayOut') ? (
        <ToggleRow label={t('f106.checkout.mark')} hint={t('f106.checkout.markHint')} value={isOut(item)} onChange={(v) => save(readCheckin(setOut(item, v, Date.now()).checkin))} />
      ) : null}
      {next ? <Button label={t('checkin.remind')} hint={t('checkin.remindHint', { kind: kindText(t, next) })} kind="secondary" icon="calendar-outline" onPress={remind} /> : null}
      {item.kind === 'car' ? <DeskHours item={item} /> : null}
      {journey ? (
        <>
          <Button
            label={open ? t('checkin.settingsHide') : t('checkin.settings')}
            hint={open ? t('checkin.settingsHideHint') : t('checkin.settingsHint')}
            kind="quiet"
            icon={open ? 'chevron-up' : 'options-outline'}
            onPress={() => setOpen((v) => !v)}
          />
          {open ? (
            <FadeInView>
              <Settings item={item} />
            </FadeInView>
          ) : null}
        </>
      ) : null}
      {status.some((s) => s.window.usual) ? <Text style={[typeScale.caption, { color: theme.muted }]}>{t('checkin.guidance')}</Text> : null}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ Your day

/** "Online check-in for EA 25 opens 09:15 today" (or open now / closed); a tap opens the booking. */
export function CheckinBriefRow({ trip, now }: { trip: Trip; now: number }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const b = useMemo(() => briefCheckin(trip, now), [trip, now]);
  if (!b) return null;
  const s = b.status;
  const w = s.window;
  const kind = kindText(t, s);
  const name = itemName(b.item);
  const when = (m: Moment) => whenText(t, m, w.tz, now, lang);
  const line =
    s.state === 'later' && w.opens
      ? t('checkin.brief.opens', { kind, name, when: when(w.opens) })
      : s.state === 'overdue' && w.closes
        ? t('checkin.brief.overdue', { kind, name, when: when(w.closes) })
        : w.closes
          ? t('checkin.brief.open', { kind, name, when: when(w.closes) })
          : t('checkin.brief.openNoClose', { kind, name });
  const sub = w.usual ? t('checkin.usual') : zoneCity(w.tz);
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${line}. ${sub}`}
        accessibilityHint={t('checkin.brief.hint')}
        onPress={() => router.push(`/item/${b.item.id}`)}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="time-outline" size={18} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk }]}>
            {line}
          </Text>
          <Text numberOfLines={1} style={[typeScale.small, { color: theme.heroMuted }]}>
            {sub}
          </Text>
        </View>
      </PressableScale>
    </>
  );
}

/**
 * T146: the Your day row on a stay's last morning, "Check out of Hotel Gracery by 11:00 today", until the check-out
 * time or until it is ticked "checked out" (tap opens the booking to tick it). On the hotel's own clock.
 */
export function CheckoutBriefRow({ trip, now }: { trip: Trip; now: number }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const b = useMemo(() => briefCheckout(trip, now), [trip, now]);
  if (!b || !b.status.window.closes) return null;
  const w = b.status.window;
  const name = itemName(b.item) || t('f106.checkout.stay');
  const line = t('f106.checkout.brief', { name, when: whenText(t, w.closes as Moment, w.tz, now, lang) });
  const sub = w.usual ? t('checkin.usual') : zoneCity(w.tz);
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${line}. ${sub}`}
        accessibilityHint={t('f106.checkout.briefHint')}
        onPress={() => router.push(`/item/${b.item.id}`)}
        style={{ minHeight: TOUCH, paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="key-outline" size={18} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk }]}>
            {line}
          </Text>
          <Text numberOfLines={1} style={[typeScale.small, { color: theme.heroMuted }]}>
            {sub}
          </Text>
        </View>
      </PressableScale>
    </>
  );
}
