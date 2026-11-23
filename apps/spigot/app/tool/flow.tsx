import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { flow, volume } from '../../src/calc/flow';
import { formatLength, lengthToInput } from '../../src/calc/units';
import { HAZEN_C, pipeById, pipeId, type PipeSize } from '../../src/calc/reference';
import { useCountry } from '../../src/country/useCountry';
import { flowUnits, inFlow, inVel, showFlow, showPerLength, showPressure, showVel, showVol } from '../../src/calc/flowUnits';
import { useApp } from '../../src/state/AppState';
import { Card, CheckNote, Field, FieldLabel, Note, ResultPanel, Segmented, Working, readField, useKeypad, useTap, type NumField } from '../../src/ui/kit';
import { ToolFrame, useOpenedRecord } from '../../src/ui/ToolFrame';
import { fmtNumber } from '../../src/ui/format';
import { HIT, font, radius, space, usePalette } from '../../src/ui/theme';

type Mode = 'volume' | 'flow';
type FlowBy = 'lpm' | 'velocity';

export function PipePicker({ value, onChange }: { value: string | null; onChange: (p: PipeSize | null) => void }) {
  const c = usePalette();
  const tap = useTap();
  const { pipes: PIPES, materialsNote, materialsVerified } = useCountry();
  const [material, setMaterial] = useState(() => (value ? pipeById(value)?.material : undefined) ?? PIPES[0]!.material);
  const materials = [...new Set(PIPES.map(p => p.material))];
  const sizes = PIPES.filter(p => p.material === material);
  return (
    <View style={{ gap: space.s }}>
      <FieldLabel>Pipe</FieldLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {materials.map(m => (
          <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: m === material }} onPress={() => { tap(); setMaterial(m); onChange(null); }}
            style={{ minHeight: 44, paddingHorizontal: space.m, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: m === material ? c.copper : c.surface2 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: m === material ? c.onCopper : c.ink }}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {sizes.map(p => {
          const on = p.id === value;
          return (
            <Pressable key={p.id} accessibilityRole="radio" accessibilityLabel={`${p.size}, inside ${p.id_mm} millimetres`} accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(p); }}
              style={{ minHeight: HIT, minWidth: 76, paddingHorizontal: space.m, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.ink : c.surface2 }}>
              <Text style={{ fontFamily: font.display, fontSize: 20, color: on ? c.bg : c.ink }}>{p.size}</Text>
              <Text style={{ fontSize: 12, color: on ? c.bg : c.ink3 }}>ID {fmtNumber(p.id_mm, 1)}</Text>
            </Pressable>
          );
        })}
      </View>
      {!materialsVerified ? <Text style={{ fontSize: 14, color: c.ink3 }}>{materialsNote}</Text> : null}
    </View>
  );
}

