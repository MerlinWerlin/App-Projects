import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { cutLength, takeoff, type CutEnd, type EndRef } from '../../src/calc/cut';
import { formatLength, lengthToInput } from '../../src/calc/units';
import { useApp } from '../../src/state/AppState';
import { Card, CheckNote, Field, FieldLabel, Note, ResultPanel, Segmented, Working, readField, useKeypad, useTap, type NumField } from '../../src/ui/kit';
import { ToolFrame, useOpenedRecord } from '../../src/ui/ToolFrame';
import { CutDiagram } from '../../src/ui/diagrams';
import { FittingSheet, useResolveFitting, type ChosenFitting } from '../../src/ui/FittingSheet';
import { HIT, radius, space, usePalette } from '../../src/ui/theme';

const REFS: { value: EndRef; label: string }[] = [
  { value: 'centre', label: 'Centre of fitting' },
  { value: 'face', label: 'Face of fitting' },
  { value: 'none', label: 'Pipe end / wall' },
];

function EndPicker({ tag, refValue, setRef, fitting, onChoose }: { tag: 'A' | 'B'; refValue: EndRef; setRef: (r: EndRef) => void; fitting: ChosenFitting | null; onChoose: () => void }) {
  const c = usePalette();
  const { prefs } = useApp();
  const tap = useTap();
  return (
    <Card>
      <FieldLabel>{`End ${tag}: measured to the`}</FieldLabel>
      <Segmented value={refValue} onChange={setRef} options={REFS} />
      {refValue !== 'none' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={fitting ? `Fitting ${tag}: ${fitting.name}. Change` : `Choose fitting ${tag}`} onPress={() => { tap(); onChoose(); }}
          style={({ pressed }) => ({ minHeight: HIT + 8, borderRadius: radius.m, borderWidth: 2, borderColor: fitting ? c.line : c.copper, borderStyle: fitting ? 'solid' : 'dashed', backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name={fitting ? 'git-commit-outline' : 'add-circle-outline'} size={26} color={c.copper} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink }}>{fitting ? fitting.name : `Choose fitting ${tag}`}</Text>
            {fitting ? <Text style={{ fontSize: 14, color: c.ink3 }}>{refValue === 'centre' ? `Take-off ${formatLength(takeoff(fitting), prefs.unit)}` : `Socket depth ${formatLength(fitting.engagement, prefs.unit)}`}</Text> : <Text style={{ fontSize: 14, color: c.ink3 }}>From the table, or your own</Text>}
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.ink3} />
        </Pressable>
      ) : null}
      {fitting && !fitting.verified && refValue !== 'none' ? <Note tone="warn">{fitting.note ?? 'Check this fitting against the manufacturer’s data.'}</Note> : null}
    </Card>
  );
}

