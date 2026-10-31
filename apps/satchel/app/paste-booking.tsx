// T77 Paste a booking (owner feedback 1031: deepen Trips with features travellers love). The traveller copies a
// confirmation (email, text message, booking page), pastes it here (or taps Paste from clipboard), and the text is
// read on the phone by src/core/pasteparse.ts as they type: one card per booking found, with an icon per kind, the
// fields found and "Check this" on the ones that are a best guess. They pick the trip, then "Review and save" opens
// the normal booking form filled in (src/state/pasteDraft.ts hands the draft over); nothing is ever saved from this
// screen. Opened with ?tripId=<id> from a trip's add-booking area, or without from the Trips tab.
// T80: the day/month choice for dates like 03/04/2027 is remembered on this phone, and a card saved into the chosen
// trip from a paste shows "Saved" (its main button becomes a quiet "Add it again anyway") so one paste isn't saved
// twice by accident.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceZone, formatDay, todayIn, zoneCity } from '../src/core/format.ts';
import type { ItemKind } from '../src/core/model.ts';
import { alreadyInTrip, draftForForm, foundFields, needsCheck, parseBookings, suggestTrip, type FoundField, type PasteBooking, type PasteField } from '../src/core/pasteparse.ts';
import type { Key } from '../src/i18n/en.ts';
import { DEFAULT_DATE_ORDER, parseDateOrder, PASTE_DATE_ORDER_KEY, PASTE_SAVED_KEY, parseSavedPastes, pasteFingerprint, pasteSavedIn } from '../src/core/followups89.ts';
import { readText } from '../src/native/clipboard.ts';
import { useApp } from '../src/state/app.tsx';
import { stashPastedDraft } from '../src/state/pasteDraft.ts';
import { usePersisted } from '../src/state/persisted.ts';
import { useTrips } from '../src/state/trips.tsx';
import { fonts, radius, shadowOf, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, IconBadge, SectionCard, toneColours } from '../src/ui/hero.tsx';
import { KIND_ICON, KIND_TONE, kindKey } from '../src/ui/kinds.tsx';
import { Body, Button, Chip, Label } from '../src/ui/kit.tsx';

const NO_SAVED: unknown[] = [];
const NUMERIC_DATE = /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/;

/** Field labels that read better per kind: "Departs" on a flight, "Check-in" at a hotel, "Pick-up" for car hire. */
function fieldKey(f: PasteField, kind: ItemKind): Key {
  if ((f === 'start' || f === 'end') && (kind === 'flight' || kind === 'hotel' || kind === 'car')) return `paste.${f}.${kind}` as Key;
  if (f === 'carrier' && (kind === 'flight' || kind === 'car')) return `paste.carrier.${kind}` as Key;
  return `paste.field.${f}` as Key;
}

