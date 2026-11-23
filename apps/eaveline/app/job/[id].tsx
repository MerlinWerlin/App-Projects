/** One job: name, notes, saved results, share as text, delete. */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useApp } from '../../src/state/AppState';
import { jobText } from '../../src/state/model';
import { RADIUS, SPACE } from '../../src/theme/theme';
import { Btn, Card, Field, Screen, Section, Txt } from '../../src/ui/kit';

export default function JobScreen() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = app.jobs.find(j => j.id === id);
  const [name, setName] = useState(job?.name ?? '');
  const [notes, setNotes] = useState(job?.notes ?? '');
  useEffect(() => {
    if (!job) return;
    const t = setTimeout(() => { if (name !== job.name || notes !== job.notes) app.editJob(job.id, { name, notes }); }, 400);
    return () => clearTimeout(t);
  }, [name, notes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!job) {
    return (
      <Screen>
        <Txt v="title2">This job isn’t on this phone any more.</Txt>
        <Btn label="Back to jobs" onPress={() => router.back()} />
      </Screen>
    );
  }
  const active = app.activeJobId === job.id;
  return (
    <Screen>
      <Stack.Screen options={{ title: job.name }} />
      <Field testID="job-edit-name" label="Job name" value={name} onChangeText={setName} keyboard="default" />
      <Field label="Notes" value={notes} onChangeText={setNotes} keyboard="default" multiline placeholder="Access, colours, measurements…" />
      {active
        ? <Txt v="label" tone="ink">Saving results to this job</Txt>
        : <Btn label="Save new results to this job" kind="outline" icon="bookmark-outline" onPress={() => app.setActiveJob(job.id)} />}
      {job.roof ? <Btn label="Load this job’s roof" kind="plain" icon="home-outline" onPress={() => { app.setRoof(job.roof!); router.push('/roof'); }} /> : null}
      <Section title={`Results (${job.entries.length})`}>
        {job.entries.length === 0 ? <Txt v="body" tone="ink3">Nothing saved yet. Open a calculator and tap Save.</Txt> : null}
        {job.entries.map(e => (
          <Card key={e.id} style={{ gap: SPACE.xxs }}>
            <View style={st.entryHead}>
              <Txt v="headline" style={{ flex: 1 }}>{e.title}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${e.title}`} hitSlop={10}
                onPress={() => Alert.alert('Remove this result?', e.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => app.deleteEntry(job.id, e.id) }])}
                style={st.icon}>
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </Pressable>
            </View>
            {e.lines.map((l, i) => <Txt key={i} v="callout" tone="ink2">{l}</Txt>)}
            <Txt v="footnote" tone="ink3">{new Date(e.at).toLocaleString()}</Txt>
          </Card>
        ))}
      </Section>
      <Btn label="Share job sheet" icon="share-outline" onPress={() => void Share.share({ message: jobText({ ...job, name, notes }), title: job.name }).catch(() => undefined)} />
      <Btn label="Delete job" kind="plain" icon="trash-outline" onPress={() => Alert.alert('Delete this job?', 'Its saved results are removed from this phone. This can’t be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete job', style: 'destructive', onPress: () => { app.deleteJob(job.id); router.back(); } },
      ])} />
    </Screen>
  );
}

const st = StyleSheet.create({
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.s },
});
