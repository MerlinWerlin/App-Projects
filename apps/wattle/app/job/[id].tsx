import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, TextInput, View } from 'react-native';
import { deleteJob, jobToText, removeCalc, renameJob, setNotes } from '../../src/core/jobs.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE, TYPE } from '../../src/theme/theme.ts';
import { Btn, Card, DISCLAIMER, Screen, SectionLabel, Txt } from '../../src/ui/kit.tsx';

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const job = app.jobs.jobs.find(j => j.id === id);
  const [name, setName] = useState(job?.name ?? '');
  const [notes, setN] = useState(job?.notes ?? '');
  if (!job) {
    return (
      <Screen pushed title="Job not found">
        <Txt v="callout" tone="ink2">This job was deleted.</Txt>
        <Btn title="All jobs" onPress={() => router.replace('/jobs')} />
      </Screen>
    );
  }
  const field = { color: theme.ink, borderRadius: RADIUS.md, borderWidth: theme.rule, borderColor: theme.line, backgroundColor: theme.field, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm };
  return (
    <Screen pushed title={job.name} sub={`${job.items.length} saved calculation${job.items.length === 1 ? '' : 's'}`}>
      <Stack.Screen options={{ title: '' }} />
      <SectionLabel>Name</SectionLabel>
      <TextInput value={name} onChangeText={setName} onEndEditing={() => app.updateJobs(d => renameJob(d, job.id, name))} maxLength={60} accessibilityLabel="Job name" style={[TYPE.headline, field, { minHeight: 56 }]} />
      <SectionLabel>Notes</SectionLabel>
      <TextInput value={notes} onChangeText={setN} onEndEditing={() => app.updateJobs(d => setNotes(d, job.id, notes))} multiline maxLength={4000} placeholder="Cable types, circuit numbers, access…" placeholderTextColor={theme.ink2}
        accessibilityLabel="Job notes" style={[TYPE.body, field, { minHeight: 100, textAlignVertical: 'top' }]} />
      <SectionLabel>Calculations</SectionLabel>
      {job.items.length ? job.items.map(i => (
        <Card key={i.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt v="headline" style={{ flex: 1 }}>{i.title}</Txt>
            <Txt v="footnote" tone="ink2">{new Date(i.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${i.title}`} hitSlop={10} style={{ paddingLeft: SPACE.sm, minHeight: 44, justifyContent: 'center' }}
              onPress={() => Alert.alert('Delete this calculation?', i.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => app.updateJobs(d => removeCalc(d, job.id, i.id)) }])}>
              <Ionicons name="trash-outline" size={20} color={theme.fail} />
            </Pressable>
          </View>
          {i.lines.map((l, k) => <Txt key={k} v="subhead" selectable style={{ fontVariant: ['tabular-nums'] }}>{l}</Txt>)}
        </Card>
      )) : <Txt v="callout" tone="ink2">Nothing saved yet. Tap Save under any result.</Txt>}
      <Btn title="Share job" icon="share-outline" onPress={() => { void Share.share({ message: jobToText({ ...job, name, notes }, DISCLAIMER) }); }} />
      <Btn title="Delete job" kind="danger" icon="trash-outline" onPress={() => Alert.alert(`Delete “${job.name}”?`, 'Its saved calculations are deleted from this iPhone. This can’t be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete job', style: 'destructive', onPress: () => { app.updateJobs(d => deleteJob(d, job.id)); router.back(); } },
      ])} />
    </Screen>
  );
}