export default function PasteBookingScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [order, setOrder] = usePersisted<unknown>(PASTE_DATE_ORDER_KEY, DEFAULT_DATE_ORDER);
  const us = parseDateOrder(order) === 'monthFirst';
  const setUs = (v: boolean) => setOrder(v ? 'monthFirst' : 'dayFirst');
  const [rawSaved] = usePersisted<unknown>(PASTE_SAVED_KEY, NO_SAVED);
  const savedPastes = useMemo(() => parseSavedPastes(rawSaved), [rawSaved]);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(params.tripId ?? null);
  const today = todayIn(deviceZone());

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)), [trips]);
  const fallbackTz = useMemo(() => {
    const trip = trips.find((x) => x.id === picked);
    const last = trip?.items[trip.items.length - 1];
    return last?.end?.tz ?? last?.start.tz ?? deviceZone();
  }, [trips, picked]);
  const found = useMemo(() => parseBookings(text, { now: today, us, fallbackTz }), [text, today, us, fallbackTz]);
  const suggested = useMemo(() => suggestTrip(found, sortedTrips), [found, sortedTrips]);
  // The trip the traveller chose, else the one opened from, else the one whose dates match.
  const tripId = picked && trips.some((x) => x.id === picked) ? picked : suggested?.id ?? (sortedTrips.length === 1 ? sortedTrips[0].id : null);
  const trip = trips.find((x) => x.id === tripId);
  const hasText = !!text.trim();

  const pasteClipboard = async () => {
    setNotice(null);
    const got = await readText();
    if (got === null) {
      setNotice(t('paste.clipboardUnavailable'));
      return;
    }
    if (!got.trim()) {
      setNotice(t('paste.clipboardEmpty'));
      return;
    }
    setText(got);
    const n = parseBookings(got, { now: today, us, fallbackTz }).length;
    AccessibilityInfo.announceForAccessibility(n === 0 ? t('paste.none.title') : n === 1 ? t('paste.found.one') : t('paste.found.many', { n }));
  };

  const review = (b: PasteBooking) => {
    if (!trip) {
      AccessibilityInfo.announceForAccessibility(t('paste.trip.choose'));
      return;
    }
    const draft = draftForForm(b, t(`paste.defaultTitle.${b.kind}` as Key), (place) => t('paste.dropOffNote', { place }));
    const key = stashPastedDraft({ draft, airport: b.airport, fingerprint: pasteFingerprint(b) });
    router.push({ pathname: '/item-edit', params: { tripId: trip.id, kind: b.kind, date: draft.startDate || trip.startDate, paste: key } });
  };

  /** Dates and zones in words for the cards ("Fri 12 Mar, 21:00", "Sydney → Tokyo time"); other values as found. */
  const shown = (b: PasteBooking, f: FoundField): string => {
    const d = b.draft;
    if (f.field === 'start' || f.field === 'end') {
      const date = f.field === 'start' ? d.startDate : d.endDate;
      const time = f.field === 'start' ? d.startTime : d.endTime;
      if (!date) return time;
      return time ? t('paste.whenValue', { day: formatDay(date, lang), time }) : formatDay(date, lang);
    }
    if (f.field === 'zone') {
      if (d.startTz && d.endTz && d.startTz !== d.endTz) return t('paste.zoneTwo', { from: zoneCity(d.startTz), to: zoneCity(d.endTz) });
      return t('paste.zoneValue', { city: zoneCity(d.startTz || d.endTz) });
    }
    return f.value;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}
      keyboardShouldPersistTaps="handled"
    >
      <HeroHeader tone="trips" illustration="ticket" eyebrow={t('paste.hero.eyebrow')} title={t('paste.hero.title')} subtitle={t('paste.hero.subtitle')} compact>
        <View
          accessible
          accessibilityLabel={t('paste.privacy')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, alignSelf: 'flex-start', backgroundColor: theme.heroWash, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}
        >
          <Ionicons name="lock-closed" size={14} color={theme.heroInk} />
          <Text style={[typeScale.small, { color: theme.heroInk, fontFamily: fonts.bodyBold }]}>{t('paste.privacy')}</Text>
        </View>
      </HeroHeader>

      <SectionCard title={t('paste.input.title')} subtitle={t('paste.input.subtitle')} icon="clipboard-outline" tone="sea">
        <TextInput
          accessibilityLabel={t('paste.input.label')}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setNotice(null);
          }}
          placeholder={t('paste.input.placeholder')}
          placeholderTextColor={theme.muted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            minHeight: 180,
            maxHeight: 360,
            borderWidth: 1,
            borderColor: theme.line,
            borderRadius: radius.m,
            padding: space.m,
            backgroundColor: theme.card,
            color: theme.ink,
            fontFamily: fonts.body,
            fontSize: 15,
            lineHeight: 21,
            textAlignVertical: 'top',
          }}
        />
        <Button label={t('paste.fromClipboard')} hint={t('paste.fromClipboardHint')} icon="clipboard-outline" kind={hasText ? 'secondary' : 'primary'} onPress={pasteClipboard} />
        {hasText ? <Button label={t('paste.clear')} hint={t('paste.clearHint')} kind="quiet" icon="close" onPress={() => setText('')} /> : null}
        {notice ? (
          <View accessibilityLiveRegion="polite">
            <Body muted>{notice}</Body>
          </View>
        ) : null}
        {NUMERIC_DATE.test(text) ? (
          <View style={{ gap: space.s }}>
            <Label>{t('paste.dateOrder')}</Label>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('paste.dateOrder')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              <Chip label={t('paste.dateOrder.dayFirst')} selected={!us} onPress={() => setUs(false)} />
              <Chip label={t('paste.dateOrder.monthFirst')} selected={us} onPress={() => setUs(true)} />
            </View>
            <Body muted>{t('f89.paste.dateOrderNote')}</Body>
          </View>
        ) : null}
      </SectionCard>

      {!hasText ? (
        <SectionCard title={t('paste.empty.title')} subtitle={t('paste.empty.body')} icon="mail-open-outline" tone="accent">
          <Tips />
        </SectionCard>
      ) : found.length === 0 ? (
        <FadeInView>
          <SectionCard title={t('paste.none.title')} icon="search-outline" tone="warn">
            <Body>{t('paste.none.body')}</Body>
            <Body muted>{t('paste.none.tryMore')}</Body>
            {trip ? <Button label={t('paste.none.manual')} hint={t('paste.none.manualHint')} kind="quiet" icon="create-outline" onPress={() => router.push(`/trip/${trip.id}`)} /> : null}
            <Tips />
          </SectionCard>
        </FadeInView>
      ) : (
        <>
          <View accessible accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
            <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
              {found.length === 1 ? t('paste.found.one') : t('paste.found.many', { n: found.length })}
            </Text>
            <Body muted>{t('paste.found.note')}</Body>
          </View>

          <SectionCard title={t('paste.trip.label')} icon="briefcase-outline" tone="teal">
            {sortedTrips.length ? (
              <View accessibilityRole="radiogroup" accessibilityLabel={t('paste.trip.label')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {sortedTrips.map((x) => (
                  <Chip key={x.id} label={x.name} selected={x.id === tripId} onPress={() => setPicked(x.id)} />
                ))}
              </View>
            ) : (
              <Body>{t('paste.trip.none')}</Body>
            )}
            {trip && suggested?.id === trip.id ? <Body muted>{t('paste.trip.suggested')}</Body> : null}
            {sortedTrips.length ? null : <Button label={t('paste.trip.new')} hint={t('paste.trip.newHint')} icon="add" onPress={() => router.push('/trip-edit')} />}
          </SectionCard>

          {found.map((b, i) => (
            <FadeInView key={`${i}-${b.kind}-${b.draft.number}-${b.draft.startDate}`} delay={Math.min(i, 4) * 60}>
              <BookingCard
                booking={b}
                shown={shown}
                inTrip={alreadyInTrip(b, trip)}
                saved={pasteSavedIn(savedPastes, pasteFingerprint(b), trip)}
                canReview={!!trip}
                onReview={() => review(b)}
                onOpenTrip={() => trip && router.push(`/trip/${trip.id}`)}
              />
            </FadeInView>
          ))}
        </>
      )}

      <Body muted>{t('paste.guidance')}</Body>
    </ScrollView>
  );
}

