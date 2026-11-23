import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../state/AppState';
import { sortJobs, type CalcRecord, type ToolId } from '../state/data';
import { Button, FieldLabel, Screen, TextBox, useTap } from './kit';
import { HIT, font, radius, space, usePalette } from './theme';
import { isLocked, sampleInputs, toolTitle } from './tools';
import { useCountry } from '../country/useCountry';

export interface Snapshot { inputs: Record<string, unknown>; summary: string }

/**
 * The record a tool was opened from (?record=<id>), for restoring its inputs. A locked tool opens with a sample
 * instead, so the person sees a real result (blurred) before they unlock.
 */
export function useOpenedRecord(tool: ToolId): CalcRecord | undefined {
  const { record } = useLocalSearchParams<{ record?: string }>();
  const { records, unlocked } = useApp();
  const country = useCountry();
  const ref = useRef<CalcRecord | undefined>(undefined);
  if (ref.current === undefined) {
    if (isLocked(tool, unlocked)) ref.current = { id: 'sample', tool, createdAt: 0, summary: '', jobId: null, inputs: sampleInputs(tool, country) };
    else if (record) ref.current = records.find(r => r.id === record);
  }
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
  const appRef = useRef(app);
  appRef.current = app;

  useEffect(() => { setSaved(null); }, [snapshot?.summary]);
  useEffect(() => () => { if (latest.current && !isLocked(tool, appRef.current.unlocked)) recordRecent.current(tool, latest.current.inputs, latest.current.summary); }, [tool]);
  if (locked) return <LockedPreview tool={tool}>{children}</LockedPreview>;

  return (
    <>
      <Screen footer={
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Button style={{ flex: 1 }} icon={saved ? 'checkmark-circle' : 'folder-open-outline'} label={saved ? 'Saved to job' : 'Save to job'} disabled={!snapshot} onPress={() => setSaving(true)}
            accessibilityHint={saved ? `Saved to ${saved}. Tap to save again` : snapshot ? 'Saves this result to a job on this phone' : 'Enter the measurements first'} />
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

/**
 * A locked tool shows its real result for a sample job, softly blurred and not touchable, with the unlock card on top.
 * Nothing is saved or recorded from a preview.
 */
function LockedPreview({ tool, children }: { tool: ToolId; children: React.ReactNode }) {
  const c = usePalette();
  const app = useApp();
  const country = useCountry();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const title = toolTitle(tool, country);
  const trialText = app.trial.started ? 'See Full Unlock' : 'Try it free for 7 days';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Screen>{children}</Screen>
      </View>
      <BlurView intensity={10} tint={scheme === 'dark' ? 'dark' : 'light'} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ position: 'absolute', left: space.l, right: space.l, bottom: Math.max(insets.bottom, space.l), backgroundColor: c.panel, borderRadius: radius.l, padding: space.l, gap: space.m, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Ionicons name="lock-closed" size={20} color={c.vis} />
          <Text accessibilityRole="header" style={{ flex: 1, fontFamily: font.displayHeavy, fontSize: 26, color: c.onPanel }}>{`${title.toUpperCase()} IS IN FULL UNLOCK`}</Text>
        </View>
        <Text style={{ fontSize: 16, lineHeight: 22, color: c.onPanel2 }}>That’s a real result for a sample job. Unlock to use it on yours, with the working shown and Save to job.</Text>
        <Button label={trialText} icon="lock-open-outline" onPress={() => router.push({ pathname: '/unlock', params: { from: tool } })} />
      </View>
    </View>
  );
}
