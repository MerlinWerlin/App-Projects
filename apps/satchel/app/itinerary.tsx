// T170 Add your itinerary: bring a whole trip plan in at once, read on the phone (src/core/itinerary.ts). Ways in:
// paste (or Paste from clipboard) a day-by-day plan or confirmation, open a calendar file (.ics) from Files, share an
// email / text / .ics file to Satchel (Open in routes calendar files here, and Paste a booking can hand its text
// over), or add plans one by one in the booking form. Every plan found is listed with its day, time, icon and a
// tick; "Check this" marks best guesses, and plans already on the trip start unticked. "Add N plans" saves the
// ticked ones to the trip (widening its dates if plans fall outside them) and opens the Today timetable at the first
// day added. Nothing is sent anywhere. Params: tripId (the trip to add to), day (the day being added to),
// incoming (text handed over in memory by Open in / Paste a booking) and name (the file it came from).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lookOf } from '../src/core/dayview.ts';
import { deviceZone, formatDay, formatRange, todayIn } from '../src/core/format.ts';
import { destinationZone } from '../src/core/glance.ts';
import { aiPrompt, alreadyPlanned, importSpan, isJsonLd, jsonIn, looksLikeJson, parseItinerary, readAiReply, tripForImport, usable, type ImportedPlan } from '../src/core/itinerary.ts';
import type { Trip } from '../src/core/model.ts';
import { itemFromDraft } from '../src/core/trips.ts';
import { pickCalendarFile } from '../src/native/calendarPick.ts';
import { copyText, readText } from '../src/native/clipboard.ts';
import { haptic } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { incomingText } from '../src/state/openinStash.ts';
import { useTrips } from '../src/state/trips.tsx';
import { elevated, fonts, radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard, toneColours } from '../src/ui/hero.tsx';
import { Body, Button, Chip, Label, PressableScale, Warning } from '../src/ui/kit.tsx';
import { LOOK_ICON, LOOK_TONE, lookKey } from '../src/ui/timetable.tsx';

