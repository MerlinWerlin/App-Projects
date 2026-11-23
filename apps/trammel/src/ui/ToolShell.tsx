// The frame every calculator sits in: the lock for paid tools, input state (restored from a saved job or the last
// values used), and the Save to job sheet.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toolById, type ToolId } from '../core/tools.ts';
import { lengthToInput, type UnitSystem } from '../core/units.ts';
import { useAccess } from '../state/access.ts';
import { useJobs } from '../state/jobs.tsx';
import { useSettings } from '../state/settings.tsx';
import { fonts, radius, space, TOUCH, useTheme } from '../theme/theme.ts';
import { Button, Card, H, P, Screen } from './kit.tsx';

const LAST_KEY = 'trammel.last.v1';
let last: Record<string, Record<string, string>> = {};
let lastLoaded = false;
export async function loadLastInputs() {
  if (lastLoaded) return;
  lastLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(LAST_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') last = v;
  } catch {
    last = {};
  }
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function remember(tool: string, v: Record<string, string>) {
  last = { ...last, [tool]: v };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => AsyncStorage.setItem(LAST_KEY, JSON.stringify(last)).catch(() => {}), 400);
}

export type DefaultsFn = (d: { len: (mm: number) => string; units: UnitSystem }) => Record<string, string>;

/** Input strings for a tool: a saved calculation (?calc=id) first, then the last values used, then the defaults. */
export function useToolInputs(tool: ToolId, defaults: DefaultsFn) {
  const { calc } = useLocalSearchParams<{ calc?: string }>();
  const { findCalc } = useJobs();
  const { settings } = useSettings();
  const d = { len: (mm: number) => lengthToInput(mm, settings.units, settings.denom), units: settings.units };
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const saved = calc ? findCalc(calc) : undefined;
    if (saved && saved.tool === tool) return { ...defaults(d), ...saved.inputs };
    return { ...defaults(d), ...(last[tool] ?? {}) };
  });
  // Switching units in Settings: fields still holding a default are re-written in the new units.
  const unitsRef = useRef(settings.units);
  useEffect(() => {
    if (unitsRef.current === settings.units) return;
    const before = defaults({ len: (mm) => lengthToInput(mm, unitsRef.current, settings.denom), units: unitsRef.current });
    const after = defaults(d);
    unitsRef.current = settings.units;
    setVals((v) => {
      const next = { ...v };
      for (const k of Object.keys(after)) if (v[k] === before[k]) next[k] = after[k];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.units]);
  const set = (key: string) => (s: string) =>
    setVals((v) => {
      const next = { ...v, [key]: s };
      remember(tool, next);
      return next;
    });
  const reset = () => {
    const v = defaults(d);
    remember(tool, v);
    setVals(v);
  };
  return { vals, set, reset, setAll: setVals };
}

export function useLocked(tool: ToolId): boolean {
  const a = useAccess();
  const info = toolById(tool);
  if (!info || info.free) return false;
  return !a.canEdit;
}

export function ToolShell({ tool, children, save }: { tool: ToolId; children: ReactNode; save?: { title: string; summary: string; inputs: Record<string, string> } | null }) {
  const info = toolById(tool)!;
  const locked = useLocked(tool);
  const [sheet, setSheet] = useState(false);
  const a = useAccess();
  return (
    <>
      <Stack.Screen options={{ title: info.name }} />
      {locked ? (
        <Screen>
          <LockedCard name={info.name} blurb={info.blurb} expired={a.state === 'expired'} />
        </Screen>
      ) : (
        <Screen
          bottom={
            save ? (
              <SaveBar
                onPress={() => {
                  if (!a.canEdit) router.push('/paywall');
                  else setSheet(true);
                }}
              />
            ) : null
          }
        >
          {children}
        </Screen>
      )}
      {save ? <SaveSheet visible={sheet} onClose={() => setSheet(false)} tool={tool} payload={save} /> : null}
    </>
  );
}

function LockedCard({ name, blurb, expired }: { name: string; blurb: string; expired: boolean }) {
  const t = useTheme();
  return (
    <Card style={{ gap: space.l, paddingVertical: space.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.blade, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="lock-closed" size={30} color={t.bladeInk} />
      </View>
      <H>{name}</H>
      <P>{blurb}.</P>
      <P muted>{expired ? 'Your free week has finished. Unlock every tool with one purchase, no subscription. Your saved jobs stay open.' : 'Part of Trammel Full Unlock. Try every tool free for 7 days first: nothing is charged and nothing renews.'}</P>
      <Button label={expired ? 'See Full Unlock' : 'Try it free for 7 days'} kind="blade" icon="arrow-forward" onPress={() => router.push('/paywall')} />
      <P muted small>Free for good: Fractions ↔ mm, Square check, Mitre and Roof pitch.</P>
    </Card>
  );
}

function SaveBar({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: Math.max(insets.bottom, space.m), backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
      <Button label="Save to a job" icon="bookmark-outline" kind="primary" onPress={onPress} />
    </View>
  );
}

function SaveSheet({ visible, onClose, tool, payload }: { visible: boolean; onClose: () => void; tool: ToolId; payload: { title: string; summary: string; inputs: Record<string, string> } }) {
  const t = useTheme();
  const { jobs, create, save } = useJobs();
  const { settings } = useSettings();
  const [name, setName] = useState('');
  const insets = useSafeAreaInsets();
  const done = (jobId: string) => {
    save(jobId, { tool, ...payload });
    if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setName('');
    onClose();
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.l }}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: t.ink }}>Cancel</Text>
          </Pressable>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: t.ink }}>
            Save to a job
          </Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.l, paddingTop: 0, gap: space.m, paddingBottom: insets.bottom + space.xl }}>
          <Card>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted }}>{payload.title}</Text>
            <P>{payload.summary}</P>
          </Card>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted }}>New job</Text>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Smith St deck"
              placeholderTextColor={t.muted}
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && done(create(name).id)}
              accessibilityLabel="New job name"
              style={{ flex: 1, minHeight: TOUCH, borderRadius: radius.m, borderWidth: 2, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: space.m, fontFamily: fonts.bodyMedium, fontSize: 18, color: t.ink }}
            />
            <Button label="Add" kind="blade" disabled={!name.trim()} onPress={() => done(create(name).id)} />
          </View>
          {jobs.length ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted, marginTop: space.s }}>Or add to</Text> : null}
          {jobs.map((j) => (
            <Pressable key={j.id} onPress={() => done(j.id)} accessibilityRole="button" accessibilityLabel={`Add to ${j.name}`} style={({ pressed }) => ({ minHeight: TOUCH, borderRadius: radius.m, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, paddingHorizontal: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="folder-open-outline" size={22} color={t.ink} />
              <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 18, color: t.ink }} numberOfLines={1}>
                {j.name}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.muted }}>{j.calcs.length}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
