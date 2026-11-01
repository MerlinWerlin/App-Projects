// T118 Plan this trip again: pick a new start date (system date picker, wall-clock fields via src/ui/DateTimeField.tsx),
// choose what comes along, check the bookings on their new days, then create the copy (src/core/tripcopy.ts). Opened
// from the trip screen and from the trip recap (src/ui/PlanAgainButton.tsx). Nothing phone-only is ever copied.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { formatDay, formatRange, formatTime, zoneCity } from '../../src/core/format.ts';
import { newId, type Stamp, type Trip } from '../../src/core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, putList, type PackStore } from '../../src/core/packing.ts';
import { localDate } from '../../src/core/tz.ts';
import { isLocalDate } from '../../src/core/wallpicker.ts';
import { ALL_PARTS, COPY_PARTS, copyPreview, copyTrip, nameForYear, partCounts, sameDayNextYear, type CopyPart, type CopyParts } from '../../src/core/tripcopy.ts';
import { useApp } from '../../src/state/app.tsx';
import { setPersistedChecked, usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { copyPostcardPeople, usePostcards } from '../../src/state/postcards.ts';
import { fonts, space } from '../../src/theme/tokens.ts';
import { DateField } from '../../src/ui/DateTimeField.tsx';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { Body, Button, Card, EmptyState, Label, Screen, TextField, ToggleRow, Warning } from '../../src/ui/kit.tsx';

/** Bookings listed in the preview before "And N more". */
const PREVIEW_ROWS = 8;

export default function PlanAgainScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('tripcopy.route') }} />
        <EmptyState art="magnifier" title={t('tripcopy.route')} body={t('tripcopy.notFound')} />
      </Screen>
    );
  }
  return <PlanAgain trip={trip} />;
}

