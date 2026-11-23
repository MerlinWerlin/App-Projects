// "Save to a job" sheet: pick a job (most recent first) or start a new one. Saving needs the trial or unlock.
import { router } from 'expo-router';
import { useState } from 'react';
import { addReading, jobTitle, newJob } from '../src/core/jobs.ts';
import { getJobs, saveJob, useJobs, useSettings } from '../src/state/store.ts';
import { Body, Button, Card, Label, Row, Screen, Small } from '../src/ui/kit.tsx';
import { Gate } from '../src/ui/Gate.tsx';
import { clearStash, takeStash } from '../src/ui/saveStash.ts';
import { dateText } from './(tabs)/jobs.tsx';

export default function SaveSheet() {
  const jobs = useJobs();
  const s = useSettings();
  const [reading] = useState(() => takeStash());
  if (!reading) {
    return (
      <Screen tab={false}>
        <Card><Small>Nothing to save. Go back and tap “Save to a job” on a result.</Small></Card>
      </Screen>
    );
  }
  const saveTo = (id: string | null) => {
    const base = id ? getJobs().find((j) => j.id === id) : newJob(s.refrigerant);
    if (!base) return;
    const j = addReading(base, reading);
    saveJob(j);
    clearStash();
    router.replace({ pathname: '/job/[id]', params: { id: j.id } });
  };
  return (
    <Screen tab={false}>
      <Card>
        <Label>Saving</Label>
        <Body>{`${reading.title}: ${reading.result}`}</Body>
      </Card>
      <Gate what="saving readings to jobs">
        <Button testID="save-new-job" title="Save to a new job" icon="add" onPress={() => saveTo(null)} />
        {jobs.length ? (
          <Card>
            <Label>Or add to</Label>
            {jobs.slice(0, 30).map((j, i, all) => (
              <Row key={j.id} title={jobTitle(j)} detail={`${j.refrigerant} · ${dateText(j.updatedAt)}`} onPress={() => saveTo(j.id)} last={i === all.length - 1} />
            ))}
          </Card>
        ) : null}
      </Gate>
    </Screen>
  );
}