export default function ItineraryScreen() {
  const params = useLocalSearchParams<{ tripId?: string; day?: string; incoming?: string; name?: string }>();
  const { t, theme, lang } = useApp();
  const { trips, saveTrip } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shared] = useState(() => incomingText(params.incoming));
  const [text, setText] = useState(shared ?? '');
  const [source, setSource] = useState<string | null>(shared && params.name ? params.name : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(params.tripId ?? null);
  const [saving, setSaving] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const today = todayIn(deviceZone());

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)), [trips]);
  const chosen = trips.find((x) => x.id === picked);
  // First read with the chosen trip (or the phone's zone), then pick the trip whose dates hold the plans.
  const readWith = (trip: Trip | undefined) =>
    usable(
      parseItinerary(text, {
        now: today,
        fallbackTz: (trip && destinationZone(trip)) || trip?.homeTz || deviceZone(),
        firstDay: trip?.startDate,
        defaultDay: (typeof params.day === 'string' && params.day) || trip?.startDate || today,
      }),
    );
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

  const announceFound = (n: number) => AccessibilityInfo.announceForAccessibility(n === 0 ? t('itin.none.title') : n === 1 ? t('itin.found.one') : t('itin.found.many', { n }));

  const pasteClipboard = async () => {
    setNotice(null);
    const got = await readText();
    if (got === null) return setNotice(t('itin.clipboardUnavailable'));
    if (!got.trim()) return setNotice(t('itin.clipboardEmpty'));
    setText(got);
    setSource(null);
    setOff(new Set());
    announceFound(readWith(trip).length);
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
    announceFound(readWith(trip).length);
  };

  const save = async () => {
    if (!trip || !toAdd.length || saving) return;
    setSaving(true);
    const items = toAdd.map((p) => itemFromDraft(p.draft, trip.id));
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

  const hasText = !!text.trim();

  // "Use your own AI": the reply pasted back is checked here, so a format slip says what to fix.
  const aiCheck = useMemo(() => {
    if (!looksLikeJson(text)) return null;
    const v = jsonIn(text);
    if (v !== undefined && isJsonLd(v)) return null;
    return readAiReply(text, { now: today, fallbackTz: deviceZone() });
  }, [text, today]);
  const aiMessage = !aiCheck
    ? null
    : aiCheck.error
      ? t(`itin.ai.error.${aiCheck.error}`)
      : aiCheck.problems.length
        ? t(aiCheck.problems.length === 1 ? 'itin.ai.skipped.one' : 'itin.ai.skipped.many', {
            n: aiCheck.problems.length,
            why: aiCheck.problems
              .slice(0, 3)
              .map((p) => t(`itin.ai.why.${p.reason}`, { n: p.item }))
              .join('; '),
          })
        : null;

  const copyPrompt = async () => {
    const own = hasText && !looksLikeJson(text) ? text : '';
    const ok = await copyText(aiPrompt(own, trip ? { name: trip.name, startDate: trip.startDate, endDate: trip.endDate } : undefined));
    const note = ok ? t('itin.ai.copied') : t('itin.ai.copyFailed');
    setAiNote(note);
    AccessibilityInfo.announceForAccessibility(note);
    if (ok) haptic.success();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <FadeInView>
        <HeroHeader tone="trips" illustration="route" eyebrow={t('itin.hero.eyebrow')} title={t('itin.hero.title')} subtitle={t('itin.hero.subtitle')} />
      </FadeInView>
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
        <Ionicons name="lock-closed-outline" size={16} color={theme.ok} />
        <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('itin.privacy')}</Text>
      </View>

      {/* Ways in */}
      <SectionCard title={t('itin.ways')} icon="download-outline" tone="accent">
        <Button label={t('itin.paste')} hint={t('itin.pasteHint')} icon="clipboard-outline" onPress={pasteClipboard} />
        <Button label={t('itin.calendar')} hint={t('itin.calendarHint')} kind="secondary" icon="calendar-outline" onPress={openCalendar} />
        {trip ? (
          <Button
            label={t('itin.manual')}
            hint={t('itin.manualHint')}
            kind="quiet"
            icon="add"
            onPress={() => router.push({ pathname: '/item-edit', params: { tripId: trip.id, kind: 'activity', date: (typeof params.day === 'string' && params.day) || trip.startDate } })}
          />
        ) : null}
        <Body muted>{t('itin.shareTip')}</Body>
        {notice ? <Warning text={notice} /> : null}
      </SectionCard>

      {/* The text */}
      <View style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>{t('itin.input.label')}</Label>
          </View>
          {hasText ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('itin.clear')}
              accessibilityHint={t('itin.clearHint')}
              onPress={() => {
                setText('');
                setSource(null);
                setOff(new Set());
              }}
              style={{ paddingHorizontal: space.m }}
            >
              <Text style={[typeScale.bodyStrong, { color: theme.accentInk }]}>{t('itin.clear')}</Text>
            </PressableScale>
          ) : null}
        </View>
        {source ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('itin.fromFile', { name: source })}</Text> : null}
        <TextInput
          accessibilityLabel={t('itin.input.label')}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setSource(null);
          }}
          multiline
          placeholder={t('itin.input.placeholder')}
          placeholderTextColor={theme.muted}
          style={[
            elevated(theme, 'low'),
            { minHeight: 160, maxHeight: 320, textAlignVertical: 'top', borderRadius: radius.m, padding: space.m, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: theme.ink },
          ]}
        />
        {!hasText ? <Body muted>{t('itin.formatTip')}</Body> : null}
        {aiMessage ? <Warning text={aiMessage} /> : null}
      </View>

      {/* Use your own AI: no AI service of ours, no key in the app. */}
      <SectionCard title={t('itin.ai.title')} subtitle={t('itin.ai.subtitle')} icon="sparkles-outline" tone="sea">
        <Body>{t('itin.ai.step1')}</Body>
        <Body>{t('itin.ai.step2')}</Body>
        <Body>{t('itin.ai.step3')}</Body>
        <Button label={t('itin.ai.copy')} hint={t('itin.ai.copyHint')} kind="secondary" icon="copy-outline" onPress={copyPrompt} />
        {aiNote ? (
          <View accessibilityLiveRegion="polite">
            <Text style={[typeScale.bodyStrong, { color: theme.ok }]}>{aiNote}</Text>
          </View>
        ) : null}
        <Body muted>{t('itin.ai.privacy')}</Body>
      </SectionCard>

      {/* What was found */}
      {hasText && found.length === 0 && !aiCheck ? (
        <SectionCard title={t('itin.none.title')} icon="search-outline" tone="ink">
          <Body muted>{t('itin.none.body')}</Body>
        </SectionCard>
      ) : null}
      {found.length ? (
        <View style={{ gap: space.s }}>
          <View accessible accessibilityRole="header" accessibilityLiveRegion="polite">
            <Text style={[typeScale.title, { color: theme.ink }]}>{found.length === 1 ? t('itin.found.one') : t('itin.found.many', { n: found.length })}</Text>
          </View>
          {found.map((p, i) => {
            const it = itemFromDraft(p.draft, trip?.id ?? 'new');
            const look = lookOf(it);
            const tone = toneColours(theme, LOOK_TONE[look]);
            const on = isOn(p);
            const day = formatDay(p.draft.startDate, lang);
            const newDay = i === 0 || found[i - 1].draft.startDate !== p.draft.startDate;
            const outside = !!trip && (p.draft.startDate < trip.startDate || p.draft.startDate > trip.endDate);
            const sub = [p.draft.placeName || [p.draft.fromName, p.draft.toName].filter(Boolean).join(' → '), p.draft.ref].filter(Boolean).join(' · ');
            const flags = [p.check ? t('itin.check') : '', dupes.has(p.key) ? t('itin.already') : '', outside ? t('itin.outside') : ''].filter(Boolean);
            return (
              <View key={p.key} style={{ gap: space.xs }}>
                {newDay ? <Text style={[typeScale.caption, { color: theme.accentInk, marginTop: i ? space.s : 0 }]}>{day}</Text> : null}
                <PressableScale
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={[t('itin.rowA11y', { day, time: p.draft.startTime, kind: t(lookKey(look)), title: p.draft.title }), sub, ...flags, on ? t('itin.rowOn') : t('itin.rowOff')].filter(Boolean).join('. ')}
                  accessibilityHint={t('itin.rowHint')}
                  onPress={() => toggle(p)}
                  style={[
                    elevated(theme, 'low'),
                    { borderRadius: radius.m, padding: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: on ? 1 : 0.6, borderLeftWidth: 5, borderLeftColor: tone.fg },
                  ]}
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
    </ScrollView>
  );
}
