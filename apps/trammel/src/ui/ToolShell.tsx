// The frame every calculator sits in: the lock for paid tools, input state (restored from a saved job or the last
// values used), and the Save to job sheet.
import { Icon } from './Icon.tsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { CAPTURE } from '../native/store.ts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localTool, toolById, type ToolId } from '../core/tools.ts';
import { COUNTRIES, type CountryCode } from '../core/country.ts';
import { inputsInUnits, UNITS_KEY } from '../core/inputs.ts';
import { lengthToInput, type UnitSystem } from '../core/units.ts';
import { useAccess } from '../state/access.ts';
import { useJobs } from '../state/jobs.tsx';
import { useSettings } from '../state/settings.tsx';
import { fonts, radius, space, TOUCH, useTheme, sys } from '../theme/theme.ts';
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

/** len(mm) writes a length in the units in use; len(mm, inches) uses a round imperial value instead of converting. */
export type DefaultsFn = (d: { len: (mm: number, inches?: number) => string; units: UnitSystem }) => Record<string, string>;

/** Input strings for a tool: a saved calculation (?calc=id) first, then the last values used, then the defaults. */
export function useToolInputs(tool: ToolId, defaults: DefaultsFn) {
  const { calc } = useLocalSearchParams<{ calc?: string }>();
  const { findCalc } = useJobs();
  const { settings } = useSettings();
  const d = { len: (mm: number, inches?: number) => lengthToInput(settings.units === 'imperial' && inches != null ? inches * 25.4 : mm, settings.units, settings.denom), units: settings.units };
  // Which fields hold lengths: the ones the defaults fill through d.len (row lists hold lengths in "l").
  const lengthKeys = useRef<string[] | null>(null);
  if (!lengthKeys.current) {
    const MARK = '@@trammel-length@@';
    const probe = defaults({ len: () => MARK, units: settings.units });
    lengthKeys.current = Object.keys(probe).filter((k) => probe[k] === MARK || probe[k].includes(MARK));
  }
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const saved = calc ? findCalc(calc) : undefined;
    const stored = saved && saved.tool === tool ? saved.inputs : last[tool];
    const base = { ...defaults(d), [UNITS_KEY]: settings.units, __country: settings.country ?? 'OTHER' };
    return stored ? { ...base, ...inputsInUnits(stored, lengthKeys.current!, settings.units, settings.denom) } : base;
  });
  // Switching units while a tool is open converts every typed length (2700 mm becomes 106 5/16", not 2700").
  useEffect(() => {
    setVals((v) => (v[UNITS_KEY] === settings.units ? v : inputsInUnits(v, lengthKeys.current!, settings.units, settings.denom)));
  }, [settings.units, settings.denom]);
  // A job saved in another country is re-checked against the current one; say so.
  const savedCountry = calc ? findCalc(calc)?.inputs.__country : undefined;
  const countryNote = savedCountry && savedCountry !== (settings.country ?? 'OTHER') && savedCountry in COUNTRIES ? `Saved for ${COUNTRIES[savedCountry as CountryCode].name}: now checked for ${COUNTRIES[settings.country ?? 'OTHER'].name}.` : null;
  const set = (key: string) => (s: string) =>
    setVals((v) => {
      const next = { ...v, [key]: s };
      remember(tool, next);
      return next;
    });
  const reset = () => {
    const v = { ...defaults(d), [UNITS_KEY]: settings.units };
    remember(tool, v);
    setVals(v);
  };
  const setAll = (fn: (v: Record<string, string>) => Record<string, string>) =>
    setVals((v) => {
      const next = fn(v);
      remember(tool, next);
      return next;
    });
  return { vals, set, reset, setAll, countryNote };
}

export function useLocked(tool: ToolId): boolean {
  const a = useAccess();
  // Store-capture builds only: trammel:///stairs?locked=1 shows a paid tool as a locked customer sees it.
  const { locked } = useLocalSearchParams<{ locked?: string }>();
  const info = toolById(tool);
  if (!info || info.free) return false;
  if (CAPTURE && locked === '1') return true;
  return !a.canEdit;
}

