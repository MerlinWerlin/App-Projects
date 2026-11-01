// New / edit booking form, fields per kind (FLOWS §4). Times are as printed on the ticket, in that place's own time
// zone, shown back beside the date and time; a time that a daylight-saving change skips or repeats is pointed out.
// Leaving with unsaved changes asks first; errors sit beside their fields and are announced.
// T44 (FLOWS §4.1 item 6): an Attachments section edits a draft list that is saved with the booking. After a
// successful Save the copies of removed files are deleted; leaving without saving deletes only the copies added in
// this form, so the saved booking and its files are untouched by Cancel or Discard.
// T72: each place (hotel / activity / car hire, or a journey's from and to) can be put on the map (PositionField).
// T77: opened with ?paste=<key> from Paste a booking, the form starts filled from the pasted draft (src/state/
// pasteDraft.ts) with a note to check every field; nothing is saved until Save, and leaving asks first.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { deviceZone, formatDay, formatTime, zoneCity } from '../src/core/format.ts';
import { ITEM_KINDS, isTransport, type Attachment, type ItemKind } from '../src/core/model.ts';
import { droppedFiles, sameAttachments } from '../src/core/tickets.ts';
import {
  draftChanged,
  draftFromItem,
  hasCarrier,
  hasEnd,
  hasNumber,
  hasPlace,
  hasRef,
  itemFromDraft,
  newItemDraft,
  validateItem,
  type ItemDraft,
  type ItemError,
} from '../src/core/trips.ts';
import { checkWallTime, isLocalDateTime, isValidZone } from '../src/core/tz.ts';
import { removeAppFiles } from '../src/native/files.ts';
import { markPasteSaved, pastedDraft } from '../src/state/pasteDraft.ts';
import { isStay } from '../src/core/staydetails.ts';
import { fillStayWifi } from '../src/state/stay.ts';
import { useApp } from '../src/state/app.tsx';
import { findItem, useTrips } from '../src/state/trips.tsx';
import { space } from '../src/theme/tokens.ts';
import { AirportFields, useAirportForm } from '../src/ui/AirportFields.tsx';
import { AttachmentsField } from '../src/ui/AttachmentsField.tsx';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { ErrorNotice } from '../src/ui/ErrorNotice.tsx';
import { KindIcon, carrierKey, formTitleKey, kindKey, numberKey, titleKey } from '../src/ui/kinds.tsx';
import { PositionField } from '../src/ui/PositionField.tsx';
import { DateField, TimeField } from '../src/ui/DateTimeField.tsx';
import { Body, Button, Chip, EmptyState, Label, Screen, TextField, Warning } from '../src/ui/kit.tsx';
import { ZoneField } from '../src/ui/ZonePicker.tsx';

