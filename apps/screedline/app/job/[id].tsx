import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { jobSheet } from '../../src/core/jobs';
import { useApp } from '../../src/state/AppState';
import { FONT, RADIUS, SPACE, TARGET } from '../../src/theme/theme';
import { Button, Card, DONE_ID, Icon, T } from '../../src/ui/kit';

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const { theme } = app;
  const job = app.jobs.find(j => j.id === String(id));
  const [notes, setNotes] = useState(job?.notes ?? '');
  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.ground, padding: SPACE.l, gap: SPACE.l }}>
        <Stack.Screen options={{ title: 'Job' }} />
        <T>This job was deleted.</T>
        <Button label="Back to jobs" onPress={() => router.back()} />
      </View>
    );
  }
  const date = (ms: number) => new Date(ms).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const rename = () => {
    if (Platform.OS !== 'ios') return;
    Alert.prompt('Rename job', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: (name?: string) => name && app.patchJob(job.id, { name }) }], 'plain-text', job.name);
  };
  const share = () => Share.share({ message: jobSheet(job, ms => new Date(ms).toLocaleDateString('en-AU')) }).catch(() => undefined);
  const del = () => Alert.alert(`Delete ${job.name}?`, 'Its saved calculations are deleted from this phone. This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete job', style: 'destructive', onPress: () => { router.back(); app.deleteJob(job.id); } },
  ]);
  const checks = Object.values(job.checks).filter(Boolean).length;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ padding: SPACE.l, gap: SPACE.l, paddingBottom: SPACE.xxl }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: job.name, headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Rename job" onPress={rename} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pencil-outline" size={24} color={theme.ink} />
        </Pressable>
      ) }} />
      <View style={{ gap: SPACE.s }}>
        <T kind="label">Notes</T>
        <TextInput
          accessibilityLabel="Job notes"
          value={notes}
          onChangeText={setNotes}
          onBlur={() => app.patchJob(job.id, { notes })}
          placeholder="Address, client, mix, pour date…"
          placeholderTextColor={theme.ink2}
          multiline
          inputAccessoryViewID={DONE_ID}
          maxFontSizeMultiplier={1.6}
          style={{ minHeight: 96, borderRadius: RADIUS.m, borderWidth: theme.borderWidth, borderColor: theme.fieldLine, backgroundColor: theme.card, padding: SPACE.l, fontFamily: FONT.body, fontSize: 18, color: theme.ink, textAlignVertical: 'top' }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: SPACE.m }}>
        <Button style={{ flex: 1 }} icon="export-variant" label="Share job sheet" onPress={share} />
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/checklist', params: { job: job.id } })} style={({ pressed }) => ({ minHeight: TARGET + 8, flexDirection: 'row', alignItems: 'center', gap: SPACE.m, backgroundColor: theme.card, borderRadius: RADIUS.m, padding: SPACE.l, borderWidth: 1, borderColor: theme.line, opacity: pressed ? 0.85 : 1 })}>
        <Icon name="clipboard-check-outline" size={26} color={theme.ink} />
        <View style={{ flex: 1 }}>
          <T kind="label">Pour & curing checklist</T>
          <T kind="small">{checks ? `${checks} ticked for this job` : 'Nothing ticked yet'}</T>
        </View>
        <Icon name="chevron-right" size={24} color={theme.ink2} />
      </Pressable>

      <T kind="caps" style={{ marginTop: SPACE.s }}>Saved calculations</T>
      {job.items.length ? job.items.map(item => {
        const tool = app.tools.find(t => t.id === item.toolId);
        return (
          <Card key={item.id} style={{ gap: SPACE.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.m }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.amber, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={tool?.icon ?? 'calculator'} size={24} color={theme.onAmber} />
              </View>
              <View style={{ flex: 1 }}>
                <T kind="label">{item.title}</T>
                <T kind="small">{date(item.savedAt)}</T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} onPress={() => Alert.alert('Delete this calculation?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => app.deleteItem(job.id, item.id) }])} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trash-can-outline" size={24} color={theme.danger} />
              </Pressable>
            </View>
            {item.lines.map((l, i) => <T key={i} kind={i === 0 ? 'label' : 'small'} color={i === 0 ? theme.ink : undefined}>{l}</T>)}
            {tool?.run ? <Button kind="secondary" icon="pencil-ruler" label="Open with these numbers" onPress={() => router.push({ pathname: '/tool/[id]', params: { id: item.toolId, prefill: JSON.stringify(item.values), job: job.id } })} /> : null}
          </Card>
        );
      }) : <T kind="small">Open any tool and tap Save to job to add it here.</T>}

      <Button kind="secondary" icon="calculator-variant-outline" label="Add a calculation" onPress={() => router.navigate('/')} />
      <Button kind="danger" icon="trash-can-outline" label="Delete job" onPress={del} />
    </ScrollView>
  );
}
