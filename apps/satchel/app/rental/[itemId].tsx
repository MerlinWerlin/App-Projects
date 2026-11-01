// T122 Rental car checklist for one car booking (src/core/driving.ts; stored on this phone only by
// src/state/rental.ts, one key per booking, never part of a .satchel trip file):
// - pick-up photos of every side (front, back, left, right) with the camera (Photos when there is no camera),
//   copied into Satchel's own folder and kept on this phone;
// - fuel level (eighths) and odometer (km or miles) at pick-up and at return, with the distance driven in both
//   units and a "less fuel than at pick-up" note;
// - the return time from the booking's drop-off (its own zone's clock) and a leave-by line from the traveller's
//   time to the return desk plus a refuel / hand-back buffer;
// - rental desk phone with tap-to-call, excess and insurance notes (general note: check before you sign).
// Every change saves straight away. Tokens only, timed motion only, 48 pt targets, every control labelled.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Image, Text, View } from 'react-native';
import {
  checklistProgress,
  carCountries,
  cleanRental,
  compareReturn,
  findDriving,
  FUEL_STEPS,
  fuelFraction,
  isCarBooking,
  isEmptyRental,
  ODO_UNITS,
  parseOdo,
  photoCount,
  PHOTO_SIDES,
  returnPlan,
  stepTravel,
  STAGES,
  withPhoto,
  withReading,
  type OdoUnit,
  type PhotoSide,
  type RentalChecklist,
  type Stage,
} from '../../src/core/driving.ts';
import { formatDay, formatTime } from '../../src/core/format.ts';
import { dialable } from '../../src/core/staydetails.ts';
import { localDate } from '../../src/core/tz.ts';
import type { Key } from '../../src/i18n/en.ts';
import { openSettings } from '../../src/native/device.ts';
import { appPath } from '../../src/native/files.ts';
import { removeRentalPhotos, takeRentalPhoto } from '../../src/native/rentalPhotos.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveRental, useRental } from '../../src/state/rental.ts';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { radius, space, typeScale } from '../../src/theme/tokens.ts';
import { DRIVING_TABLE } from '../../src/ui/driving.tsx';
import { callAndExplain } from '../../src/ui/EmergencyCardView.tsx';
import { FadeInView, HeroHeader, ProgressBar, SectionCard } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, Screen, TextField, Warning } from '../../src/ui/kit.tsx';

const SIDE_KEYS: Record<PhotoSide, Key> = {
  front: 'driving.photos.side.front',
  rear: 'driving.photos.side.rear',
  left: 'driving.photos.side.left',
  right: 'driving.photos.side.right',
};
const STAGE_KEYS: Record<Stage, Key> = { pickup: 'driving.reading.pickup', return: 'driving.reading.return' };
const UNIT_KEYS: Record<OdoUnit, Key> = { km: 'driving.unit.km', mi: 'driving.unit.mi' };

type Texts = { pickupOdo: string; returnOdo: string; deskPhone: string; excess: string; insurance: string };
const textsOf = (c: RentalChecklist): Texts => ({
  pickupOdo: c.pickup.odo === null ? '' : String(c.pickup.odo),
  returnOdo: c.return.odo === null ? '' : String(c.return.odo),
  deskPhone: c.deskPhone,
  excess: c.excess,
  insurance: c.insurance,
});

