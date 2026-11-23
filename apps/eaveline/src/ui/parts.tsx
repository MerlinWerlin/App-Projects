/** App-specific pieces: roof diagram, current-roof card, save-to-job, trial gate, safety line. */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { RoofType } from '../core/geometry';
import { roofGeometry } from '../core/geometry';
import { useApp } from '../state/AppState';
import { roofReady, type ToolId } from '../state/model';
import { RADIUS, SPACE, TOUCH } from '../theme/theme';
import { Btn, Card, tap, Txt } from './kit';

/** Line drawing of the roof shape, in two-point view, labelled L / W / pitch. */
export function RoofDiagram({ type, size = 1, label = true }: { type: RoofType; size?: number; label?: boolean }) {
  const { theme } = useApp();
  const w = 300 * size, h = 150 * size;
  const ink = theme.ink, fill = theme.accent, side = theme.sheet2;
  // Base box corners (eave level) in a simple oblique projection.
  const A = [40, 120], B = [200, 120], C = [260, 90], D = [100, 90];
  const P = (pts: number[][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]! * size},${p[1]! * size}`).join(' ') + ' Z';
  let shapes: { d: string; f: string }[] = [];
  void D;
  if (type === 'gable') {
    // Ridge runs front-to-back above the middle of the gable end (oblique offset: half the depth).
    const R1 = [70, 45], R2 = [230, 45];
    shapes = [
      { d: P([A, B, R2, R1]), f: fill }, // front plane
      { d: P([B, C, R2]), f: side }, // gable end
    ];
  } else if (type === 'hip') {
    // Ridge shorter than the eave by the run at each end.
    const R1 = [110, 45], R2 = [170, 45];
    shapes = [
      { d: P([A, B, R2, R1]), f: fill },
      { d: P([B, C, R2]), f: side },
    ];
  } else {
    const T1 = [40, 70], T2 = [200, 70], T3 = [260, 40];
    shapes = [
      { d: P([A, B, T2, T1]), f: side },
      { d: P([T1, T2, T3, [100, 40]]), f: fill },
      { d: P([B, C, T3, T2]), f: theme.sheet },
    ];
  }
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} accessibilityLabel={`${type} roof diagram`}>
      {shapes.map((s, i) => <Path key={i} d={s.d} fill={s.f} stroke={ink} strokeWidth={2.5 * size} strokeLinejoin="round" />)}
      {label ? (
        <>
          <Line x1={40 * size} y1={136 * size} x2={200 * size} y2={136 * size} stroke={ink} strokeWidth={1.5 * size} />
          <SvgText x={120 * size} y={150 * size} fontSize={14 * size} fontWeight="700" fontFamily="AtkinsonHyperlegible_700Bold" fill={ink} textAnchor="middle">L</SvgText>
          <SvgText x={246 * size} y={124 * size} fontSize={14 * size} fontWeight="700" fontFamily="AtkinsonHyperlegible_700Bold" fill={ink} textAnchor="middle">W</SvgText>
        </>
      ) : null}
    </Svg>
  );
}

/** The roof every calculator works from. Tap to change it. */
export function RoofCard({ need = true }: { need?: boolean }) {
  const { roof, ctx, theme, prefs } = useApp();
  const router = useRouter();
  const ready = roofReady(roof);
  const g = ready ? roofGeometry(roof, ctx) : null;
  return (
    <Pressable testID="roof-card" accessibilityRole="button" accessibilityLabel={ready ? `Roof: ${roof.type}, ${ctx.dim(roof.lengthMm)} by ${ctx.dim(roof.widthMm)}, pitch ${ctx.pitch(roof.pitchDeg)}. Change` : 'Set up the roof'}
      onPress={() => { tap(prefs.haptics); router.push('/roof'); }}
      style={({ pressed }) => [st.roofCard, { backgroundColor: theme.sheet, borderColor: ready ? theme.line : theme.ink, borderWidth: ready ? StyleSheet.hairlineWidth : 2, opacity: pressed ? 0.85 : 1 }]}>
      <RoofDiagram type={roof.type} size={0.36} label={false} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="label" tone="ink3">{ready ? 'This roof' : need ? 'Start here' : 'Roof'}</Txt>
        {ready && g?.ok ? (
          <>
            <Txt v="headline">{cap(roof.type)} · {ctx.dim(roof.lengthMm)} × {ctx.dim(roof.widthMm)}</Txt>
            <Txt v="subhead" tone="ink2">{ctx.pitch(roof.pitchDeg)} · {ctx.area(g.value.roofAreaM2)}</Txt>
          </>
        ) : <Txt v="headline">Enter the roof size and pitch</Txt>}
      </View>
      <Ionicons name="create-outline" size={24} color={theme.ink} />
    </Pressable>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Save the result to the active job (or a new one). */
export function SaveToJob({ tool, title, lines, disabled }: { tool: ToolId; title: string; lines: string[]; disabled?: boolean }) {
  const app = useApp();
  const router = useRouter();
  const [saved, setSaved] = useState<string | null>(null);
  const active = app.jobs.find(j => j.id === app.activeJobId);
  const save = () => {
    if (!app.unlocked) {
      Alert.alert('Saved jobs are part of the Full Unlock', 'Start the free 7-day trial or unlock Eaveline to keep results with a job.', [
        { text: 'Not now', style: 'cancel' }, { text: 'See options', onPress: () => router.push('/unlock') },
      ]);
      return;
    }
    const job = app.saveToJob({ tool, title, lines });
    tap(app.prefs.haptics, 'success');
    setSaved(job.name);
  };
  return (
    <View style={{ gap: SPACE.xs }}>
      <Btn label={saved ? `Saved to ${saved}` : active ? `Save to ${active.name}` : 'Save to a new job'} icon={saved ? 'checkmark' : 'bookmark-outline'} kind="ink" onPress={save} disabled={disabled} />
      {saved ? <Btn label="Open the job" kind="plain" onPress={() => router.push(`/job/${app.activeJobId}`)} /> : null}
    </View>
  );
}

/** Shown instead of a paid calculator's result before the trial or unlock. */
export function Gate({ tool, children }: { tool: ToolId; children: React.ReactNode }) {
  const app = useApp();
  const router = useRouter();
  if (app.can(tool)) return <>{children}</>;
  return (
    <Card style={{ gap: SPACE.sm, paddingVertical: SPACE.lg, borderColor: app.theme.ink, borderWidth: 2 }}>
      <Ionicons name="lock-closed" size={28} color={app.theme.ink} />
      <Txt v="title2">{app.trial.started ? 'Your free trial has ended' : 'Try every calculator free for 7 days'}</Txt>
      <Txt v="body" tone="ink2">
        {app.trial.started
          ? 'Unlock Eaveline once to keep using this calculator and saved jobs. The pitch tools and gutter fall stay free.'
          : 'This calculator is part of the Full Unlock. Start the free trial: nothing is charged, and the pitch tools and gutter fall are always free.'}
      </Txt>
      <Btn label={app.trial.started ? 'See unlock options' : 'Start free trial'} onPress={() => router.push('/unlock')} />
    </Card>
  );
}

export function SafetyLine() {
  const { country, theme } = useApp();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/safety')}
      style={({ pressed }) => [st.safety, { borderColor: theme.ink, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[st.stripes, { backgroundColor: theme.accent }]}><Ionicons name="warning" size={22} color={theme.onAccent} /></View>
      <View style={{ flex: 1, paddingVertical: SPACE.xs }}>
        <Txt v="headline">Working at heights</Txt>
        <Txt v="footnote" tone="ink2" numberOfLines={2}>{country.safety.text}</Txt>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.ink3} style={{ marginRight: SPACE.sm }} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  roofCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.m, padding: SPACE.sm, minHeight: TOUCH.huge },
  safety: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.m, borderWidth: 2, overflow: 'hidden', minHeight: TOUCH.huge },
  stripes: { alignSelf: 'stretch', width: 48, alignItems: 'center', justifyContent: 'center' },
});