export default function CutScreen() {
  const { prefs } = useApp();
  const u = prefs.unit;
  const rec = useOpenedRecord('cut');
  const ri = rec?.inputs ?? {};
  const resolve = useResolveFitting();
  const asRef = (x: unknown): EndRef => (x === 'face' || x === 'none' ? x : 'centre');
  const [measured, setMeasured] = useState(typeof ri.measured === 'number' ? lengthToInput(ri.measured, u) : '');
  const [qty, setQty] = useState(typeof ri.qty === 'number' ? String(ri.qty) : '1');
  const [refA, setRefA] = useState<EndRef>(asRef(ri.refA));
  const [refB, setRefB] = useState<EndRef>(asRef(ri.refB));
  const [fitA, setFitA] = useState<string | null>(typeof ri.fitA === 'string' ? ri.fitA : null);
  const [fitB, setFitB] = useState<string | null>(typeof ri.fitB === 'string' ? ri.fitB : null);
  const [choosing, setChoosing] = useState<'A' | 'B' | null>(null);

  const fields: NumField[] = [
    { label: 'Measurement', text: measured, setText: setMeasured, hint: 'From end A to end B' },
    { label: 'How many the same', text: qty, setText: setQty, kind: 'integer', suffix: 'pcs' },
  ];
  const kp = useKeypad(fields);
  const parsed = fields.map(f => readField(f, u));
  const errs = parsed.map(p => (p && typeof p === 'object' ? p.error : null));
  const num = (i: number) => { const p = parsed[i]; return typeof p === 'number' ? p : undefined; };
  const saved = (d: unknown, key: string | null): ChosenFitting | null => {
    const o = d as { name?: unknown; centreToEnd?: unknown; engagement?: unknown } | undefined;
    return key && o && typeof o.centreToEnd === 'number' && typeof o.engagement === 'number' ? { key, name: String(o.name ?? 'Saved fitting'), centreToEnd: o.centreToEnd, engagement: o.engagement, verified: true, note: 'As saved with this job' } : null;
  };
  const A = resolve(fitA) ?? saved(ri.dimsA, fitA);
  const B = resolve(fitB) ?? saved(ri.dimsB, fitB);
  const end = (ref: EndRef, f: ChosenFitting | null): CutEnd => ({ ref, fitting: f ?? undefined, name: f?.name });

  const result = useMemo(() => {
    const m = num(0);
    if (m === undefined || errs.some(Boolean)) return null;
    return cutLength({ measured: m, a: end(refA, A), b: end(refB, B), qty: num(1) ?? 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, qty, refA, refB, A?.key, B?.key, A?.centreToEnd, B?.centreToEnd, A?.engagement, B?.engagement, u]);
  const ok = result && result.ok ? result.value : null;
  const q = num(1) ?? 1;
  const snapshot = ok ? {
    inputs: { measured: num(0)!, qty: q, refA, refB, ...(fitA ? { fitA } : {}), ...(fitB ? { fitB } : {}), ...(A ? { dimsA: { name: A.name, centreToEnd: A.centreToEnd, engagement: A.engagement } } : {}), ...(B ? { dimsB: { name: B.name, centreToEnd: B.centreToEnd, engagement: B.engagement } } : {}) },
    summary: `Measured ${formatLength(num(0)!, u)}: cut ${formatLength(ok.cut, u)}${q > 1 ? ` × ${q}` : ''}`,
  } : null;

  return (
    <ToolFrame tool="cut" snapshot={snapshot}>
      <Stack.Screen options={{ title: 'Cut length' }} />
      <ResultPanel
        main={ok ? { label: 'Cut the pipe to', value: formatLength(ok.cut, u) } : null}
        rest={ok ? [
          { label: 'End A', value: ok.adjustA === 0 ? '± 0' : `${ok.adjustA < 0 ? '−' : '+'} ${formatLength(Math.abs(ok.adjustA), u)}` },
          { label: 'End B', value: ok.adjustB === 0 ? '± 0' : `${ok.adjustB < 0 ? '−' : '+'} ${formatLength(Math.abs(ok.adjustB), u)}` },
          ...(q > 1 ? [{ label: `Total for ${q}`, value: formatLength(ok.total, u, { metres: true }) }] : []),
        ] : undefined}
        empty={result && !result.ok ? result.error : 'Enter the measurement'}
      />
      <Card>
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 2 }}><Field field={fields[0]!} onOpen={() => kp.openAt(0)} error={errs[0]} /></View>
          <View style={{ flex: 1 }}><Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1]} /></View>
        </View>
      </Card>
      <CutDiagram />
      <EndPicker tag="A" refValue={refA} setRef={setRefA} fitting={A} onChoose={() => setChoosing('A')} />
      <EndPicker tag="B" refValue={refB} setRef={setRefB} fitting={B} onChoose={() => setChoosing('B')} />
      <Note>Measuring to a fitting’s centre? Spigot takes off the fitting allowance. Measuring to its face? Spigot adds the socket depth, because the pipe goes inside.</Note>
      {result && result.ok ? <Working title={snapshot?.summary ?? 'Cut length'} steps={result.steps} /> : null}
      <CheckNote />
      <FittingSheet visible={choosing !== null} onClose={() => setChoosing(null)} onPick={key => (choosing === 'A' ? setFitA(key) : setFitB(key))} />
      {kp.element}
    </ToolFrame>
  );
}