export default function RentalScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = itemId ?? '';
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const [stored, loaded] = useRental(id);
  const latest = useRef(stored);
  latest.current = stored;
  const [texts, setTexts] = useState<Texts | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (loaded && texts === null) setTexts(textsOf(stored));
  }, [loaded, stored, texts]);

  const found = findItem(trips, id);
  if (!found || !isCarBooking(found.item)) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('driving.rental.title')} body={t(found ? 'driving.rental.notCar' : 'driving.rental.notFound')} />
      </Screen>
    );
  }
  const { item } = found;
  const name = item.place?.name?.trim() || item.title;
  const country = carCountries(item).map((c) => findDriving(DRIVING_TABLE, c)).find((r) => !!r) ?? null;
  const defaultUnit: OdoUnit = country?.speed === 'mph' ? 'mi' : 'km';
  const empty = isEmptyRental(stored);
  const unit: OdoUnit = empty ? defaultUnit : stored.odoUnit;

  /** Applies a change to the newest stored value and saves it. The first change also fixes the odometer unit. */
  const update = async (fn: (c: RentalChecklist) => RentalChecklist): Promise<boolean> => {
    const base = isEmptyRental(latest.current) ? { ...latest.current, odoUnit: defaultUnit } : latest.current;
    const next = cleanRental(fn(base));
    latest.current = next;
    const ok = await saveRental(item.id, next);
    setSaveFailed(!ok);
    return ok;
  };

  const shoot = async (side: PhotoSide, source: 'camera' | 'photos') => {
    const label = t(SIDE_KEYS[side]);
    const r = await takeRentalPhoto(source);
    if (!r.ok) {
      if (r.reason === 'canceled') return;
      const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [{ text: t('common.cancel'), style: 'cancel' }];
      if (r.reason === 'denied' && r.permission !== 'ask') buttons.push({ text: t('driving.photos.openSettings'), onPress: openSettings });
      if (r.reason === 'unavailable' && source === 'camera') buttons.push({ text: t('driving.photos.usePhotos'), onPress: () => shoot(side, 'photos') });
      Alert.alert(t('driving.photos.errTitle'), t(`driving.photos.err.${r.reason}` as Key), buttons);
      return;
    }
    let replaced: string | null = null;
    const ok = await update((c) => {
      const w = withPhoto(c, side, { uri: r.uri, mime: r.mime, takenAt: new Date().toISOString() });
      replaced = w.replaced;
      return w.next;
    });
    if (!ok) {
      removeRentalPhotos([r.uri]);
      return;
    }
    if (replaced) removeRentalPhotos([replaced]);
    AccessibilityInfo.announceForAccessibility(t('driving.photos.added', { side: label }));
  };

  const removePhoto = async (side: PhotoSide) => {
    let replaced: string | null = null;
    const ok = await update((c) => {
      const w = withPhoto(c, side, null);
      replaced = w.replaced;
      return w.next;
    });
    if (ok && replaced) removeRentalPhotos([replaced]);
    if (ok) AccessibilityInfo.announceForAccessibility(t('driving.photos.removed', { side: t(SIDE_KEYS[side]) }));
  };

  const photoActions = (side: PhotoSide) =>
    Alert.alert(t(SIDE_KEYS[side]), undefined, [
      { text: t('driving.photos.retake'), onPress: () => shoot(side, 'camera') },
      { text: t('driving.photos.remove'), style: 'destructive', onPress: () => removePhoto(side) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const setText = (k: keyof Texts, v: string) => {
    setTexts((x) => ({ ...(x ?? textsOf(stored)), [k]: v }));
    if (k === 'pickupOdo' || k === 'returnOdo') {
      const stage: Stage = k === 'pickupOdo' ? 'pickup' : 'return';
      const odo = v.trim() ? parseOdo(v) : null;
      if (v.trim() && odo === null) return; // shown as an error; the saved reading stays as it was
      update((c) => withReading(c, stage, { odo }));
      return;
    }
    update((c) => ({ ...c, [k]: v }));
  };

  const tx = texts ?? textsOf(stored);
  const progress = checklistProgress(stored);
  const cmp = compareReturn({ ...stored, odoUnit: unit });
  const plan = returnPlan(item, stored.travelMin);
  const phone = stored.deskPhone && dialable(stored.deskPhone) ? stored.deskPhone : '';

  if (!loaded) {
    return (
      <Screen>
        <HeroHeader tone="trips" compact illustration="route" eyebrow={t('driving.rental.title')} title={name} subtitle={t('driving.rental.phoneOnly')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <HeroHeader tone="trips" compact illustration="route" eyebrow={t('driving.rental.title')} title={name} subtitle={t('driving.rental.phoneOnly')} />
      <FadeInView style={{ gap: space.l }}>
        <View style={{ gap: space.xs }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('driving.rental.progress', { done: progress.done, total: progress.total })}</Text>
          <ProgressBar progress={progress.done / progress.total} tone="ok" label={t('driving.rental.progressA11y', { done: progress.done, total: progress.total })} />
        </View>
        {saveFailed ? <Warning text={t('driving.rental.saveFailed')} /> : null}

        {country ? (
          <Button
            kind="secondary"
            icon="car-outline"
            label={`${t(country.side === 'left' ? 'driving.side.left' : 'driving.side.right')} · ${t('driving.linkTitle', { country: country.country })}`}
            hint={t('driving.rental.guideHint', { country: country.country })}
            onPress={() => router.push({ pathname: '/driving/[iso2]', params: { iso2: country.iso2, tripId: found.trip.id } })}
          />
        ) : null}

        <SectionCard title={t('driving.photos.title')} subtitle={t('driving.photos.count', { n: photoCount(stored) })} icon="camera-outline" tone="sea">
          <Body muted>{t('driving.photos.body')}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {PHOTO_SIDES.map((side) => {
              const label = t(SIDE_KEYS[side]);
              const photo = stored.photos[side];
              return (
                <PressableScale
                  key={side}
                  accessibilityRole="button"
                  accessibilityLabel={photo ? t('driving.photos.shotA11y', { side: label }) : t('driving.photos.takeA11y', { side: label })}
                  accessibilityHint={photo ? t('driving.photos.shotHint') : t('driving.photos.takeHint')}
                  onPress={() => (photo ? photoActions(side) : shoot(side, 'camera'))}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    aspectRatio: 4 / 3,
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
                    {photo ? null : <Text style={[typeScale.small, { color: theme.sea }]}>{t('driving.photos.take')}</Text>}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </SectionCard>

        {STAGES.map((stage) => {
          const reading = stored[stage];
          const odoText = stage === 'pickup' ? tx.pickupOdo : tx.returnOdo;
          const odoBad = !!odoText.trim() && parseOdo(odoText) === null;
          return (
            <SectionCard key={stage} title={t(STAGE_KEYS[stage])} icon={stage === 'pickup' ? 'key-outline' : 'checkmark-done-outline'} tone={stage === 'pickup' ? 'teal' : 'ok'}>
              <Label>{t('driving.reading.fuel')}</Label>
              <View accessibilityRole="radiogroup" accessibilityLabel={`${t(STAGE_KEYS[stage])}, ${t('driving.reading.fuel')}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {FUEL_STEPS.map((n) => {
                  const level = n === 0 ? t('driving.reading.empty') : n === 8 ? t('driving.reading.full') : fuelFraction(n);
                  return (
                    <Chip
                      key={n}
                      label={fuelFraction(n)}
                      a11yLabel={t('driving.reading.fuelA11y', { level })}
                      hint={t('driving.reading.fuelHint')}
                      selected={reading.fuel === n}
                      onPress={() => update((c) => withReading(c, stage, { fuel: c[stage].fuel === n ? null : n }))}
                    />
                  );
                })}
              </View>
              <TextField
                label={t('driving.reading.odo', { unit: t(UNIT_KEYS[unit]) })}
                value={odoText}
                onChange={(v) => setText(stage === 'pickup' ? 'pickupOdo' : 'returnOdo', v)}
                placeholder={t('driving.reading.odoPlaceholder')}
                inputMode="numeric"
                error={odoBad ? t('driving.reading.odoError') : undefined}
              />
              {stage === 'pickup' ? (
                <>
                  <Label>{t('driving.reading.unit')}</Label>
                  <View accessibilityRole="radiogroup" accessibilityLabel={t('driving.reading.unit')} style={{ flexDirection: 'row', gap: space.s }}>
                    {ODO_UNITS.map((u) => (
                      <Chip key={u} label={t(UNIT_KEYS[u])} hint={t('driving.reading.unitHint')} selected={unit === u} onPress={() => update((c) => ({ ...c, odoUnit: u }))} />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  {cmp.driven ? (
                    <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
                      {t('driving.reading.driven', { value: cmp.driven.value, unit: t(UNIT_KEYS[unit]), other: cmp.driven.other, otherUnit: t(UNIT_KEYS[unit === 'km' ? 'mi' : 'km']) })}
                    </Text>
                  ) : null}
                  {cmp.odoBackwards ? <Warning text={t('driving.reading.backwards')} /> : null}
                  {cmp.fuelLower ? <Warning text={t('driving.reading.fuelLower')} /> : null}
                </>
              )}
            </SectionCard>
          );
        })}

        <SectionCard title={t('driving.return.title')} icon="alarm-outline" tone="accent">
          {plan ? (
            <>
              <Text style={[typeScale.title, { color: theme.ink }]}>
                {t('driving.return.by', { time: formatTime(plan.returnAt.local), day: formatDay(localDate(plan.returnAt.local), lang) })}
              </Text>
              <Label>{t('driving.return.travel')}</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <Button kind="quiet" icon="remove" label={t('driving.return.less')} hint={t('driving.return.lessHint')} onPress={() => update((c) => ({ ...c, travelMin: stepTravel(c.travelMin, -1) }))} />
                <Text accessibilityLiveRegion="polite" style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'], flex: 1, textAlign: 'center' }]}>
                  {stored.travelMin === null ? t('driving.return.travelUnset') : t('driving.return.travelValue', { n: stored.travelMin })}
                </Text>
                <Button kind="quiet" icon="add" label={t('driving.return.more')} hint={t('driving.return.moreHint')} onPress={() => update((c) => ({ ...c, travelMin: stepTravel(c.travelMin, 1) }))} />
              </View>
              {plan.leaveAt ? (
                <View accessible style={{ gap: 2 }}>
                  <Text style={[typeScale.bodyStrong, { color: theme.accentInk }]}>{t('driving.return.leaveBy', { time: formatTime(plan.leaveAt.local), back: formatTime(plan.returnAt.local) })}</Text>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{t('driving.return.leaveByFoot', { n: plan.bufferMin })}</Text>
                </View>
              ) : (
                <Body muted>{t('driving.return.leaveUnset')}</Body>
              )}
            </>
          ) : (
            <Body muted>{t('driving.return.none')}</Body>
          )}
        </SectionCard>

        <SectionCard title={t('driving.desk.title')} icon="call-outline" tone="sea">
          <TextField label={t('driving.desk.phone')} value={tx.deskPhone} onChange={(v) => setText('deskPhone', v)} inputMode="tel" />
          {phone ? <Button kind="secondary" icon="call" label={t('driving.desk.call', { number: phone })} hint={t('driving.desk.callHint')} onPress={() => callAndExplain(phone, t)} /> : null}
        </SectionCard>

        <SectionCard title={t('driving.cover.title')} icon="shield-outline" tone="warn">
          <TextField label={t('driving.cover.excess')} value={tx.excess} onChange={(v) => setText('excess', v)} multiline />
          <TextField label={t('driving.cover.insurance')} value={tx.insurance} onChange={(v) => setText('insurance', v)} multiline />
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('driving.cover.foot')}</Text>
        </SectionCard>
      </FadeInView>
    </Screen>
  );
}
