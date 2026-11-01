// T127 Lost-bag kit for one bag of a trip (src/core/lostbag.ts; stored on this phone only by src/state/lostbag.ts,
// one key per trip + bag, never in a .satchel trip file). Two views, switched with timed fades:
// - Description: photos of the outside and the contents, type / colour / size / material / marks / bag-tag number,
//   the contents with rough values in their own currency (and "Add what's packed in this bag" from the packing
//   list), the total per currency and the ready-to-show text with Share.
// - Didn't arrive: the flight from the trip (latest landed unless another is chosen), the report to show at the
//   desk, what to ask (file reference, delivery to the stay you're in, essentials per the airline's own policy;
//   general guidance only), the file reference, a dated follow-up log and Share as plain text.
// Every change saves straight away. Tokens only, timed motion only (Reduce Motion respected), 48 pt targets, every
// control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Image, Text, View } from 'react-native';
import { bagsOf, filterItems, isCabin } from '../../src/core/bags.ts';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import {
  addContent,
  addFromPacking,
  addLogEntry,
  BAG_MATERIALS,
  BAG_SIZES,
  BAG_TYPES,
  cleanLostBag,
  descriptionProgress,
  descriptionText,
  editContent,
  flightDay,
  flightName,
  flightRoute,
  flightsOf,
  PHOTO_SLOTS,
  removeContent,
  removeLogEntry,
  reportFlight,
  reportText,
  rowDraft,
  stayLines,
  totalsText,
  valueTotals,
  withPhoto,
  type LostBag,
  type PhotoSlot,
  type RowError,
  type Words,
} from '../../src/core/lostbag.ts';
import { newId } from '../../src/core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, type PackStore } from '../../src/core/packing.ts';
import { formatMoney } from '../../src/core/spending.ts';
import { currentStay } from '../../src/core/staydetails.ts';
import type { Key } from '../../src/i18n/en.ts';
import { openSettings } from '../../src/native/device.ts';
import { appPath } from '../../src/native/files.ts';
import { removeBagPhotos, takeBagPhoto } from '../../src/native/lostbagPhotos.ts';
import { shareText } from '../../src/native/share.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveLostBag, useLostBag } from '../../src/state/lostbag.ts';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { bagName } from '../../src/ui/bags.tsx';
import { DateField } from '../../src/ui/DateTimeField.tsx';
import { FadeInView, HeroHeader, ProgressBar, SectionCard } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, Screen, TextField, Warning } from '../../src/ui/kit.tsx';

type View_ = 'describe' | 'report';
type Texts = { colour: string; marks: string; tag: string; reference: string };
const textsOf = (b: LostBag): Texts => ({ colour: b.colour, marks: b.marks, tag: b.tag, reference: b.reference });
const SLOT_KEYS: Record<PhotoSlot, Key> = { outside: 'lostbag.photo.outside', contents: 'lostbag.photo.contents' };
const ROW_ERR: Record<RowError, Key> = {
  empty: 'lostbag.contents.err.empty',
  value: 'lostbag.contents.err.value',
  currency: 'lostbag.contents.err.currency',
  full: 'lostbag.contents.err.full',
};

