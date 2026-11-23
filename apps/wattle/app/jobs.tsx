import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { createJob } from '../src/core/jobs.ts';
import { useApp } from '../src/state/AppState.tsx';
import { RADIUS, SPACE, TYPE } from '../src/theme/theme.ts';
import { Btn, Card, Locked, Row, Screen, Txt } from '../src/ui/kit.tsx';

export default function Jobs() {
  const app = useApp();
  const { theme, jobs } = app;
  const router = useRouter();
  const [name, setName] = useState('');
  if (!app.can('jobs')) return <Screen pushed title="Jobs"><Locked what="Saving jobs" /></Screen>;
  const add = () => {
    let id = '';
    app.updateJobs(d => { const r = createJob(d, name); id = r.job.id; return r.doc; });
    setName('');
    router.push(`/job/${id}`);
  };
  return (
    <Screen pushed title="Jobs" sub="Saved on this iPhone only">
      <Card style={{ gap: SPACE.sm }}>
        <Txt v="label" tone="ink2">New job</Txt>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. 14 Banksia St, switchboard" placeholderTextColor={theme.ink2} maxLength={60} returnKeyType="done" onSubmitEditing={add}
          accessibilityLabel="New job name" style={[TYPE.body, { color: theme.ink, minHeight: 56, borderRadius: RADIUS.md, borderWidth: theme.rule, borderColor: theme.line, backgroundColor: theme.field, paddingHorizontal: SPACE.md }]} />
        <Btn title="Create job" icon="add" onPress={add} />
      </Card>
      {jobs.jobs.length ? (
        <Card pad={false} style={{ paddingHorizontal: SPACE.md }}>
          {jobs.jobs.map((j, i) => (
            <Row key={j.id} icon="folder-outline" title={j.name} sub={`${j.items.length} calculation${j.items.length === 1 ? '' : 's'} · ${new Date(j.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`} onPress={() => router.push(`/job/${j.id}`)} last={i === jobs.jobs.length - 1} />
          ))}
        </Card>
      ) : (
        <View style={{ alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xl }}>
          <Ionicons name="folder-open-outline" size={56} color={theme.ink2} />
          <Txt v="title">No jobs yet</Txt>
          <Txt v="callout" tone="ink2" style={{ textAlign: 'center', maxWidth: 300 }}>Create a job, or tap Save on any result to keep the numbers with the job they belong to.</Txt>
        </View>
      )}
    </Screen>
  );
}
