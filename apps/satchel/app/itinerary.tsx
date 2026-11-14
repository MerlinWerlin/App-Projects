// T170 / T173 Add your itinerary (owner, 14 Nov: "here is a format to copy it in - recommend they use ai to fill it
// out if its already made - otherwise like an add to itinerary actual thing"). Two clear paths:
//  A. "I already have an itinerary": 1 Copy this format (with Copy prompt for the traveller's own ChatGPT / Claude /
//     Gemini), 2 Paste it here (a big box with a Paste button), 3 Check and save (every plan found, ticked, with
//     "Check this" on best guesses; plans already on the trip start unticked). A calendar file (.ics) is the other
//     way in on this path. The box also reads booking confirmations, day-by-day plans and calendar text.
//  B. "Add plans myself": the plan form (app/plan-edit.tsx).
// Everything is read on the phone; nothing is sent anywhere. Params: tripId, day (the day being added to), incoming
// (text handed over in memory by Open in / Paste a booking), name (the file it came from) and start (calendar /
// paste / ai: open path A with that way started).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lookOf } from '../src/core/dayview.ts';
import { deviceZone, formatDay, formatRange, todayIn } from '../src/core/format.ts';
import { destinationZone } from '../src/core/glance.ts';
import {
  aiPrompt,
  alreadyPlanned,
  FORMAT_EXAMPLE,
  FORMAT_RULE,
  importSpan,
  isJsonLd,
  jsonIn,
  looksLikeJson,
  looksLikeLines,
  parseItinerary,
  readAiReply,
  readLines,
  tripForImport,
  usable,
  type ImportedPlan,
} from '../src/core/itinerary.ts';
import type { Trip } from '../src/core/model.ts';
import { itemFromDraft } from '../src/core/trips.ts';
import { pickCalendarFile } from '../src/native/calendarPick.ts';
import { copyText, readText } from '../src/native/clipboard.ts';
import { haptic } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { incomingText } from '../src/state/openinStash.ts';
import { useTrips } from '../src/state/trips.tsx';
import { elevated, fonts, radius, shadowOf, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, IconBadge, toneColours, type Tone } from '../src/ui/hero.tsx';
import { Body, Button, Chip, Label, PressableScale, Warning } from '../src/ui/kit.tsx';
import { LOOK_ICON, LOOK_TONE, lookKey } from '../src/ui/timetable.tsx';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One of the two big path choices. */
function PathCard({ icon, tone, title, body, onPress }: { icon: IconName; tone: Tone; title: string; body: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      onPress={onPress}
      style={[elevated(theme, 'low'), shadowOf(theme, 'low'), { borderRadius: radius.l, padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }]}
    >
      <IconBadge name={icon} tone={tone} size="l" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.title, { color: theme.ink }]}>{title}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={theme.muted} />
    </PressableScale>
  );
}