export default function FlowScreen() {
  const { prefs } = useApp();
  const country = useCountry();
  const u = prefs.unit;
  const fu = u === 'imperial' && country.usGallons ? 'imperial' : 'metric';
  const FU = flowUnits(fu);
  const rec = useOpenedRecord('flow');
  const ri = rec?.inputs ?? {};
  const [mode, setMode] = useState<Mode>(ri.mode === 'flow' ? 'flow' : 'volume');
  const [pipe, setPipe] = useState<string | null>(typeof ri.pipe === 'string' && pipeById(ri.pipe) ? ri.pipe : null);
  const [idText, setIdText] = useState(typeof ri.id === 'number' && !ri.pipe ? lengthToInput(ri.id, u) : '');
  const [length, setLength] = useState(typeof ri.length === 'number' ? lengthToInput(ri.length, u) : '');
  const [by, setBy] = useState<FlowBy>(ri.by === 'velocity' ? 'velocity' : 'lpm');
  // Saved as SI (L/min or m/s); shown in the person's units.
  const [rate, setRate] = useState(() => {
    if (typeof ri.rateSI !== 'number') return typeof ri.rate === 'number' ? String(ri.rate) : '';
    const v = ri.by === 'velocity' ? showVel(ri.rateSI, fu) : showFlow(ri.rateSI, fu);
    return String(Number(v.toFixed(3)));
  });
  const [cText, setCText] = useState(typeof ri.c === 'number' ? String(ri.c) : '');

  const chosen = pipe ? pipeById(pipe) : undefined;
  const fields: NumField[] = [
    { label: 'Inside diameter (or pick a pipe)', text: idText, setText: s => { setIdText(s); if (s) setPipe(null); }, optional: !!chosen, hint: 'Bore of the pipe' },
    { label: mode === 'volume' ? 'Length of pipe' : 'Length (for pressure loss)', text: length, setText: setLength, optional: mode === 'flow', hint: 'Add m for metres (25m)' },
    { label: by === 'lpm' ? 'Flow' : 'Velocity', text: rate, setText: setRate, kind: 'number', suffix: by === 'lpm' ? FU.flow : FU.vel },
    { label: 'Hazen–Williams C', text: cText, setText: setCText, kind: 'number', optional: true, hint: chosen ? `Typical for ${chosen.material}: ${HAZEN_C[chosen.material] ?? 140}` : 'Copper 140, PVC/PE 150, new steel 120' },
  ];
  const kp = useKeypad(mode === 'volume' ? fields.slice(0, 2) : fields);
  const parsed = fields.map(f => readField(f, u));
  const errs = parsed.map(p => (p && typeof p === 'object' ? p.error : null));
  const num = (i: number) => { const p = parsed[i]; return typeof p === 'number' ? p : undefined; };
  const id = chosen ? pipeId(chosen) : num(0);
  const cValue = num(3) ?? (chosen ? HAZEN_C[chosen.material] : undefined);

  const result = useMemo(() => {
    if (id === undefined || errs.some(Boolean)) return null;
    if (mode === 'volume') { const l = num(1); return l === undefined ? null : volume({ id, length: l }); }
    const raw = num(2);
    if (raw === undefined) return null;
    const r = by === 'lpm' ? inFlow(raw, fu) : inVel(raw, fu);
    const l = num(1);
    const cold = country.maxVelocity?.rules.find(x => /cold/i.test(x.service));
    return flow({ id, ...(by === 'lpm' ? { lpm: r } : { velocity: r }), ...(l !== undefined ? { length: l, c: cValue ?? 140 } : {}), limit: cold && country.maxVelocity ? { max: cold.max, code: country.maxVelocity.code } : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, length, by, rate, cText, pipe, u, fu, country.code]);

  const vol = result && result.ok && 'litres' in result.value ? result.value : null;
  const fl = result && result.ok && 'velocity' in result.value ? result.value : null;
  const pipeName = chosen ? `${chosen.material} ${chosen.size}` : id !== undefined ? `${formatLength(id, u)} bore` : '';
  const snapshot = vol ? {
    inputs: { mode, ...(chosen ? { pipe: chosen.id } : { id }), length: num(1)! },
    summary: `${pipeName}, ${formatLength(num(1)!, u, { metres: true })}: ${fmtNumber(showVol(vol.litres, fu), 2)} ${FU.vol}`,
  } : fl ? {
    inputs: { mode, ...(chosen ? { pipe: chosen.id } : { id }), by, rateSI: by === 'lpm' ? inFlow(num(2)!, fu) : inVel(num(2)!, fu), ...(num(1) !== undefined ? { length: num(1), c: cValue ?? 140 } : {}) },
    summary: `${pipeName}: ${fmtNumber(showFlow(fl.lpm, fu), 1)} ${FU.flow} at ${fmtNumber(showVel(fl.velocity, fu), 2)} ${FU.vel}${fl.kpa !== undefined ? `, loss ${fmtNumber(showPressure(fl.kpa, fu), 1)} ${FU.pressure}` : ''}`,
  } : null;

  return (
    <ToolFrame tool="flow" snapshot={snapshot}>
      <Stack.Screen options={{ title: 'Volume & flow' }} />
      <Segmented value={mode} onChange={setMode} options={[{ value: 'volume', label: 'Water in a pipe' }, { value: 'flow', label: 'Flow & velocity' }]} />
      <ResultPanel
        main={vol ? { label: 'Water in the pipe', value: `${fmtNumber(showVol(vol.litres, fu), 2)} ${FU.vol}` } : fl ? (by === 'lpm' ? { label: 'Velocity', value: `${fmtNumber(showVel(fl.velocity, fu), 2)} ${FU.vel}` } : { label: 'Flow', value: `${fmtNumber(showFlow(fl.lpm, fu), 1)} ${FU.flow}` }) : null}
        rest={vol ? [
          { label: FU.perLength === 'per ft' ? 'Per foot' : 'Per metre', value: `${fmtNumber(showPerLength(vol.litresPerMetre, fu), 3)} ${FU.vol}` },
          { label: 'Weight of water', value: fu === 'imperial' ? `${fmtNumber(vol.kg * 2.20462262, 1)} lb` : `${fmtNumber(vol.kg, 1)} kg` },
        ] : fl ? [
          { label: by === 'lpm' ? 'Flow' : 'Velocity', value: by === 'lpm' ? (fu === 'imperial' ? `${fmtNumber(showFlow(fl.lpm, fu), 1)} gpm` : `${fmtNumber(fl.lps, 2)} L/s`) : `${fmtNumber(showVel(fl.velocity, fu), 2)} ${FU.vel}` },
          ...(fl.kpa !== undefined ? [{ label: 'Pressure loss', value: `${fmtNumber(showPressure(fl.kpa, fu), 1)} ${FU.pressure}` }, { label: 'Head loss', value: fu === 'imperial' ? `${fmtNumber(fl.headLoss! / 0.3048, 2)} ft` : `${fmtNumber(fl.headLoss!, 2)} m` }] : []),
        ] : undefined}
        empty={result && !result.ok ? result.error : mode === 'volume' ? 'Pick a pipe and enter the length' : 'Pick a pipe and enter the flow'}
      />
      {result && result.ok && result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
      <Card>
        <PipePicker value={pipe} onChange={p => { setPipe(p ? p.id : null); if (p) setIdText(''); }} />
        {chosen ? <Note>{chosen.material} {chosen.size}: OD {fmtNumber(chosen.od_mm, 2)} mm, wall {fmtNumber(chosen.wall_mm, 2)} mm, bore {fmtNumber(pipeId(chosen), 2)} mm. {chosen.note}</Note> : null}
        <Field field={fields[0]!} onOpen={() => kp.openAt(0)} error={errs[0]} />
      </Card>
      <Card>
        <Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1]} />
        {mode === 'flow' ? (
          <>
            <Segmented label="I know the" value={by} onChange={b => { setBy(b); setRate(''); }} options={[{ value: 'lpm', label: `Flow (${FU.flow})` }, { value: 'velocity', label: `Velocity (${FU.vel})` }]} />
            <Field field={fields[2]!} onOpen={() => kp.openAt(2)} error={errs[2]} />
            <Field field={fields[3]!} onOpen={() => kp.openAt(3)} error={errs[3]} />
          </>
        ) : null}
      </Card>
      {result && result.ok ? <Working title={snapshot?.summary ?? 'Volume & flow'} steps={result.steps} /> : null}
      <CheckNote />
      {kp.element}
    </ToolFrame>
  );
}