export default function LostBagScreen() {
  const params = useLocalSearchParams<{ tripId: string; bag?: string; mode?: string }>();
  const tripId = params.tripId ?? '';
  const bagId = params.bag ?? '';
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const [stored, loaded] = useLostBag(tripId, bagId);
  const latest = useRef(stored);
  latest.current = stored;
  const [view, setView] = useState<View_>(params.mode === 'report' ? 'report' : 'describe');
  const [texts, setTexts] = useState<Texts | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [row, setRow] = useState({ label: '', value: '', currency: '' });
  const [rowError, setRowError] = useState<RowError | null>(null);
  // T130: the contents row being edited in place (the form below holds its words), or null when adding.
  const [editing, setEditing] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(() => todayIn(deviceZone()));
  const [logNote, setLogNote] = useState('');
  const [logError, setLogError] = useState(false);

  useEffect(() => {
    if (loaded && texts === null) setTexts(textsOf(stored));
  }, [loaded, stored, texts]);

  const trip = trips.find((x) => x.id === tripId);
  const list = trip ? listFor(store, trip.id) : null;
  const bag = trip ? (list ? bagsOf(list) : bagsOf(null)).find((b) => b.id === bagId) : undefined;
  if (!trip || !bag) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('lostbag.title')} body={t('lostbag.notFound')} />
      </Screen>
    );
  }
  const name = bagName(t, bag);
  const where = t(isCabin(bag) ? 'lostbag.where.cabin' : 'lostbag.where.hold');
  const w: Words = (k, vars) => t(`lostbag.${k}` as Key, vars);
  const day = (d: string) => formatDay(d, lang);

  if (!loaded) {
    return (
      <Screen>
        <HeroHeader tone="emergency" compact illustration="route" eyebrow={`${t('lostbag.title')} · ${where}`} title={name} subtitle={t('lostbag.phoneOnly')} />
      </Screen>
    );
  }

  /** Applies a change to the newest stored value and saves it. */
  const update = async (fn: (b: LostBag) => LostBag): Promise<boolean> => {
    const next = cleanLostBag(fn(latest.current));
    latest.current = next;
    const ok = await saveLostBag(trip.id, bag.id, next);
    setSaveFailed(!ok);
    return ok;
  };

  const shoot = async (slot: PhotoSlot, source: 'camera' | 'photos') => {
    const label = t(SLOT_KEYS[slot]);
    const r = await takeBagPhoto(source);
    if (!r.ok) {
      if (r.reason === 'canceled') return;
      const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [{ text: t('lostbag.photos.cancel'), style: 'cancel' }];
      if (r.reason === 'denied' && r.permission !== 'ask') buttons.push({ text: t('lostbag.photos.openSettings'), onPress: openSettings });
      if (r.reason === 'unavailable' && source === 'camera') buttons.push({ text: t('lostbag.photos.fromPhotos'), onPress: () => shoot(slot, 'photos') });
      Alert.alert(t('lostbag.photos.errTitle'), t(`lostbag.photos.err.${r.reason}` as Key), buttons);
      return;
    }
    let replaced: string | null = null;
    const ok = await update((b) => {
      const x = withPhoto(b, slot, { uri: r.uri, mime: r.mime, takenAt: new Date().toISOString() });
      replaced = x.replaced;
      return x.next;
    });
    if (!ok) {
      removeBagPhotos([r.uri]);
      return;
    }
    if (replaced) removeBagPhotos([replaced]);
    AccessibilityInfo.announceForAccessibility(t('lostbag.photos.added', { slot: label }));
  };

  const removePhoto = async (slot: PhotoSlot) => {
    let replaced: string | null = null;
    const ok = await update((b) => {
      const x = withPhoto(b, slot, null);
      replaced = x.replaced;
      return x.next;
    });
    if (ok && replaced) removeBagPhotos([replaced]);
    if (ok) AccessibilityInfo.announceForAccessibility(t('lostbag.photos.removed', { slot: t(SLOT_KEYS[slot]) }));
  };

  const photoActions = (slot: PhotoSlot) =>
    Alert.alert(t(SLOT_KEYS[slot]), undefined, [
      { text: t('lostbag.photos.retake'), onPress: () => shoot(slot, 'camera') },
      { text: t('lostbag.photos.fromPhotos'), onPress: () => shoot(slot, 'photos') },
      { text: t('lostbag.photos.remove'), style: 'destructive', onPress: () => removePhoto(slot) },
      { text: t('lostbag.photos.cancel'), style: 'cancel' },
    ]);

  const setText = (k: keyof Texts, v: string) => {
    setTexts((x) => ({ ...(x ?? textsOf(stored)), [k]: v }));
    update((b) => ({ ...b, [k]: v }));
  };

  const addRow = async () => {
    const currency = row.currency || stored.currency;
    const id = newId('lb');
    const r = addContent(latest.current, row.label, row.value, currency, id);
    if (r.error) {
      setRowError(r.error);
      return;
    }
    setRowError(null);
    const label = r.next.contents[r.next.contents.length - 1]?.label ?? row.label;
    if (await update(() => r.next)) {
      setRow({ label: '', value: '', currency: r.next.currency });
      AccessibilityInfo.announceForAccessibility(t('lostbag.contents.added', { label }));
    }
  };

  const startEdit = (id: string) => {
    const r = latest.current.contents.find((x) => x.id === id);
    if (!r) return;
    setEditing(id);
    setRowError(null);
    setRow(rowDraft(r, latest.current.currency));
    AccessibilityInfo.announceForAccessibility(t('f102.lostbag.editing', { label: r.label }));
  };

  const cancelEdit = () => {
    setEditing(null);
    setRowError(null);
    setRow({ label: '', value: '', currency: latest.current.currency });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!latest.current.contents.some((x) => x.id === editing)) {
      cancelEdit();
      return;
    }
    const r = editContent(latest.current, editing, row.label, row.value, row.currency || stored.currency);
    if (r.error) {
      setRowError(r.error);
      return;
    }
    setRowError(null);
    const label = r.next.contents.find((x) => x.id === editing)?.label ?? row.label;
    if (await update(() => r.next)) {
      setEditing(null);
      setRow({ label: '', value: '', currency: r.next.currency });
      AccessibilityInfo.announceForAccessibility(t('f102.lostbag.saved', { label }));
    }
  };

  const addPacked = async () => {
    const labels = list ? filterItems(list, bag.id).map((i) => i.label) : [];
    const r = addFromPacking(latest.current, labels, () => newId('lb'));
    if (r.added) await update(() => r.next);
    AccessibilityInfo.announceForAccessibility(r.added ? t('lostbag.contents.fromPackingDone', { n: r.added }) : t('lostbag.contents.fromPackingNone'));
  };

  const addLog = async () => {
    const next = addLogEntry(latest.current, logDate, logNote, newId('lg'));
    if (!next) {
      setLogError(true);
      return;
    }
    setLogError(false);
    if (await update(() => next)) {
      setLogNote('');
      AccessibilityInfo.announceForAccessibility(t('lostbag.log.added'));
    }
  };

  const share = async (text: string) => {
    const r = await shareText(text, t('lostbag.share.subject', { name }));
    setShareFailed(r === 'failed');
  };

  const tx = texts ?? textsOf(stored);
  const progress = descriptionProgress(stored);
  const totals = valueTotals(stored.contents);
  const now = Date.now();
  const flights = flightsOf(trip);
  const flight = reportFlight(trip, stored.flightId, now);
  const stay = (currentStay([trip], now) ?? currentStay(trips, now))?.item ?? null;
  const desc = descriptionText(stored, name, w, { lang, day });
  const report = reportText({ bag: stored, bagName: name, flight, stay }, w, { lang, day });
  const packedCount = list ? filterItems(list, bag.id).length : 0;
  const currencyShown = row.currency || stored.currency;

  const choiceRow = <T extends string>(group: Key, values: readonly T[], keyOf: (v: T) => Key, value: T | null, field: 'type' | 'size' | 'material') => (
    <>
      <Label>{t(group)}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t(group)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {values.map((v) => (
          <Chip
            key={v}
            label={t(keyOf(v))}
            a11yLabel={t('lostbag.chipA11y', { group: t(group), value: t(keyOf(v)) })}
            hint={t('lostbag.chipHint')}
            selected={value === v}
            onPress={() => update((b) => ({ ...b, [field]: b[field] === v ? null : v }))}
          />
        ))}
      </View>
    </>
  );

  return (
    <Screen>
      <HeroHeader tone="emergency" compact illustration="route" eyebrow={`${t('lostbag.title')} · ${where}`} title={name} subtitle={t('lostbag.phoneOnly')} />
      <View accessibilityRole="radiogroup" accessibilityLabel={t('lostbag.tab.label')} style={{ flexDirection: 'row', gap: space.s }}>
        <Chip label={t('lostbag.tab.describe')} hint={t('lostbag.tab.describeHint')} selected={view === 'describe'} onPress={() => setView('describe')} />
        <Chip label={t('lostbag.tab.report')} hint={t('lostbag.tab.reportHint')} selected={view === 'report'} onPress={() => setView('report')} />
      </View>
      {saveFailed ? <Warning text={t('lostbag.saveFailed')} /> : null}
      {shareFailed ? <Warning text={t('lostbag.share.failed')} /> : null}

      {view === 'describe' ? (
        <FadeInView key="describe" style={{ gap: space.l }}>
          <SectionCard title={t('lostbag.photos.title')} subtitle={t('lostbag.photos.count', { n: PHOTO_SLOTS.filter((s) => stored.photos[s]).length })} icon="camera-outline" tone="sea">
            <Body muted>{t('lostbag.photos.body')}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {PHOTO_SLOTS.map((slot) => {
                const label = t(SLOT_KEYS[slot]);
                const photo = stored.photos[slot];
                return (
                  <PressableScale
                    key={slot}
                    accessibilityRole="button"
                    accessibilityLabel={photo ? t('lostbag.photos.shotA11y', { slot: label }) : t('lostbag.photos.takeA11y', { slot: label })}
                    accessibilityHint={photo ? t('lostbag.photos.shotHint') : t('lostbag.photos.takeHint')}
                    onPress={() => (photo ? photoActions(slot) : shoot(slot, 'camera'))}
                    style={{
                      flexBasis: '47%',
                      flexGrow: 1,
                      aspectRatio: 4 / 3,
                      minHeight: TOUCH,
                      borderRadius: radius.m,
                      borderWidth: 1,
                      borderColor: photo ? theme.ok : theme.line,
                      borderStyle: photo ? 'solid' : 'dashed',
                      backgroundColor: theme.seaSoft,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {photo ? <Image source={{ uri: appPath(photo.uri) }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
                    <View style={{ alignItems: 'center', gap: space.xs, paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: photo ? theme.card : undefined }}>
                      <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{label}</Text>
                      {photo ? null : <Text style={[typeScale.small, { color: theme.sea }]}>{t('lostbag.photos.take')}</Text>}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard title={t('lostbag.desc.title')} subtitle={t('lostbag.desc.progress', { done: progress.done, total: progress.total })} icon="briefcase-outline" tone="ok">
            <ProgressBar progress={progress.done / progress.total} tone="ok" label={t('lostbag.desc.progress', { done: progress.done, total: progress.total })} />
            {choiceRow('lostbag.desc.type', BAG_TYPES, (v) => `lostbag.type.${v}` as Key, stored.type, 'type')}
            <TextField label={t('lostbag.desc.colour')} value={tx.colour} onChange={(v) => setText('colour', v)} placeholder={t('lostbag.desc.colourPlaceholder')} />
            {choiceRow('lostbag.desc.size', BAG_SIZES, (v) => `lostbag.size.${v}` as Key, stored.size, 'size')}
            {choiceRow('lostbag.desc.material', BAG_MATERIALS, (v) => `lostbag.material.${v}` as Key, stored.material, 'material')}
            <TextField label={t('lostbag.desc.marks')} value={tx.marks} onChange={(v) => setText('marks', v)} placeholder={t('lostbag.desc.marksPlaceholder')} multiline />
            <TextField label={t('lostbag.desc.tag')} value={tx.tag} onChange={(v) => setText('tag', v)} placeholder={t('lostbag.desc.tagPlaceholder')} autoCapitalize="none" />
          </SectionCard>

          <SectionCard
            title={t('lostbag.contents.title')}
            subtitle={stored.contents.length === 1 ? t('lostbag.contents.countOne') : t('lostbag.contents.count', { n: stored.contents.length })}
            icon="list-outline"
            tone="teal"
          >
            {stored.contents.length === 0 ? <Body muted>{t('lostbag.contents.empty')}</Body> : null}
            {stored.contents.map((r) => (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.s,
                  borderRadius: radius.m,
                  paddingLeft: space.xs,
                  backgroundColor: editing === r.id ? theme.accentSoft : 'transparent',
                }}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('f102.lostbag.editA11y', { label: r.label })}
                  accessibilityHint={t('f102.lostbag.editHint')}
                  accessibilityState={{ selected: editing === r.id }}
                  onPress={() => startEdit(r.id)}
                  style={{ flex: 1, minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.s }}
                >
                  <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{r.label}</Text>
                  {r.value !== null ? <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{formatMoney(r.value, r.currency, lang)}</Text> : null}
                  <Ionicons name="create-outline" size={20} color={theme.muted} />
                </PressableScale>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('lostbag.contents.removeA11y', { label: r.label })}
                  onPress={async () => {
                    if (await update((b) => removeContent(b, r.id))) {
                      if (editing === r.id) cancelEdit();
                      AccessibilityInfo.announceForAccessibility(t('lostbag.contents.removed', { label: r.label }));
                    }
                  }}
                  style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close-circle-outline" size={22} color={theme.muted} />
                </PressableScale>
              </View>
            ))}
            {totals.length ? (
              <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
                {t('lostbag.contents.total', { total: totalsText(totals, lang) })}
              </Text>
            ) : null}
            {editing ? <Label>{t('f102.lostbag.editTitle')}</Label> : null}
            <TextField label={t('lostbag.contents.thing')} value={row.label} onChange={(v) => setRow((x) => ({ ...x, label: v }))} placeholder={t('lostbag.contents.thingPlaceholder')} />
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <View style={{ flex: 2 }}>
                <TextField label={t('lostbag.contents.value')} value={row.value} onChange={(v) => setRow((x) => ({ ...x, value: v }))} inputMode="decimal" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('lostbag.contents.currency')}
                  value={currencyShown}
                  onChange={(v) => setRow((x) => ({ ...x, currency: v.toUpperCase().slice(0, 3) }))}
                  placeholder={t('lostbag.contents.currencyPlaceholder')}
                  autoCapitalize="none"
                />
              </View>
            </View>
            {rowError ? <Warning text={t(ROW_ERR[rowError])} /> : null}
            {editing ? (
              <View style={{ gap: space.s }}>
                <Button icon="checkmark" label={t('f102.lostbag.save')} hint={t('f102.lostbag.saveHint')} onPress={saveEdit} />
                <Button kind="quiet" icon="close" label={t('f102.lostbag.cancel')} hint={t('f102.lostbag.cancelHint')} onPress={cancelEdit} />
              </View>
            ) : (
              <Button icon="add" label={t('lostbag.contents.add')} hint={t('lostbag.contents.addHint')} onPress={addRow} />
            )}
            {packedCount && !editing ? <Button kind="secondary" icon="file-tray-stacked-outline" label={t('lostbag.contents.fromPacking')} hint={t('lostbag.contents.fromPackingHint')} onPress={addPacked} /> : null}
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('lostbag.contents.foot')}</Text>
          </SectionCard>

          <SectionCard title={t('lostbag.preview.title')} icon="eye-outline" tone="accent">
            <Text selectable style={[typeScale.body, { color: theme.ink }]}>
              {desc}
            </Text>
            <Button kind="secondary" icon="share-outline" label={t('lostbag.share.desc')} hint={t('lostbag.share.descHint')} onPress={() => share(desc)} />
          </SectionCard>
        </FadeInView>
      ) : (
        <FadeInView key="report" style={{ gap: space.l }}>
          <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start', backgroundColor: theme.seaSoft, borderRadius: radius.m, padding: space.m }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
              <Ionicons name="information-circle" size={20} color={theme.sea} />
            </View>
            <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('lostbag.report.intro')}</Text>
          </View>

          <SectionCard title={t('lostbag.flight.title')} icon="airplane-outline" tone="sea">
            {flights.length === 0 ? (
              <Body muted>{t('lostbag.flight.none')}</Body>
            ) : (
              <View accessibilityRole="radiogroup" accessibilityLabel={t('lostbag.flight.title')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {flights.map((f) => (
                  <Chip
                    key={f.id}
                    label={`${flightName(f)} · ${day(flightDay(f))}`}
                    a11yLabel={t('lostbag.flight.chipA11y', { name: flightName(f), route: flightRoute(f), day: day(flightDay(f)) })}
                    hint={t('lostbag.flight.chipHint')}
                    selected={flight?.id === f.id}
                    onPress={() => update((b) => ({ ...b, flightId: f.id }))}
                  />
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard title={t('lostbag.show.title')} icon="document-text-outline" tone="accent">
            <Text selectable style={[typeScale.body, { color: theme.ink }]}>
              {report.trim()}
            </Text>
            <Button icon="share-outline" label={t('lostbag.share.report')} hint={t('lostbag.share.reportHint')} onPress={() => share(report)} />
          </SectionCard>

          <SectionCard title={t('lostbag.ask.title')} icon="help-circle-outline" tone="warn">
            {(
              [
                ['lostbag.ask.reference', null],
                ['lostbag.ask.address', stay ? stayLines(stay).join('\n') : t('lostbag.ask.noStay')],
                ['lostbag.ask.essentials', null],
                ['lostbag.ask.contact', null],
                ['lostbag.ask.copy', null],
              ] as [Key, string | null][]
            ).map(([k, extra]) => (
              <View key={k} accessible style={{ flexDirection: 'row', gap: space.s }}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: space.xs }}>
                  <Ionicons name="ellipse" size={8} color={theme.warn} />
                </View>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={[typeScale.body, { color: theme.ink }]}>{t(k)}</Text>
                  {extra ? (
                    <Text selectable style={[typeScale.bodyStrong, { color: theme.ink }]}>
                      {extra}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('lostbag.ask.foot')}</Text>
          </SectionCard>

          <SectionCard title={t('lostbag.reference.title')} icon="pricetag-outline" tone="teal">
            <TextField label={t('lostbag.reference.label')} value={tx.reference} onChange={(v) => setText('reference', v)} placeholder={t('lostbag.reference.placeholder')} autoCapitalize="none" />
          </SectionCard>

          <SectionCard title={t('lostbag.log.title')} icon="time-outline" tone="ok">
            {stored.log.length === 0 ? <Body muted>{t('lostbag.log.empty')}</Body> : null}
            {stored.log.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <View accessible accessibilityLabel={t('lostbag.log.entryA11y', { day: day(e.date), note: e.note })} style={{ flex: 1, gap: 2 }}>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{day(e.date)}</Text>
                  <Text style={[typeScale.body, { color: theme.ink }]}>{e.note}</Text>
                </View>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('lostbag.log.removeA11y', { day: day(e.date) })}
                  onPress={async () => {
                    if (await update((b) => removeLogEntry(b, e.id))) AccessibilityInfo.announceForAccessibility(t('lostbag.log.removed'));
                  }}
                  style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close-circle-outline" size={22} color={theme.muted} />
                </PressableScale>
              </View>
            ))}
            <DateField label={t('lostbag.log.date')} typedLabel={t('lostbag.log.dateTyped')} hint={t('lostbag.log.dateHint')} value={logDate} onChange={setLogDate} fallbackDay={todayIn(deviceZone())} />
            <TextField label={t('lostbag.log.note')} value={logNote} onChange={setLogNote} placeholder={t('lostbag.log.notePlaceholder')} multiline />
            {logError ? <Warning text={t('lostbag.log.err')} /> : null}
            <Button kind="secondary" icon="add" label={t('lostbag.log.add')} hint={t('lostbag.log.addHint')} onPress={addLog} />
          </SectionCard>
        </FadeInView>
      )}
    </Screen>
  );
}
