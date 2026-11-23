/** Cable runs & drums: total cable to order and a cut plan that keeps offcuts small. */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { planCuts } from '../src/core/cutlist.ts';
import { newId } from '../src/core/jobs.ts';
import { fmt, parseNum } from '../src/core/num.ts';
import { longUnit } from '../src/core/units.ts';
import { useApp } from '../src/state/AppState.tsx';
import { RADIUS, SPACE, TYPE } from '../src/theme/theme.ts';
import { Btn, Card, FieldRow, Locked, NumField, Result, Screen, SectionLabel, Txt } from '../src/ui/kit.tsx';
import { useSave } from '../src/ui/useSave.ts';
import { CAPTURE, DEMO } from '../src/capture.ts';

interface RunIn { id: string; label: string; length: string; qty: string }
interface DrumIn { id: string; label: string; length: string }

export default function Runs() {
  const app = useApp();
  const { theme, prefs } = app;
  const save = useSave();
  const lu = longUnit(prefs.units);
  const [runs, setRuns] = useState<RunIn[]>(CAPTURE ? DEMO.runs : [{ id: 'r1', label: 'Run 1', length: '', qty: '1' }]);
  const [drums, setDrums] = useState<DrumIn[]>(CAPTURE ? DEMO.drums : [{ id: 'd1', label: 'Drum 1', length: prefs.units === 'metric' ? '100' : '328' }]);
  const [allow, setAllow] = useState(prefs.units === 'metric' ? '0.5' : '1.5');
  const [waste, setWaste] = useState('5');

  const r = useMemo(() => planCuts({
    runs: runs.map(x => ({ id: x.id, label: x.label.trim() || 'Run', length: parseNum(x.length), qty: x.qty.trim() ? parseNum(x.qty) : 1 })),
    drums: drums.map(x => ({ id: x.id, label: x.label.trim() || 'Drum', length: parseNum(x.length) })),
    allowance: parseNum(allow) ?? 0,
    wastePct: parseNum(waste) ?? 0,
  }), [runs, drums, allow, waste]);

  if (!app.can('runs')) return <Screen pushed title="Cable runs"><Locked what="Cable runs & drums" /></Screen>;
  const L = (n: number) => `${fmt(n, 1)} ${lu}`;
  return (
    <Screen pushed title="Cable runs" sub="Total cable and the cut plan">
      <SectionLabel>Runs</SectionLabel>
      {runs.map((x, i) => (
        <Card key={x.id} style={{ gap: SPACE.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
            <TextInput value={x.label} onChangeText={v => setRuns(rs => rs.map(y => (y.id === x.id ? { ...y, label: v } : y)))} accessibilityLabel={`Run ${i + 1} name`}
              style={[TYPE.headline, { color: theme.ink, flex: 1, minHeight: 44, borderBottomColor: theme.line, borderBottomWidth: 1 }]} maxLength={40} placeholder="Name (e.g. Kitchen GPOs)" placeholderTextColor={theme.ink2} />
            {runs.length > 1 ? <Del label={`Remove ${x.label || 'run'}`} color={theme.fail} onPress={() => setRuns(rs => rs.filter(y => y.id !== x.id))} /> : null}
          </View>
          <FieldRow>
            <NumField label="Length" value={x.length} onChange={v => setRuns(rs => rs.map(y => (y.id === x.id ? { ...y, length: v } : y)))} unit={lu} />
            <NumField label="How many" value={x.qty} onChange={v => setRuns(rs => rs.map(y => (y.id === x.id ? { ...y, qty: v } : y)))} integer />
          </FieldRow>
        </Card>
      ))}
      <Btn title="Add a run" icon="add" kind="secondary" onPress={() => setRuns(rs => [...rs, { id: newId(), label: `Run ${rs.length + 1}`, length: '', qty: '1' }])} />
      <FieldRow>
        <NumField label="Tails per run" value={allow} onChange={setAllow} unit={lu} hint="Added to every run for terminations." />
        <NumField label="Waste" value={waste} onChange={setWaste} unit="%" />
      </FieldRow>
      <SectionLabel>Drums on hand</SectionLabel>
      {drums.map((d, i) => (
        <View key={d.id} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.xs }}>
          <NumField label={d.label || `Drum ${i + 1}`} value={d.length} onChange={v => setDrums(ds => ds.map(y => (y.id === d.id ? { ...y, length: v } : y)))} unit={lu} />
          <Del label={`Remove ${d.label}`} color={theme.fail} onPress={() => setDrums(ds => ds.filter(y => y.id !== d.id))} />
        </View>
      ))}
      <Btn title="Add a drum" icon="add" kind="secondary" onPress={() => setDrums(ds => [...ds, { id: newId(), label: `Drum ${ds.length + 1}`, length: prefs.units === 'metric' ? '100' : '328' }])} />
      <Result
        error={r.ok ? null : r.error}
        answers={r.ok ? [
          { label: 'Cable to order', value: L(r.value.toOrder) },
          { label: 'Total of cuts', value: L(r.value.totalCut) },
          { label: 'Left on drums', value: L(r.value.leftover) },
        ] : []}
        steps={r.ok ? r.steps : []}
        warnings={r.ok ? r.warnings : []}
        onSave={r.ok ? () => save({ kind: 'runs', title: 'Cable runs', lines: [`Order ${L(r.value.toOrder)} (cuts ${L(r.value.totalCut)})`, ...r.value.plans.map(p => `${p.label}: ${p.cuts.map(c => `${c.label} ${fmt(c.length, 1)}`).join(', ') || 'unused'}; offcut ${L(p.offcut)}`), ...r.value.unplaced.map(c => `Won't fit: ${c.label} ${fmt(c.length, 1)} ${lu}`)], steps: r.steps }) : undefined}
      >
        {r.ok && r.value.plans.length ? (
          <View style={{ gap: SPACE.sm }}>
            {r.value.plans.map(p => (
              <View key={p.drumId} style={{ gap: 6 }}>
                <Txt v="headline">{p.label} · {L(p.length)}</Txt>
                <View style={{ flexDirection: 'row', height: 30, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: theme.card2, borderWidth: theme.rule, borderColor: theme.line }}
                  accessible accessibilityLabel={`${p.label}: ${p.cuts.length} cuts, offcut ${L(p.offcut)}`}>
                  {p.cuts.map((c, i) => <View key={i} style={{ flex: c.length, backgroundColor: i % 2 ? theme.accent : theme.ink, borderRightWidth: 2, borderRightColor: theme.card }} />)}
                  {p.offcut > 0 ? <View style={{ flex: p.offcut }} /> : null}
                </View>
                <Txt v="footnote" tone="ink2">{p.cuts.length ? p.cuts.map(c => `${c.label} ${fmt(c.length, 1)}`).join(' · ') : 'Not needed'}{p.offcut > 0 ? `  ·  offcut ${L(p.offcut)}` : ''}</Txt>
              </View>
            ))}
          </View>
        ) : null}
      </Result>
    </Screen>
  );
}

function Del({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={{ width: 48, height: 64, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="trash-outline" size={22} color={color} />
    </Pressable>
  );
}
