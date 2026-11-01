// T163 Screenshot demo travels: the Settings section that adds the two invented past trips (src/core/sampletravels.ts)
// and removes them again in one tap. Adding also turns on Your travels' "Include demo trips" switch, so the stats and
// passport stamps show them at once; T165: removing them turns it back off when the samples were what turned it on. A save that fails says so (error.trips.save) and nothing changes.
import { useRef, useState } from 'react';
import { AccessibilityInfo, Alert, View } from 'react-native';
import { deviceZone, todayIn } from '../core/format.ts';
import { hasSampleTravels, includeDemoAfterRemove, isSampleTravel, samplesTurnOnDemo, sampleTravels } from '../core/sampletravels.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { useTrips } from '../state/trips.tsx';
import { space } from '../theme/tokens.ts';
import { SectionHeader } from './hero.tsx';
import { Body, Button, Card } from './kit.tsx';
import { useTravelStats } from './useTravelStats.ts';

/** T165: set when adding the samples turned Your travels' "Include demo trips" on (this phone only). */
export const SAMPLES_TURNED_DEMO_ON_KEY = 'satchel.travels.samplesTurnedDemoOn.v1';

export function SampleTravelsSection() {
  const { t } = useApp();
  const { trips, saveTrip, deleteTrip } = useTrips();
  const { includeDemo, setIncludeDemo } = useTravelStats();
  // T165: remembers whether adding the samples turned "Include demo trips" on, so removing them turns it back off.
  const [turnedOn, setTurnedOn] = usePersisted<boolean>(SAMPLES_TURNED_DEMO_ON_KEY, false);
  const [status, setStatus] = useState<string | null>(null);
  const busy = useRef(false);
  const present = hasSampleTravels(trips);

  const run = async (work: () => Promise<boolean>, done: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (!(await work())) {
        Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
        return;
      }
      setStatus(done);
      AccessibilityInfo.announceForAccessibility(done);
    } finally {
      busy.current = false;
    }
  };

  const add = () =>
    run(async () => {
      for (const trip of sampleTravels(todayIn(deviceZone()))) if (!(await saveTrip(trip))) return false;
      if (samplesTurnOnDemo(includeDemo)) setTurnedOn(true);
      setIncludeDemo(true);
      return true;
    }, t('demo2.added'));

  const remove = () =>
    run(async () => {
      for (const trip of trips.filter(isSampleTravel)) if (!(await deleteTrip(trip.id))) return false;
      setIncludeDemo(includeDemoAfterRemove(includeDemo, turnedOn));
      setTurnedOn(false);
      return true;
    }, t('demo2.removed'));

  return (
    <View style={{ gap: space.s }}>
      <SectionHeader title={t('demo2.title')} icon="images-outline" tone="accent" />
      <Card>
        <Body muted>{t('demo2.body')}</Body>
        {present ? (
          <Button label={t('demo2.remove')} hint={t('demo2.removeHint')} kind="secondary" icon="trash-outline" onPress={remove} />
        ) : (
          <Button label={t('demo2.add')} hint={t('demo2.addHint')} kind="secondary" icon="add-circle-outline" onPress={add} />
        )}
        {status ? <Body muted>{status}</Body> : null}
      </Card>
    </View>
  );
}
