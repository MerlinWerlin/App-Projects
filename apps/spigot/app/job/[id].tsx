import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../src/state/AppState';
import { Body, Button, Card, H, Screen, TextBox } from '../../src/ui/kit';
import { font, radius, space, usePalette } from '../../src/ui/theme';
import { toolHref, toolInfo } from '../../src/ui/tools';
import { SwipeRow } from '../../src/ui/SwipeRow';

export default function JobScreen() {
  const c = usePalette();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = app.jobs.find(j => j.id === id);
  const [name, setName] = useState(job?.name ?? '');
  const [notes, setNotes] = useState(job?.notes ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (job && !editing) { setName(job.name); setNotes(job.notes); } }, [job, editing]);
  if (!job) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Job' }} />
        <Body>This job was deleted.</Body>
        <Button label="Back to jobs" onPress={() => router.back()} />
      </Screen>
    );
  }
  const recs = app.records.filter(r => r.jobId === job.id);
  const share = () => {
    const text = [`${job.name}`, job.notes ? job.notes : null, '', ...recs.map(r => `• ${toolInfo(r.tool).title}: ${r.summary}${r.note ? ` (${r.note})` : ''}`), '', 'Worked out with Spigot. Check against the manufacturer’s data and local code.'].filter(x => x !== null).join('\n');
    void Share.share({ message: text }).catch(() => undefined);
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: job.name, headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Share job" hitSlop={12} onPress={share} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="share-outline" size={24} color={c.copper} />
        </Pressable>
      ) }} />
      {editing ? (
        <Card>
          <TextBox label="Job name" value={name} onChangeText={setName} />
          <TextBox label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Address, access, materials…" />
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Button kind="quiet" label="Cancel" style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button label="Save" style={{ flex: 1 }} onPress={() => { app.renameJob(job.id, name, notes); setEditing(false); }} />
          </View>
        </Card>
      ) : (
        <Card>
          {job.notes ? <Body>{job.notes}</Body> : <Body muted>No notes yet.</Body>}
          <Button kind="quiet" icon="create-outline" label="Edit name and notes" onPress={() => setEditing(true)} />
        </Card>
      )}
      <H>{recs.length ? `Saved (${recs.length})` : 'Saved'}</H>
      {recs.length ? recs.map(r => (
        <SwipeRow key={r.id} label="Remove" onDelete={() => Alert.alert('Remove from job?', r.summary, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => app.deleteRecord(r.id) }])}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${toolInfo(r.tool).title}: ${r.summary}${r.note ? `. ${r.note}` : ''}`} accessibilityHint="Opens this calculation. Swipe left to remove" onPress={() => router.push({ pathname: toolHref(r.tool), params: { record: r.id } })}
          onLongPress={() => Alert.alert('Remove from job?', r.summary, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => app.deleteRecord(r.id) }])}
          style={({ pressed }) => ({ flexDirection: 'row', gap: space.m, alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.m, padding: space.l, opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name={toolInfo(r.tool).icon} size={26} color={c.copper} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink3, textTransform: 'uppercase' }}>{toolInfo(r.tool).title}</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: c.ink }}>{r.summary}</Text>
            {r.note ? <Text style={{ fontSize: 15, color: c.ink2 }}>{r.note}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.ink3} />
        </Pressable>
        </SwipeRow>
      )) : <Body muted>Nothing saved yet. Open a tool, work something out, then tap Save to job.</Body>}
      <Body muted style={{ fontSize: 14 }}>Swipe left on a saved result to remove it.</Body>
      <Button kind="danger" icon="trash-outline" label="Delete job" onPress={() => Alert.alert('Delete this job?', `“${job.name}” and its ${recs.length} saved results will be deleted from this phone. This can’t be undone.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete job', style: 'destructive', onPress: () => { app.deleteJob(job.id); router.back(); } }])} />
    </Screen>
  );
}