export function ToolShell({ tool, children, save }: { tool: ToolId; children: ReactNode; save?: { title: string; summary: string; inputs: Record<string, string> } | null }) {
  const info = toolById(tool)!;
  const { country } = useSettings();
  const local = localTool(info, country.terms);
  const locked = useLocked(tool);
  const [sheet, setSheet] = useState(false);
  const a = useAccess();
  return (
    <>
      <Stack.Screen options={{ title: local.name }} />
      {locked ? (
        <Screen>
          <LockedPreview>{children}</LockedPreview>
          <View style={{ marginTop: -120 }}>
            <LockedCard name={local.name} blurb={local.blurb} expired={a.state === 'expired'} />
          </View>
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

/**
 * The real tool, worked out with its example numbers, shown faded and untouchable above the unlock card, so a locked
 * tool shows exactly what the unlock gives (the result, the drawing, the checks) instead of a bare padlock.
 */
function LockedPreview({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 640, overflow: 'hidden' }}>
      <View style={{ gap: space.l, opacity: 0.7 }}>{children}</View>
      {/* Blurred so the layout of the answer shows (the yellow result, the drawing, the checks) but not the numbers. */}
      <BlurView intensity={t.dark ? 40 : 34} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      {[0.35, 0.6, 0.85, 1].map((o, i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: (3 - i) * 40, height: 40, backgroundColor: t.bg, opacity: o }} />
      ))}
    </View>
  );
}

function LockedCard({ name, blurb, expired }: { name: string; blurb: string; expired: boolean }) {
  const t = useTheme();
  return (
    <Card style={{ gap: space.l, paddingVertical: space.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.blade, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={30} color={t.bladeInk} />
      </View>
      <H>{name}</H>
      <P>{blurb}.</P>
      <P muted>{expired ? 'Your free week has finished. Unlock every tool with one purchase, no subscription. Your saved jobs stay open.' : 'Part of Trammel Full Unlock. Try every tool free for 7 days first: nothing is charged and nothing renews.'}</P>
      <Button label={expired ? 'See Full Unlock' : 'Try it free for 7 days'} kind="blade" icon="arrow" onPress={() => router.push('/paywall')} />
      <P muted small>Free for good: Fractions ↔ mm, Square check, Mitre and Roof pitch.</P>
    </Card>
  );
}

function SaveBar({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: Math.max(insets.bottom, space.m), backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
      <Button label="Save to a job" icon="bookmark" kind="primary" onPress={onPress} />
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
            <Text style={{ ...sys.bodyBold, fontSize: 17, color: t.ink }}>Cancel</Text>
          </Pressable>
          <Text accessibilityRole="header" style={{ ...sys.bodyBold, fontSize: 17, color: t.ink }}>
            Save to a job
          </Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.l, paddingTop: 0, gap: space.m, paddingBottom: insets.bottom + space.xl }}>
          <Card>
            <Text style={{ ...sys.bodyBold, fontSize: 15, color: t.muted }}>{payload.title}</Text>
            <P>{payload.summary}</P>
          </Card>
          <Text style={{ ...sys.bodyBold, fontSize: 15, color: t.muted }}>New job</Text>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Smith St deck"
              placeholderTextColor={t.muted}
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && done(create(name).id)}
              accessibilityLabel="New job name"
              style={{ flex: 1, minHeight: TOUCH, borderRadius: radius.m, borderWidth: 2, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: space.m, ...sys.bodyMedium, fontSize: 18, color: t.ink }}
            />
            <Button label="Add" kind="blade" disabled={!name.trim()} onPress={() => done(create(name).id)} />
          </View>
          {jobs.length ? <Text style={{ ...sys.bodyBold, fontSize: 15, color: t.muted, marginTop: space.s }}>Or add to</Text> : null}
          {jobs.map((j) => (
            <Pressable key={j.id} onPress={() => done(j.id)} accessibilityRole="button" accessibilityLabel={`Add to ${j.name}`} style={({ pressed }) => ({ minHeight: TOUCH, borderRadius: radius.m, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, paddingHorizontal: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: pressed ? 0.7 : 1 })}>
              <Icon name="jobs" size={22} color={t.ink} />
              <Text style={{ flex: 1, ...sys.bodyBold, fontSize: 18, color: t.ink }} numberOfLines={1}>
                {j.name}
              </Text>
              <Text style={{ ...sys.body, fontSize: 15, color: t.muted }}>{j.calcs.length}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