function PlanAgain({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const { saveTrip } = useTrips();
  const router = useRouter();
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const packing = listFor(store, trip.id);
  const [start, setStart] = useState(() => sameDayNextYear(trip.startDate));
  const validStart = isLocalDate(start);
  const autoName = nameForYear(trip.name, Number((validStart ? start : trip.startDate).slice(0, 4)));
  const [name, setName] = useState<string | null>(null);
  const [parts, setParts] = useState<CopyParts>(ALL_PARTS);
  // T120: gift people's names only, off by default (gifts, prices and budgets never come along).
  const [giftNames, setGiftNames] = useState(false);
  // T126: the Leaving home checklist (ticks cleared, no dated sitter tasks), off by default like gift names.
  const [leavingHome, setLeavingHome] = useState(false);
  // T130: the Coming home lists (ticks cleared, no rating), off by default too.
  const [comingHome, setComingHome] = useState(false);
  // T147: the postcard people (names and addresses, on this phone) come along by default; the sent ticks never do.
  const [postcardBook] = usePostcards(trip.id);
  const postcardPeople = postcardBook.people.length;
  const [postcards, setPostcards] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const counts = useMemo(() => partCounts(trip, packing), [trip, packing]);
  const preview = useMemo(() => copyPreview(trip, validStart ? start : trip.startDate), [trip, start, validStart]);

  const when = (s: Stamp) => t('tripcopy.preview.when', { day: formatDay(localDate(s.local), lang), time: formatTime(s.local), city: zoneCity(s.tz) });
  const shiftLine =
    preview.days === 0
      ? t('tripcopy.shiftNone')
      : preview.days > 0
        ? preview.days === 1
          ? t('tripcopy.shiftLaterOne')
          : t('tripcopy.shiftLater', { n: preview.days })
        : preview.days === -1
          ? t('tripcopy.shiftEarlierOne')
          : t('tripcopy.shiftEarlier', { n: -preview.days });

  const shown = COPY_PARTS.filter((p) => (p === 'budget' ? counts.budget : counts[p] > 0));
  const label = (p: CopyPart) => (p === 'budget' ? t('tripcopy.part.budget') : t(`tripcopy.part.${p}`, { n: counts[p] }));

  const create = async () => {
    if (!validStart) {
      AccessibilityInfo.announceForAccessibility(t('tripcopy.startError'));
      return;
    }
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    const chosen = Object.fromEntries(COPY_PARTS.map((p) => [p, parts[p] && shown.includes(p)])) as CopyParts;
    const result = copyTrip(trip, packing, { startDate: start, parts: chosen, newId, name: name ?? autoName, giftNames: giftNames && counts.giftPeople > 0, leavingHome: leavingHome && counts.leavingHome > 0, comingHome: comingHome && counts.comingHome > 0 });
    const ok = await saveTrip(result.trip);
    if (!ok) {
      setSaving(false);
      setSaveFailed(true);
      AccessibilityInfo.announceForAccessibility(t('tripcopy.saveFailed.title'));
      return;
    }
    const list = result.packing;
    if (list) {
      const listSaved = await setPersistedChecked<PackStore>(PACKING_KEY, (s) => putList(s && typeof s === 'object' && !Array.isArray(s) ? s : {}, list), EMPTY_STORE);
      if (!listSaved) AccessibilityInfo.announceForAccessibility(t('tripcopy.packingFailed'));
    }
    if (postcards && postcardPeople > 0) {
      const cardsSaved = await copyPostcardPeople(trip.id, result.trip.id, newId);
      if (!cardsSaved) AccessibilityInfo.announceForAccessibility(t('postcards.copy.failed'));
    }
    AccessibilityInfo.announceForAccessibility(t('tripcopy.created', { name: result.trip.name }));
    setSaving(false);
    router.replace(`/trip/${result.trip.id}`);
  };

  const rows = parts.bookings ? preview.rows.slice(0, PREVIEW_ROWS) : [];
  return (
    <Screen>
      <Stack.Screen options={{ title: t('tripcopy.route') }} />
      <Body>{t('tripcopy.intro')}</Body>
      <DateField
        label={t('tripcopy.start')}
        typedLabel={t('tripcopy.startTyped')}
        value={start}
        onChange={setStart}
        hint={t('tripcopy.startHint')}
        fallbackDay={sameDayNextYear(trip.startDate)}
        error={validStart ? undefined : t('tripcopy.startError')}
      />
      {validStart ? (
        <View accessible accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('tripcopy.newDates', { range: formatRange(preview.startDate, preview.endDate, lang) })}</Text>
          <Body muted>{shiftLine}</Body>
        </View>
      ) : null}
      <TextField label={t('tripcopy.name')} value={name ?? autoName} onChange={setName} />

      <Card>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>
          {t('tripcopy.choose')}
        </Text>
        {shown.map((p) => (
          <View key={p} style={{ gap: space.xs }}>
            <ToggleRow label={label(p)} hint={t(`tripcopy.part.${p}Hint`)} value={parts[p]} onChange={(v) => setParts((o) => ({ ...o, [p]: v }))} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t(`tripcopy.part.${p}Hint`)}</Text>
          </View>
        ))}
        {counts.giftPeople > 0 ? (
          <View style={{ gap: space.xs }}>
            <ToggleRow label={t('f99.copy.giftNames', { n: counts.giftPeople })} hint={t('f99.copy.giftNamesHint')} value={giftNames} onChange={setGiftNames} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('f99.copy.giftNamesHint')}</Text>
          </View>
        ) : null}
        {counts.leavingHome > 0 ? (
          <View style={{ gap: space.xs }}>
            <ToggleRow label={t('f101.copy.leavingHome', { n: counts.leavingHome })} hint={t('f101.copy.leavingHomeHint')} value={leavingHome} onChange={setLeavingHome} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('f101.copy.leavingHomeHint')}</Text>
          </View>
        ) : null}
        {counts.comingHome > 0 ? (
          <View style={{ gap: space.xs }}>
            <ToggleRow label={t('f102.copy.comingHome', { n: counts.comingHome })} hint={t('f102.copy.comingHomeHint')} value={comingHome} onChange={setComingHome} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('f102.copy.comingHomeHint')}</Text>
          </View>
        ) : null}
        {postcardPeople > 0 ? (
          <View style={{ gap: space.xs }}>
            <ToggleRow label={t('postcards.copy.toggle', { n: postcardPeople })} hint={t('postcards.copy.hint')} value={postcards} onChange={setPostcards} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('postcards.copy.hint')}</Text>
          </View>
        ) : null}
        <View style={{ gap: space.xs, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
          <Label>{t('tripcopy.never.title')}</Label>
          <Body muted>{t('f104.copy.neverBody')}</Body>
        </View>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>
          {t('tripcopy.preview.title')}
        </Text>
        {!parts.bookings ? <Body muted>{t('tripcopy.preview.off')}</Body> : null}
        {parts.bookings && preview.rows.length === 0 ? <Body muted>{t('tripcopy.preview.none')}</Body> : null}
        {rows.map((r, i) => (
          <View key={r.itemId} accessible style={{ gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingTop: i ? space.s : 0 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{r.title}</Text>
            <Body>{when(r.newStart)}</Body>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('tripcopy.preview.was', { when: when(r.start) })}</Text>
          </View>
        ))}
        {parts.bookings && preview.rows.length > rows.length ? <Body muted>{t('tripcopy.preview.more', { n: preview.rows.length - rows.length })}</Body> : null}
        {parts.bookings
          ? preview.clockNotes.map((c) => (
              <Warning
                key={`${c.itemId}-${c.which}`}
                text={t(c.kind === 'skipped' ? 'tripcopy.clock.skipped' : 'tripcopy.clock.repeated', {
                  title: c.title,
                  time: formatTime(c.local),
                  day: formatDay(localDate(c.local), lang),
                  city: zoneCity(c.tz),
                  used: c.usedLocal ? formatTime(c.usedLocal) : '',
                })}
              />
            ))
          : null}
      </Card>

      {saveFailed ? <ErrorNotice title={t('tripcopy.saveFailed.title')} body={t('tripcopy.saveFailed.body')} action={t('common.tryAgain')} actionHint={t('tripcopy.createHint')} onAction={create} /> : null}
      <Button label={t('tripcopy.create')} hint={t('tripcopy.createHint')} icon="copy-outline" onPress={create} />
      <Button label={t('common.cancel')} hint={t('tripcopy.cancelHint')} kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
