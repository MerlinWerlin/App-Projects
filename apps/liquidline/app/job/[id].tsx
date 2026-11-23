import { Icon as Ionicons } from '../../src/ui/Icon.tsx';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Share, Text, TextInput, View } from 'react-native';
import { jobText, removeReading, type Job } from '../../src/core/jobs.ts';
import { deleteJob, saveJob, useJob } from '../../src/state/store.ts';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../src/theme/tokens.ts';
import { Button, Card, Label, Screen, Small } from '../../src/ui/kit.tsx';
import { dateText } from '../(tabs)/jobs.tsx';

function Field({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (s: string) => void; multiline?: boolean; placeholder?: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 4 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={p.text3}
        style={{ minHeight: multiline ? 110 : TOUCH, backgroundColor: p.surface2, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, fontSize: 17, color: p.text, textAlignVertical: multiline ? 'top' : 'center' }}
      />
    </View>
  );
}

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const p = usePalette();
  if (!job) {
    return (
      <Screen tab={false}>
        <Card><Small>This job was deleted.</Small></Card>
      </Screen>
    );
  }
  const set = (patch: Partial<Job>) => saveJob({ ...job, ...patch, updatedAt: Date.now() });
  const share = () => void Share.share({ message: jobText(job, dateText) }).catch(() => {});
  const del = () =>
    Alert.alert('Delete this job?', 'Its readings and notes are removed from this iPhone. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete job', style: 'destructive', onPress: () => { deleteJob(job.id); router.back(); } },
    ]);
  return (
    <Screen tab={false}>
      <Stack.Screen
        options={{
          title: job.title.trim() || 'Job',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Share job sheet" onPress={share} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="share-outline" size={26} color={p.text} />
            </Pressable>
          ),
        }}
      />
      <Card>
        <Field label="Job title" value={job.title} onChange={(title) => set({ title })} placeholder="e.g. Smith – lounge split" />
        <Field label="Site" value={job.site} onChange={(site) => set({ site })} placeholder="Address or site name" />
        <Field label="Equipment" value={job.equipment} onChange={(equipment) => set({ equipment })} placeholder="Make, model, serial" />
        <Field label="Refrigerant" value={job.refrigerant} onChange={(refrigerant) => set({ refrigerant: refrigerant.slice(0, 20) })} />
        <Field label="Notes" value={job.notes} onChange={(notes) => set({ notes })} multiline placeholder="Faults found, work done, refrigerant recovered or added" />
      </Card>
      <Label>{`Readings (${job.readings.length})`}</Label>
      {job.readings.length === 0 ? <Card><Small>Tap “Save to a job” on any calculator to add a reading here.</Small></Card> : null}
      {job.readings.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: p.text }}>{r.title}</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: r.kind === 'superheat' ? p.low : r.kind === 'subcooling' ? p.high : p.text }}>{r.result}</Text>
              <Small>{dateText(r.at)}</Small>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove reading ${r.title}`}
              hitSlop={8}
              onPress={() => Alert.alert('Remove this reading?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => saveJob(removeReading(job, r.id)) }])}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="trash-outline" size={22} color={p.high} />
            </Pressable>
          </View>
          {r.steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md, flexWrap: 'wrap' }}>
              <Small>{s.label}</Small>
              <Text style={{ fontSize: 14, fontWeight: '700', color: p.text }}>{s.value}</Text>
            </View>
          ))}
        </Card>
      ))}
      <Button kind="secondary" icon="share-outline" title="Share job sheet" onPress={share} />
      <Button kind="plain" tone="high" icon="trash-outline" title="Delete job" onPress={del} />
    </Screen>
  );
}
