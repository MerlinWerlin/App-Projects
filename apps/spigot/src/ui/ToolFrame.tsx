import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../state/AppState';
import { sortJobs, type CalcRecord, type ToolId } from '../state/data';
import { Button, FieldLabel, Screen, TextBox, useTap } from './kit';
import { HIT, font, radius, space, usePalette } from './theme';
import { isLocked } from './tools';

export interface Snapshot { inputs: Record<string, unknown>; summary: string }

/** The record a tool was opened from (?record=<id>), for restoring its inputs. */
export function useOpenedRecord(): CalcRecord | undefined {
  const { record } = useLocalSearchParams<{ record?: string }>();
  const { records } = useApp();
  const ref = useRef<CalcRecord | undefined>(undefined);
  if (ref.current === undefined && record) ref.current = records.find(r => r.id === record);
  return ref.current;
}

/**
 * Wraps a calculator: shows the Save to job bar, keeps the latest valid result as a recent calculation when the
 * person leaves, and sends locked tools to the unlock screen.
 */
export function ToolFrame({ tool, snapshot, children }: { tool: ToolId; snapshot: Snapshot | null; children: React.ReactNode }) {
  const app = useApp();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const latest = useRef<Snapshot | null>(null);
  latest.current = snapshot;
  const recordRecent = useRef(app.recordRecent);
  recordRecent.current = app.recordRecent;
  const locked = isLocked(tool, app.unlocked);

  useEffect(() => { setSaved(null); }, [snapshot?.summary]);
  useEffect(() => () => { if (latest.current) recordRecent.current(tool, latest.current.inputs, latest.current.summary); }, [tool]);
  useEffect(() => { if (app.loaded && locked) router.replace({ pathname: '/unlock', params: { from: tool } }); }, [app.loaded, locked, tool]);

  return (
    <>
      <Screen footer={
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Button style={{ flex: 1 }} icon={saved ? 'checkmark-circle' : 'folder-open-outline'} label={saved ? `Saved to ${saved}` : 'Save to job'} disabled={!snapshot} onPress={() => setSaving(true)}
            accessibilityHint={snapshot ? 'Saves this result to a job on this phone' : 'Enter the measurements first'} />
        </View>
      }>
        {children}
      </Screen>
      <SaveSheet visible={saving} onClose={() => setSaving(false)} onSave={(jobId, note, jobName) => {
        if (!snapshot) return;
        app.saveToJob(jobId, tool, snapshot.inputs, snapshot.summary, note);
        setSaved(jobName);
        setSaving(false);
      }} />
    </>
  );
}

function SaveSheet({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (jobId: string, note: string | undefined, jobName: string) => void }) {
  const c = usePalette();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const tap = useTap();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const jobs = sortJobs(app.jobs);
  useEffect(() => { if (visible) { setName(''); setNote(''); } }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.l }}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 17, color: c.copper, fontWeight: '600' }}>Cancel</Text></Pressable>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '700', color: c.ink }}>Save to job</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + 40, gap: space.l }} keyboardShouldPersistTaps="handled">
          <TextBox label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Ensuite waste, under the vanity" />
          <View style={{ gap: space.s }}>
            <TextBox label="New job" value={name} onChangeText={setName} placeholder="e.g. 14 Smith St reno" />
            <Button label="Create job and save" icon="add" disabled={!name.trim()} onPress={() => { const j = app.createJob(name); tap('success'); onSave(j.id, note.trim() || undefined, j.name); }} />
          </View>
          {jobs.length ? (
            <View style={{ gap: space.s }}>
              <FieldLabel>Or add to a job</FieldLabel>
              {jobs.map(j => (
                <Pressable key={j.id} accessibilityRole="button" accessibilityLabel={`Save to ${j.name}`} onPress={() => { tap('success'); onSave(j.id, note.trim() || undefined, j.name); }}
                  style={({ pressed }) => ({ minHeight: HIT + 8, borderRadius: radius.m, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, gap: space.m, opacity: pressed ? 0.8 : 1 })}>
                  <Ionicons name="folder-outline" size={24} color={c.copper} />
                  <Text style={{ flex: 1, fontFamily: font.display, fontSize: 22, color: c.ink }} numberOfLines={1}>{j.name}</Text>
                  <Text style={{ color: c.ink3, fontSize: 15 }}>{app.records.filter(r => r.jobId === j.id).length} saved</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
