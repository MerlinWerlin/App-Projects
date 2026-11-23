/**
 * Frame for every calculator: native header with Save, inputs, then the answer (or the unlock card for a locked
 * tool, which still shows the inputs so the tiler sees exactly what they'd get). Inputs restore from a saved job.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, InputAccessoryView, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Step } from '../core/steps.ts';
import type { ToolId } from '../plus/entitlement.ts';
import { useApp } from '../state/AppState.tsx';
import { jobText, newJobId, type Job, type JobInputs } from '../state/jobs.ts';
import { FONT, RADIUS, SPACE, useTheme } from '../theme/theme.ts';
import { Icon } from './Icon.tsx';
import { Btn, Card, haptic, KB_ACCESSORY, PressScale, Txt } from './kit.tsx';

export const TOOL_NAMES: Record<ToolId, string> = {
  tiles: 'Tiles & boxes', setout: 'Set-out', materials: 'Grout, adhesive & membrane', falls: 'Falls to waste', trim: 'Trim & edging', stairs: 'Stairs & steps',
};

/** Tool state as strings/bools, restored from ?job=<id> when opened from Jobs. */
type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : T[K] extends string ? string : T[K] extends number ? number : T[K] };

export function useToolInputs<D extends JobInputs>(defaults: D): [Widen<D>, (patch: Partial<Widen<D>>) => void, Job | null] {
  type T = Widen<D>;
  const { job: jobId } = useLocalSearchParams<{ job?: string }>();
  const { jobs } = useApp();
  const job = jobId ? jobs.find(j => j.id === jobId) ?? null : null;
  const [state, setState] = useState<T>(() => ({ ...defaults, ...(job?.inputs as Partial<T> | undefined) }) as T);
  const loaded = useRef(job?.id ?? null);
  useEffect(() => {
    if (job && loaded.current !== job.id) { loaded.current = job.id; setState({ ...defaults, ...(job.inputs as Partial<T>) } as T); }
    // defaults are a fresh object each render; only a different job should reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);
  return [state, (patch: Partial<T>) => setState(s => ({ ...s, ...patch })), job];
}

export function ToolScreen({ tool, title, inputs, job, summary, steps, children, result, intro }: {
  tool: ToolId; title?: string; inputs: JobInputs; job: Job | null; summary: string[] | null; steps: Step[]; children: ReactNode; result: ReactNode; intro?: string;
}) {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [savedId, setSavedId] = useState<string | null>(job?.id ?? null);
  const locked = !app.canUse(tool);
  const name = title ?? TOOL_NAMES[tool];

  const save = () => {
    if (!summary) { Alert.alert('Nothing to save yet', 'Fill in the sizes first.'); return; }
    if (!app.canUse(tool)) { router.push('/unlock'); return; }
    const existing = savedId ? app.jobs.find(j => j.id === savedId) : null;
    const write = (jobName: string) => {
      const now = Date.now();
      const j: Job = { id: existing?.id ?? newJobId(), name: jobName.trim() || name, tool, inputs, summary, country: app.country.code, createdAt: existing?.createdAt ?? now, updatedAt: now };
      app.saveJob(j);
      setSavedId(j.id);
      haptic(app.prefs.haptics, 'success');
    };
    if (Platform.OS === 'ios') {
      Alert.prompt(existing ? 'Update job' : 'Save job', 'Name it so you can find it again, e.g. "Smith ensuite floor".', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: v => write(v ?? '') },
      ], 'plain-text', existing?.name ?? '');
    } else write(existing?.name ?? name);
  };

  const share = () => {
    if (!summary) return;
    const j: Job = { id: savedId ?? 'x', name: app.jobs.find(x => x.id === savedId)?.name ?? name, tool, inputs, summary, country: app.country.code, createdAt: 0, updatedAt: 0 };
    void Share.share({ message: jobText(j, name, steps) }).catch(() => undefined);
  };

  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [resultY, setResultY] = useState(0);
  const [kb, setKb] = useState(false);
  const [resultInView, setResultInView] = useState(false);
  const viewH = useRef(0);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', () => setKb(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const reduced = useReducedMotion();
  const answer = summary && !locked ? summary.slice(0, 2).join(' · ') : null;
  const toResult = () => { Keyboard.dismiss(); scroll.current?.scrollTo({ y: Math.max(0, resultY - SPACE.md), animated: !reduced }); };
  const barH = 64;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        title: name,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {summary && !locked ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Share the answer and working" onPress={share} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="share" size={20} color={t.ink} />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={savedId ? 'Update saved job' : 'Save job'} onPress={save} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={savedId ? 'saved' : 'save'} size={20} color={t.ink} />
            </Pressable>
          </View>
        ),
      }} />
      <ScrollView ref={scroll} scrollEventThrottle={64}
        onLayout={e => { viewH.current = e.nativeEvent.layout.height; }}
        onScroll={e => { const v = resultY > 0 && resultY < e.nativeEvent.contentOffset.y + viewH.current - 140; if (v !== resultInView) setResultInView(v); }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: SPACE.gutter, paddingBottom: insets.bottom + SPACE.xxl + (answer ? barH : 0) }}>
        {intro ? <Txt v="subhead" tone="ink2" style={{ marginBottom: SPACE.xs }}>{intro}</Txt> : null}
        {!app.country.guided ? (
          <Card tone="sunk" style={{ marginBottom: SPACE.sm }}>
            <Txt v="footnote" tone="ink2">{`Generic guidance: we don't have checked local products and rules for your country yet, so sizes and coverage rates are generic. Check the data sheet and your local rules.`}</Txt>
          </Card>
        ) : null}
        {children}
        <View style={{ marginTop: SPACE.lg }} onLayout={e => setResultY(e.nativeEvent.layout.y)}>
          {locked ? <LockCard tool={tool} /> : summary ? <Animated.View entering={reduced ? undefined : FadeInDown.duration(220).easing(Easing.bezier(0.23, 1, 0.32, 1))}>{result}</Animated.View> : result}
        </View>
      </ScrollView>
      {answer && !kb && !resultInView ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: SPACE.gutter, right: SPACE.gutter, bottom: insets.bottom + SPACE.sm }}>
          <PressScale accessibilityRole="button" accessibilityLabel={`Answer: ${answer}. Show the result`} onPress={toResult}
            style={[ts.bar, { backgroundColor: t.ink, minHeight: barH }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flex: 1, color: t.ground, fontFamily: FONT.numBold, fontSize: 26 }} maxFontSizeMultiplier={1.3}>{answer}</Text>
            <Icon name="chevronDown" size={16} color={t.accent} />
          </PressScale>
        </View>
      ) : null}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KB_ACCESSORY}>
          <View style={[ts.accessory, { backgroundColor: t.sheet, borderTopColor: t.line }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flex: 1, color: t.ink, fontFamily: FONT.numBold, fontSize: 22 }} maxFontSizeMultiplier={1.3}>
              {answer ?? 'Fill in the sizes'}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Done, hide the keyboard" onPress={() => Keyboard.dismiss()} style={[ts.done, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.onAccent, fontSize: 17, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const ts = StyleSheet.create({
  bar: { borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  accessory: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.md, paddingRight: SPACE.xs, paddingVertical: SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth },
  done: { minHeight: 48, minWidth: 88, borderRadius: RADIUS.field, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.md },
});

export function LockCard({ tool }: { tool: ToolId }) {
  const app = useApp();
  const router = useRouter();
  const expired = app.trial.started && !app.trial.active;
  const t = useTheme();
  return (
    <Card tone="ink" style={{ gap: SPACE.sm }}>
      <Txt v="title2" style={{ color: t.ground }} accessibilityRole="header">{`${TOOL_NAMES[tool]} is in Full Unlock`}</Txt>
      <Txt v="callout" style={{ color: t.ground, opacity: 0.8 }}>
        {expired ? 'Your free week has ended. One payment unlocks every tool for good: no subscription.' : 'Try every tool free for 7 days, then one payment unlocks them for good. No subscription, nothing charged automatically.'}
      </Txt>
      <Btn label={expired ? 'See Full Unlock' : 'Start free 7-day trial'} onPress={() => router.push('/unlock')} icon="unlock" />
    </Card>
  );
}