export default function ItemEditScreen() {
  const params = useLocalSearchParams<{ tripId: string; id?: string; kind?: string; date?: string; paste?: string }>();
  const { t, theme, lang } = useApp();
  const { trips, saveItem } = useTrips();
  const router = useRouter();
  const trip = trips.find((x) => x.id === params.tripId);
  const prev = params.id ? findItem(trips, params.id)?.item : undefined;
  const lastTz = trip?.items.length ? trip.items[trip.items.length - 1].end?.tz ?? trip.items[trip.items.length - 1].start.tz : undefined;
  const [pasted] = useState(() => (prev ? undefined : pastedDraft(params.paste)));
  const [initial] = useState<ItemDraft>(() => {
    if (prev) return draftFromItem(prev);
    const kind = (ITEM_KINDS as readonly string[]).includes(params.kind ?? '') ? (params.kind as ItemKind) : 'activity';
    return newItemDraft(kind, params.date ?? trip?.startDate ?? '', lastTz ?? deviceZone());
  });
  // A pasted draft counts as unsaved from the start, so leaving without Save always asks.
  const [d, setD] = useState<ItemDraft>(() => (pasted ? { ...pasted.draft } : initial));
  const [errors, setErrors] = useState<ItemError[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [initialFiles] = useState<Attachment[]>(() => prev?.attachments ?? []);
  const [files, setFiles] = useState<Attachment[]>(initialFiles);
  const airport = useAirportForm(prev, pasted?.airport);
  const savedIds = useMemo(() => new Set(initialFiles.map((a) => a.id)), [initialFiles]);
  // Every file copied in by this form, and whether the booking was saved: on leaving unsaved, those copies go.
  const addedFiles = useRef<Attachment[]>([]);
  const committed = useRef(false);
  useEffect(
    () => () => {
      if (!committed.current) removeAppFiles(droppedFiles(addedFiles.current, initialFiles));
    },
    [initialFiles],
  );
  const { leaving, gestureEnabled } = useDiscardConfirm(draftChanged(initial, d) || !sameAttachments(initialFiles, files) || airport.changed);
  const set = (k: keyof ItemDraft) => (v: string) => setD((o) => ({ ...o, [k]: v }));
  // A position taken from one of the trip's places also fills its name field when that is still empty.
  const setPos = (k: 'placePos' | 'fromPos' | 'toPos', nameKey: 'placeName' | 'fromName' | 'toName') => (v: string, name?: string) =>
    setD((o) => ({ ...o, [k]: v, ...(name && !o[nameKey].trim() ? { [nameKey]: name } : {}) }));
  const err = (e: ItemError) => (errors.includes(e) ? t(`itemEdit.err.${e}`) : undefined);
  // Zones already used on this trip, plus the phone's: one tap to fill a zone field.
  const zones = useMemo(() => {
    const s = new Set<string>([deviceZone()]);
    for (const it of trip?.items ?? []) {
      s.add(it.start.tz);
      if (it.end) s.add(it.end.tz);
    }
    return [...s].slice(0, 6);
  }, [trip]);

  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('item.title')} body={t('trip.notFound')} />
      </Screen>
    );
  }

  const save = async () => {
    const e = validateItem(d);
    setErrors(e);
    if (e.length) {
      AccessibilityInfo.announceForAccessibility(t('spec.form.checkFields'));
      return;
    }
    // Leave only once it is stored; otherwise stay open with what was typed (STATES_COPY error.item.save).
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    const item = { ...airport.apply(itemFromDraft(d, trip.id, prev)), attachments: files };
    const ok = await saveItem(item);
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      AccessibilityInfo.announceForAccessibility(t('error.item.save.title'));
      return;
    }
    // Saved: copies no longer listed (removed saved files, or ones added then removed here) go; the rest belong to the item.
    committed.current = true;
    // T80: Paste a booking shows this card as "Saved" from now on.
    if (pasted?.fingerprint) markPasteSaved(pasted.fingerprint, trip.id, item.id);
    // T112: Wi-Fi from the pasted hotel confirmation fills this booking's empty Stay details fields.
    if (pasted?.wifi && isStay(item)) {
      void fillStayWifi(item.id, pasted.wifi).then((filled) => filled && AccessibilityInfo.announceForAccessibility(t('f97.paste.wifiFilled')));
    }
    removeAppFiles(droppedFiles([...initialFiles, ...addedFiles.current], files));
    leaving();
    router.back();
  };

  const zoneChip = (city: string) => t('itemEdit.useZone', { city });

  /** "Tue, Nov 3 · 09:30 Tokyo time" beside the fields, plus a note if daylight saving skips or repeats that time. */
  const whenNote = (date: string, time: string, tz: string) => {
    const local = `${date}T${time}`;
    if (!/^\d{2}:\d{2}$/.test(time) || !isLocalDateTime(local) || !isValidZone(tz)) return null;
    const city = zoneCity(tz);
    const check = checkWallTime({ local, tz });
    return (
      <>
        <Body muted>{`${formatDay(date, lang)} · ${t('item.zone', { time, city })}`}</Body>
        {check.kind === 'skipped' ? <Warning text={t('spec.itemEdit.dstSkipped', { time, city, used: formatTime(check.usedLocal) })} /> : null}
        {check.kind === 'repeated' ? <Warning text={t('spec.itemEdit.dstRepeated', { time, city })} /> : null}
      </>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t(formTitleKey(d.kind, !!prev)), gestureEnabled }} />
      {pasted ? <Warning text={t('paste.form.banner')} /> : null}
      <Label>{t('itemEdit.kind')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('itemEdit.kind')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {ITEM_KINDS.map((k) => (
          <Chip key={k} label={t(kindKey(k))} selected={d.kind === k} icon={<KindIcon kind={k} color={theme.accent} size={18} />} onPress={() => set('kind')(k)} />
        ))}
      </View>
      <TextField
        label={t(titleKey(d.kind))}
        value={d.title}
        onChange={set('title')}
        placeholder={isTransport(d.kind) ? t('itemEdit.namePlaceholder') : undefined}
        error={err('title')}
      />
      {isTransport(d.kind) ? (
        <>
          <TextField label={t('item.from')} value={d.fromName} onChange={set('fromName')} />
          <PositionField label={t('position.from')} value={d.fromPos} onChange={setPos('fromPos', 'fromName')} trip={trip} itemId={prev?.id} />
          <TextField label={t('item.to')} value={d.toName} onChange={set('toName')} />
          <PositionField label={t('position.to')} value={d.toPos} onChange={setPos('toPos', 'toName')} trip={trip} itemId={prev?.id} />
        </>
      ) : null}
      <Body muted>{t('itemEdit.tzHint')}</Body>
      <DateField label={t('pickers.item.startDate')} typedLabel={t('itemEdit.startDate')} value={d.startDate} onChange={set('startDate')} hint={t('pickers.hint.startDate')} fallbackDay={trip.startDate} error={err('start')} />
      <TimeField label={t('pickers.item.startTime')} typedLabel={t('itemEdit.startTime')} value={d.startTime} onChange={set('startTime')} hint={t('pickers.hint.startTime')} zone={d.startTz} />
      <ZoneField label={t('itemEdit.startTz')} value={d.startTz} onChange={set('startTz')} hint={t('pickers.hint.itemZone')} error={err('startTz')} suggestions={zones} chipLabel={zoneChip} />
      {whenNote(d.startDate, d.startTime, d.startTz)}
      {hasEnd(d.kind) ? (
        <>
          <DateField label={t('pickers.item.endDate')} typedLabel={t('itemEdit.endDate')} value={d.endDate} onChange={set('endDate')} hint={t('pickers.hint.endDate')} fallbackDay={d.startDate || trip.startDate} error={err('end') ?? err('endRequired') ?? err('endBeforeStart')} />
          <TimeField label={t('pickers.item.endTime')} typedLabel={t('itemEdit.endTime')} value={d.endTime} onChange={set('endTime')} hint={t('pickers.hint.endTime')} zone={d.endTz} />
          <ZoneField label={t('itemEdit.endTz')} value={d.endTz} onChange={set('endTz')} hint={t('pickers.hint.itemZone')} error={err('endTz')} suggestions={zones} chipLabel={zoneChip} />
          {whenNote(d.endDate, d.endTime, d.endTz)}
        </>
      ) : null}
      {hasPlace(d.kind) ? (
        <>
          <TextField label={t('item.place')} value={d.placeName} onChange={set('placeName')} />
          <TextField label={t('item.address')} value={d.address} onChange={set('address')} multiline />
          <TextField label={t('item.localAddress')} value={d.localAddress} onChange={set('localAddress')} multiline />
          <TextField label={t('itemEdit.placePhone')} value={d.placePhone} onChange={set('placePhone')} placeholder={t('itemEdit.placePhonePlaceholder')} inputMode="tel" />
          <PositionField label={t('position.place')} value={d.placePos} onChange={setPos('placePos', 'placeName')} trip={trip} itemId={prev?.id} />
        </>
      ) : null}
      {hasCarrier(d.kind) ? <TextField label={t(carrierKey(d.kind))} value={d.carrier} onChange={set('carrier')} /> : null}
      {hasNumber(d.kind) ? (
        <>
          <TextField label={t(numberKey(d.kind))} value={d.number} onChange={set('number')} />
          <TextField label={t('item.seat')} value={d.seat} onChange={set('seat')} autoCapitalize="none" />
        </>
      ) : null}
      {d.kind === 'flight' ? <AirportFields form={airport} start={{ date: d.startDate, time: d.startTime, tz: d.startTz }} endTz={d.endTz} /> : null}
      {hasRef(d.kind) ? <TextField label={t('item.ref')} value={d.ref} onChange={set('ref')} autoCapitalize="none" /> : null}
      <TextField label={t('item.notes')} value={d.notes} onChange={set('notes')} multiline />
      <AttachmentsField
        attachments={files}
        kind={d.kind}
        savedIds={savedIds}
        onAdd={(a) => {
          addedFiles.current = [...addedFiles.current, a];
          setFiles((o) => [...o, a]);
        }}
        onRemove={(a) => setFiles((o) => o.filter((x) => x.id !== a.id))}
      />
      {saveFailed ? (
        <ErrorNotice title={t('error.item.save.title')} body={t('error.item.save.body')} action={t('common.tryAgain')} actionHint={t('error.saveRetryHint')} onAction={save} />
      ) : null}
      <Button label={t('itemEdit.save')} hint={t('spec.itemEdit.saveHint')} onPress={save} />
      <Button label={t('common.cancel')} hint={t('spec.itemEdit.cancelHint')} kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