/** A numbered step card. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={[elevated(theme, 'low'), { borderRadius: radius.l, padding: space.l, gap: space.m }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }} accessible accessibilityRole="header">
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accentStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[typeScale.bodyStrong, { color: theme.onAccent }]}>{n}</Text>
        </View>
        <Text style={[typeScale.title, { color: theme.ink, flex: 1 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function ItineraryScreen() {
  const params = useLocalSearchParams<{ tripId?: string; day?: string; incoming?: string; name?: string; start?: string }>();
  const { t, theme, lang } = useApp();
  const { trips, saveTrip } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shared] = useState(() => incomingText(params.incoming));
  const [path, setPath] = useState<'choose' | 'have'>(shared || params.start ? 'have' : 'choose');
  const [text, setText] = useState(shared ?? '');
  const [source, setSource] = useState<string | null>(shared && params.name ? params.name : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(params.tripId ?? null);
  const [saving, setSaving] = useState(false);
  const today = todayIn(deviceZone());
  const day = typeof params.day === 'string' ? params.day : '';

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)), [trips]);
  const chosen = trips.find((x) => x.id === picked);
  const optsFor = (trip: Trip | undefined) => ({
    now: today,
    fallbackTz: (trip && destinationZone(trip)) || trip?.homeTz || deviceZone(),
    firstDay: trip?.startDate,
    defaultDay: day || trip?.startDate || today,
  });
  // First read with the chosen trip (or the phone's zone), then pick the trip whose dates hold the plans.
  const readWith = (trip: Trip | undefined) => usable(parseItinerary(text, optsFor(trip)));
  const firstPass = useMemo(() => readWith(chosen), [text, chosen, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const guessed = useMemo(() => (chosen ? undefined : tripForImport(firstPass, sortedTrips) ?? (sortedTrips.length === 1 ? sortedTrips[0] : undefined)), [chosen, firstPass, sortedTrips]);
  const trip = chosen ?? guessed;
  const found = useMemo(() => (trip && !chosen ? readWith(trip) : firstPass), [trip, chosen, firstPass]); // eslint-disable-line react-hooks/exhaustive-deps
  const dupes = useMemo(() => new Set(trip ? found.filter((p) => alreadyPlanned(p, trip)).map((p) => p.key) : []), [found, trip]);
  const isOn = (p: ImportedPlan) => !off.has(p.key) && !(dupes.has(p.key) && !off.has(`+${p.key}`));
  const toAdd = found.filter(isOn);
  const span = importSpan(toAdd);
  const widened = trip && span ? { start: span.from < trip.startDate ? span.from : trip.startDate, end: span.to > trip.endDate ? span.to : trip.endDate } : null;
  const widens = !!trip && !!widened && (widened.start !== trip.startDate || widened.end !== trip.endDate);
  const hasText = !!text.trim();

  // What to fix, said gently: format lines that couldn't be read, or an AI reply in the wrong shape.
  const hint = useMemo(() => {
    if (!hasText) return null;
    if (looksLikeLines(text)) {
      const p = readLines(text, optsFor(trip)).problems;
      if (!p.length) return null;
      const why = p
        .slice(0, 3)
        .map((x) => t(`itin.line.${x.reason}`, { n: x.line }))
        .join('; ');
      return t(p.length === 1 ? 'itin.line.skipped.one' : 'itin.line.skipped.many', { n: p.length, why });
    }
    if (looksLikeJson(text)) {
      const v = jsonIn(text);
      if (v !== undefined && isJsonLd(v)) return null;
      const r = readAiReply(text, optsFor(trip));
      if (r.error) return t(`itin.ai.error.${r.error}`);
      if (r.problems.length) {
        const why = r.problems
          .slice(0, 3)
          .map((x) => t(`itin.ai.why.${x.reason}`, { n: x.item }))
          .join('; ');
        return t(r.problems.length === 1 ? 'itin.ai.skipped.one' : 'itin.ai.skipped.many', { n: r.problems.length, why });
      }
    }
    return null;
  }, [text, trip, hasText]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (p: ImportedPlan) => {
    setOff((prev) => {
      const next = new Set(prev);
      if (isOn(p)) {
        next.add(p.key);
        next.delete(`+${p.key}`);
      } else {
        next.delete(p.key);
        if (dupes.has(p.key)) next.add(`+${p.key}`);
      }
      return next;
    });
  };

  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const reviewY = useRef(0);
  const announceFound = (n: number) => AccessibilityInfo.announceForAccessibility(n === 0 ? t('itin.none.title') : n === 1 ? t('itin.found.one') : t('itin.found.many', { n }));

  const pasteClipboard = async () => {
    setNotice(null);
    const got = await readText();
    if (got === null) return setNotice(t('itin.clipboardUnavailable'));
    if (!got.trim()) return setNotice(t('itin.clipboardEmpty'));
    setText(got);
    setSource(null);
    setOff(new Set());
    announceFound(usable(parseItinerary(got, optsFor(trip))).length);
  };

  const openCalendar = async () => {
    setNotice(null);
    const r = await pickCalendarFile();
    if (!r.ok) {
      if (r.reason === 'failed') setNotice(t('itin.fileFailed'));
      return;
    }
    setText(r.text);
    setSource(r.name);
    setOff(new Set());
    announceFound(usable(parseItinerary(r.text, optsFor(trip))).length);
  };

  const copy = async (what: 'format' | 'prompt') => {
    const own = hasText && !looksLikeJson(text) && !looksLikeLines(text) ? text : '';
    const body = what === 'format' ? FORMAT_EXAMPLE : aiPrompt(own, trip ? { name: trip.name, startDate: trip.startDate, endDate: trip.endDate } : undefined);
    const ok = await copyText(body);
    const note = ok ? t(what === 'format' ? 'itin.format.copied' : 'itin.ai.copied') : t('itin.ai.copyFailed');
    setCopied(note);
    AccessibilityInfo.announceForAccessibility(note);
    if (ok) haptic.success();
  };

  const save = async () => {
    if (!trip || !toAdd.length || saving) return;
    setSaving(true);
    const items = toAdd.map((p) => ({ ...itemFromDraft(p.draft, trip.id), ...(p.look ? { look: p.look } : {}) }));
    const next: Trip = { ...trip, items: [...trip.items, ...items], ...(widens && widened ? { startDate: widened.start, endDate: widened.end } : {}) };
    const ok = await saveTrip(next);
    setSaving(false);
    if (!ok) {
      setNotice(t('itin.saveFailed'));
      return;
    }
    haptic.success();
    AccessibilityInfo.announceForAccessibility(items.length === 1 ? t('itin.added.one') : t('itin.added.many', { n: items.length }));
    const first = [...toAdd].map((p) => p.draft.startDate).sort()[0];
    router.replace({ pathname: '/today/[tripId]', params: { tripId: trip.id, day: first } });
  };

  const addMyself = () => {
    if (!trip) {
      router.push('/trip-edit');
      return;
    }
    router.push({ pathname: '/plan-edit', params: { tripId: trip.id, ...(day ? { day } : {}) } });
  };

  // Opened with one way picked (from the Itinerary tab): start it straight away.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (params.start === 'calendar') void openCalendar();
    else if (params.start === 'paste') void pasteClipboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (path === 'choose') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}>
        <FadeInView style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
            {t('itin.choose.title')}
          </Text>
          <Body muted>{trip ? t('itin.choose.forTrip', { trip: trip.name }) : t('itin.choose.body')}</Body>
        </FadeInView>
        <PathCard icon="document-text" tone="accent" title={t('itin.pathA.title')} body={t('itin.pathA.body')} onPress={() => setPath('have')} />
        <PathCard icon="create" tone="sea" title={t('itin.pathB.title')} body={trip ? t('itin.pathB.body') : t('itin.pathB.noTrip')} onPress={addMyself} />
        <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.ok} />
          <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('itin.privacy')}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scroller}
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
          {t('itin.pathA.title')}
        </Text>
        <Body muted>{t('itin.pathA.lead')}</Body>
      </View>

      {/* 1. The format, and the AI shortcut */}
      <Step n={1} title={t('itin.step1')}>
        <Text style={[typeScale.small, { color: theme.muted }]}>{FORMAT_RULE}</Text>
        <View style={{ backgroundColor: theme.paper, borderRadius: radius.m, padding: space.m, borderWidth: 1, borderColor: theme.line }} accessible accessibilityLabel={t('itin.format.exampleA11y')}>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: theme.ink }}>{FORMAT_EXAMPLE}</Text>
        </View>
        <Button label={t('itin.format.copy')} hint={t('itin.format.copyHint')} icon="copy-outline" onPress={() => copy('format')} />
        <View style={{ backgroundColor: theme.seaSoft, borderRadius: radius.m, padding: space.m, gap: space.s }}>
          <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
            <Ionicons name="sparkles" size={18} color={theme.sea} />
            <Text style={[typeScale.bodyStrong, { color: theme.ink, flex: 1 }]}>{t('itin.ai.easiest')}</Text>
          </View>
          <Text style={[typeScale.small, { color: theme.ink }]}>{t('itin.ai.easiestBody')}</Text>
          <Button label={t('itin.ai.copy')} hint={t('itin.ai.copyHint')} kind="secondary" icon="sparkles-outline" onPress={() => copy('prompt')} />
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('itin.ai.privacy')}</Text>
        </View>
        {copied ? (
          <View accessibilityLiveRegion="polite">
            <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{copied}</Text>
          </View>
        ) : null}
      </Step>

      {/* 2. Paste */}
      <Step n={2} title={t('itin.step2')}>
        <Button label={t('itin.pasteButton')} hint={t('itin.pasteHint')} icon="clipboard" onPress={pasteClipboard} />
        {source ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('itin.fromFile', { name: source })}</Text> : null}
        <TextInput
          accessibilityLabel={t('itin.input.label')}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setSource(null);
          }}
          multiline
          placeholder={t('itin.input.placeholder2')}
          placeholderTextColor={theme.muted}
          style={{
            minHeight: 200,
            maxHeight: 360,
            textAlignVertical: 'top',
            borderRadius: radius.m,
            padding: space.m,
            borderWidth: 2,
            borderStyle: hasText ? 'solid' : 'dashed',
            borderColor: hasText ? theme.accentStrong : theme.line,
            backgroundColor: theme.card,
            fontFamily: fonts.body,
            fontSize: 15,
            lineHeight: 21,
            color: theme.ink,
          }}
        />
        {hasText ? (
          <Button
            label={t('itin.clear')}
            hint={t('itin.clearHint')}
            kind="quiet"
            icon="close"
            onPress={() => {
              setText('');
              setSource(null);
              setOff(new Set());
            }}
          />
        ) : null}
        {hint ? <Warning text={hint} /> : null}
        {notice ? <Warning text={notice} /> : null}
        <Button label={t('itin.calendar')} hint={t('itin.calendarHint')} kind="quiet" icon="calendar-outline" onPress={openCalendar} />
      </Step>

      {/* 3. Check and save */}
      <View onLayout={(e) => (reviewY.current = e.nativeEvent.layout.y)}>
        <Step n={3} title={t('itin.step3')}>
          {!hasText ? <Body muted>{t('itin.step3.empty')}</Body> : null}
          {hasText && found.length === 0 && !hint ? <Body muted>{t('itin.none.body')}</Body> : null}
          {found.length ? (
            <View style={{ gap: space.s }}>
              <View accessible accessibilityLiveRegion="polite">
                <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{found.length === 1 ? t('itin.found.one') : t('itin.found.many', { n: found.length })}</Text>
              </View>
              {found.map((p, i) => {
                const it = { ...itemFromDraft(p.draft, trip?.id ?? 'new'), ...(p.look ? { look: p.look } : {}) };
                const look = lookOf(it);
                const tone = toneColours(theme, LOOK_TONE[look]);
                const on = isOn(p);
                const dayLabel = formatDay(p.draft.startDate, lang);
                const newDay = i === 0 || found[i - 1].draft.startDate !== p.draft.startDate;
                const outside = !!trip && (p.draft.startDate < trip.startDate || p.draft.startDate > trip.endDate);
                const sub = [p.draft.placeName || [p.draft.fromName, p.draft.toName].filter(Boolean).join(' → '), p.draft.ref].filter(Boolean).join(' · ');
                const flags = [p.check ? t('itin.check') : '', dupes.has(p.key) ? t('itin.already') : '', outside ? t('itin.outside') : ''].filter(Boolean);
                return (
                  <View key={p.key} style={{ gap: space.xs }}>
                    {newDay ? <Text style={[typeScale.caption, { color: theme.accentInk, marginTop: i ? space.s : 0 }]}>{dayLabel}</Text> : null}
                    <PressableScale
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={[t('itin.rowA11y', { day: dayLabel, time: p.draft.startTime, kind: t(lookKey(look)), title: p.draft.title }), sub, ...flags, on ? t('itin.rowOn') : t('itin.rowOff')].filter(Boolean).join('. ')}
                      accessibilityHint={t('itin.rowHint')}
                      onPress={() => toggle(p)}
                      style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, borderRadius: radius.m, padding: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: on ? 1 : 0.6, borderLeftWidth: 5, borderLeftColor: tone.fg }}
                    >
                      <Text style={[typeScale.bodyStrong, { color: theme.ink, width: 48, fontVariant: ['tabular-nums'] }]}>{p.draft.startTime}</Text>
                      <Ionicons name={LOOK_ICON[look]} size={20} color={tone.fg} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{p.draft.title}</Text>
                        {sub ? <Text style={[typeScale.small, { color: theme.muted }]}>{sub}</Text> : null}
                        {flags.length ? <Text style={[typeScale.small, { color: theme.warn, fontFamily: fonts.bodyBold }]}>{flags.join(' · ')}</Text> : null}
                      </View>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? theme.accentStrong : theme.muted} />
                    </PressableScale>
                  </View>
                );
              })}

              {/* Which trip */}
              <View style={{ gap: space.s, marginTop: space.m }}>
                <Label>{t('itin.trip')}</Label>
                {sortedTrips.length === 0 ? (
                  <>
                    <Body muted>{t('itin.noTrips')}</Body>
                    <Button label={t('itin.newTrip')} hint={t('itin.newTripHint')} kind="secondary" icon="add" onPress={() => router.push('/trip-edit')} />
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('itin.tripChoose')}>
                    {sortedTrips.map((x) => (
                      <Chip key={x.id} label={x.name} selected={trip?.id === x.id} hint={formatRange(x.startDate, x.endDate, lang)} onPress={() => setPicked(x.id)} />
                    ))}
                  </View>
                )}
                {widens && widened ? <Body muted>{t('itin.widen', { range: formatRange(widened.start, widened.end, lang) })}</Body> : null}
              </View>

              {trip && toAdd.length ? (
                <View style={{ minHeight: TOUCH }}>
                  <Button
                    label={toAdd.length === 1 ? t('itin.add.one', { trip: trip.name }) : t('itin.add.many', { n: toAdd.length, trip: trip.name })}
                    hint={t('itin.addHint')}
                    icon="checkmark"
                    onPress={save}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </Step>
      </View>

      <Button label={t('itin.pathB.instead')} hint={t('itin.pathB.body')} kind="quiet" icon="create-outline" onPress={addMyself} />
    </ScrollView>
  );
}