function Tips() {
  const { t, theme } = useApp();
  const tips: Key[] = ['paste.tip.whole', 'paste.tip.several', 'paste.tip.check'];
  return (
    <View style={{ gap: space.s }}>
      <Label>{t('paste.tips.title')}</Label>
      {tips.map((k) => (
        <View key={k} style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.sea} />
          </View>
          <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{t(k)}</Text>
        </View>
      ))}
    </View>
  );
}

function BookingCard({
  booking: b,
  shown,
  inTrip,
  saved,
  canReview,
  onReview,
  onOpenTrip,
}: {
  booking: PasteBooking;
  shown: (b: PasteBooking, f: FoundField) => string;
  inTrip: boolean;
  /** T80: saved into this trip from a paste (and still there). */
  saved: boolean;
  canReview: boolean;
  onReview: () => void;
  onOpenTrip: () => void;
}) {
  const { t, theme } = useApp();
  const tone = KIND_TONE[b.kind];
  const fields = foundFields(b).filter((f) => f.field !== 'title');
  const check = needsCheck(b);
  const title = b.draft.title || t('paste.card.untitled');
  const warn = toneColours(theme, 'warn');
  return (
    <View
      style={[
        { backgroundColor: theme.cardRaised, borderRadius: radius.l, overflow: 'hidden', borderWidth: theme.dark ? 1 : 0, borderColor: theme.line },
        shadowOf(theme, 'low'),
      ]}
    >
      {/* Kind-coloured stripe, like tickets and agenda rows. */}
      <View style={{ height: 6, backgroundColor: toneColours(theme, tone).fg }} />
      <View style={{ padding: space.l, gap: space.m }}>
        <View accessible accessibilityRole="header" accessibilityLabel={t('paste.card.a11y', { kind: t(kindKey(b.kind)), title })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <IconBadge name={KIND_ICON[b.kind]} tone={tone} />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{t(kindKey(b.kind))}</Text>
            <Text style={[typeScale.title, { color: theme.ink }]}>{title}</Text>
          </View>
          {saved ? <SavedPill /> : b.confidence.title === 'low' ? <CheckPill /> : null}
        </View>
        {saved ? (
          <View accessible accessibilityLabel={t('f89.paste.savedA11y')} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: theme.okSoft }}>
            <Ionicons name="checkmark-done" size={20} color={theme.ok} />
            <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('f89.paste.savedBody')}</Text>
          </View>
        ) : inTrip ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Ionicons name="checkmark-circle" size={18} color={theme.ok} />
            <Text style={[typeScale.small, { color: theme.ok, fontFamily: fonts.bodyBold }]}>{t('paste.already')}</Text>
          </View>
        ) : null}
        <View style={{ gap: space.s }}>
          {fields.map((f) => {
            const label = t(fieldKey(f.field, b.kind));
            const value = shown(b, f);
            const low = f.confidence === 'low';
            return (
              <View
                key={f.field}
                accessible
                accessibilityLabel={low ? t('paste.checkA11y', { field: label, value }) : t('paste.fieldA11y', { field: label, value })}
                style={{
                  flexDirection: 'row',
                  gap: space.m,
                  alignItems: 'flex-start',
                  paddingVertical: space.xs,
                  paddingHorizontal: low ? space.s : 0,
                  borderRadius: radius.s,
                  backgroundColor: low ? warn.bg : 'transparent',
                }}
              >
                <Text style={[typeScale.small, { width: 108, color: theme.muted }]}>{label}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typeScale.body, { color: theme.ink }]}>{value}</Text>
                  {low ? <Text style={[typeScale.small, { color: warn.fg, fontFamily: fonts.bodyBold }]}>{t('paste.check')}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
        {b.unknownCodes.length ? (
          <Body muted>{t('paste.unknownCodes', { codes: b.unknownCodes.join(', ') })}</Body>
        ) : check.includes('zone') && !b.draft.startTz ? (
          <Body muted>{t('paste.noZone')}</Body>
        ) : null}
        {canReview && saved ? (
          <>
            <Button label={t('f89.paste.openTrip')} hint={t('f89.paste.openTripHint')} icon="briefcase-outline" kind="secondary" onPress={onOpenTrip} />
            <Button label={t('f89.paste.addAgain')} hint={t('f89.paste.addAgainHint')} icon="copy-outline" kind="quiet" onPress={onReview} />
          </>
        ) : canReview ? (
          <Button label={t('paste.review')} hint={t('paste.reviewHint')} icon="create-outline" kind={inTrip ? 'quiet' : 'primary'} onPress={onReview} />
        ) : (
          <Body muted>{t('paste.trip.choose')}</Body>
        )}
      </View>
    </View>
  );
}

function CheckPill() {
  const { t, theme } = useApp();
  const warn = toneColours(theme, 'warn');
  return (
    <View style={{ backgroundColor: warn.bg, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2, minHeight: 24, justifyContent: 'center' }}>
      <Text style={[typeScale.small, { color: warn.fg, fontFamily: fonts.bodyBold }]}>{t('paste.check')}</Text>
    </View>
  );
}

/** T80: the card was saved into this trip from a paste. */
function SavedPill() {
  const { t, theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.okSoft, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2, minHeight: 24 }}>
      <Ionicons name="checkmark" size={14} color={theme.ok} />
      <Text style={[typeScale.small, { color: theme.ok, fontFamily: fonts.bodyBold }]}>{t('f89.paste.saved')}</Text>
    </View>
  );
}
