// New / edit trip form. Dates use the system date picker, falling back to typed YYYY-MM-DD without the module (T24).
// Leaving with unsaved changes asks first (FLOWS §2.2); errors sit beside their fields and are announced.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { deviceZone, todayIn } from '../src/core/format.ts';
import { draftChanged, newTripDraft, tripFromDraft, validateTrip, type TripDraft, type TripError } from '../src/core/trips.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { DateField } from '../src/ui/DateTimeField.tsx';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { ErrorNotice } from '../src/ui/ErrorNotice.tsx';
import { Body, Button, Screen, TextField } from '../src/ui/kit.tsx';
import { ZoneField } from '../src/ui/ZonePicker.tsx';

export default function TripEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useApp();
  const { trips, saveTrip, deleteTrip } = useTrips();
  const router = useRouter();
  const prev = id ? trips.find((x) => x.id === id) : undefined;
  const [initial] = useState<TripDraft>(() =>
    prev ? { name: prev.name, startDate: prev.startDate, endDate: prev.endDate, homeTz: prev.homeTz } : newTripDraft(todayIn(deviceZone()), deviceZone()),
  );
  const [d, setD] = useState<TripDraft>(initial);
  const [errors, setErrors] = useState<TripError[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const { leaving, gestureEnabled } = useDiscardConfirm(draftChanged(initial, d));
  const set = (k: keyof TripDraft) => (v: string) => setD((o) => ({ ...o, [k]: v }));
  const err = (e: TripError) => (errors.includes(e) ? t(`tripEdit.err.${e}`) : undefined);

  const save = async () => {
    const e = validateTrip(d);
    setErrors(e);
    if (e.length) {
      AccessibilityInfo.announceForAccessibility(t('spec.form.checkFields'));
      return;
    }
    // Leave only once it is stored; otherwise stay open with what was typed (STATES_COPY error.trips.save).
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    const trip = tripFromDraft(d, prev);
    const ok = await saveTrip(trip);
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      AccessibilityInfo.announceForAccessibility(t('error.trips.save.title'));
      return;
    }
    leaving();
    if (prev) router.back();
    else router.replace(`/trip/${trip.id}`);
  };

  const remove = () =>
    prev &&
    Alert.alert(t('tripEdit.deleteConfirm', { name: prev.name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!(await deleteTrip(prev.id))) {
            setSaveFailed(true);
            AccessibilityInfo.announceForAccessibility(t('error.trips.save.title'));
            return;
          }
          leaving();
          router.dismissAll();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: prev ? t('tripEdit.title') : t('tripEdit.newTitle'), gestureEnabled }} />
      <TextField label={t('tripEdit.name')} value={d.name} onChange={set('name')} placeholder={t('tripEdit.namePlaceholder')} error={err('name')} />
      <DateField label={t('pickers.trip.start')} typedLabel={t('tripEdit.start')} value={d.startDate} onChange={set('startDate')} hint={t('pickers.hint.tripStart')} fallbackDay={todayIn(deviceZone())} error={err('startDate')} />
      <DateField label={t('pickers.trip.end')} typedLabel={t('tripEdit.end')} value={d.endDate} onChange={set('endDate')} hint={t('pickers.hint.tripEnd')} fallbackDay={d.startDate} minimumDay={d.startDate} error={err('endDate') ?? err('endBeforeStart')} />
      <ZoneField label={t('tripEdit.homeTz')} value={d.homeTz} onChange={set('homeTz')} hint={t('pickers.hint.homeZone')} error={err('homeTz')} suggestions={[deviceZone()]} chipLabel={(city) => t('itemEdit.useZone', { city })} />
      <Body muted>{t('spec.tripEdit.tzHint')}</Body>
      {saveFailed ? (
        <ErrorNotice title={t('error.trips.save.title')} body={t('error.trips.save.body')} action={t('common.tryAgain')} actionHint={t('error.saveRetryHint')} onAction={save} />
      ) : null}
      <Button label={t('tripEdit.save')} hint={t('spec.tripEdit.saveHint')} onPress={save} />
      <Button label={t('common.cancel')} hint={t('spec.tripEdit.cancelHint')} kind="quiet" onPress={() => router.back()} />
      {prev ? <Button label={t('tripEdit.delete')} hint={t('spec.tripEdit.deleteHint')} kind="quiet" onPress={remove} /> : null}
    </Screen>
  );
}
