import React, { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { simpleOffset, FITTING_ANGLES } from '../../src/calc/offset';
import { formatLength, lengthToInput } from '../../src/calc/units';
import { useApp } from '../../src/state/AppState';
import { Card, CheckNote, Chips, Field, Note, ResultPanel, Working, readField, useKeypad, type NumField } from '../../src/ui/kit';
import { ToolFrame, useOpenedRecord } from '../../src/ui/ToolFrame';
import { OffsetDiagram } from '../../src/ui/diagrams';
import { fmtNumber } from '../../src/ui/format';

const angleLabel = (a: number) => (a === 11.25 ? '11¼°' : a === 22.5 ? '22½°' : `${a}°`);

export default function OffsetScreen() {
  const { prefs } = useApp();
  const u = prefs.unit;
  const rec = useOpenedRecord('offset');
  const init = (k: string) => (typeof rec?.inputs[k] === 'number' ? lengthToInput(rec.inputs[k] as number, u) : '');
  const [offset, setOffset] = useState(init('offset'));
  const [ta, setTa] = useState(init('takeoffA'));
  const [tb, setTb] = useState(init('takeoffB'));
  const [angle, setAngle] = useState<number>(typeof rec?.inputs.angle === 'number' ? (rec.inputs.angle as number) : 45);
  const [customAngle, setCustomAngle] = useState(FITTING_ANGLES.includes(angle as never) ? '' : String(angle));

  const fields: NumField[] = [
    { label: 'Offset (centre to centre)', text: offset, setText: setOffset, hint: 'Sideways distance between the pipes' },
    { label: 'Other angle', text: customAngle, setText: s => { setCustomAngle(s); const n = Number(s); if (Number.isFinite(n) && n > 0) setAngle(n); }, kind: 'number', suffix: '°', optional: true, hint: 'Any angle above 0° up to 90°' },
    { label: 'Take-off, fitting A', text: ta, setText: setTa, optional: true, hint: 'Centre to pipe stop. Leave blank for travel only' },
    { label: 'Take-off, fitting B', text: tb, setText: setTb, optional: true, hint: 'Centre to pipe stop' },
  ];
  const kp = useKeypad(fields);

  const parsed = fields.map(f => readField(f, u));
  const errs = parsed.map(p => (p && typeof p === 'object' ? p.error : null));
  const num = (i: number) => { const p = parsed[i]; return typeof p === 'number' ? p : undefined; };
  const result = useMemo(() => {
    const o = num(0);
    if (o === undefined || errs.some(Boolean)) return null;
    return simpleOffset({ offset: o, angle, takeoffA: num(2), takeoffB: num(3) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, angle, ta, tb, u]);

  const ok = result && result.ok ? result.value : null;
  const snapshot = ok ? {
    inputs: { offset: num(0)!, angle, ...(num(2) !== undefined ? { takeoffA: num(2) } : {}), ...(num(3) !== undefined ? { takeoffB: num(3) } : {}) },
    summary: `${formatLength(num(0)!, u)} offset at ${angleLabel(angle)}: travel ${formatLength(ok.travel, u)}${ok.cut !== undefined ? `, cut ${formatLength(ok.cut, u)}` : ''}`,
  } : null;

  return (
    <ToolFrame tool="offset" snapshot={snapshot}>
      <Stack.Screen options={{ title: 'Offset' }} />
      <ResultPanel
        main={ok ? (ok.cut !== undefined ? { label: 'Cut length', value: formatLength(ok.cut, u) } : { label: 'Travel (centre to centre)', value: formatLength(ok.travel, u) }) : null}
        rest={ok ? [
          ...(ok.cut !== undefined ? [{ label: 'Travel', value: formatLength(ok.travel, u) }] : []),
          { label: 'Run', value: formatLength(ok.run, u) },
          { label: 'Multiplier', value: `× ${fmtNumber(ok.multiplier, 3)}` },
        ] : undefined}
        empty={result && !result.ok ? result.error : 'Enter the offset'}
      />
      {result && result.ok && result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
      <Card>
        <Field field={fields[0]!} onOpen={() => kp.openAt(0)} error={errs[0]} />
        <Chips label="Fitting angle" options={FITTING_ANGLES} value={FITTING_ANGLES.includes(angle as never) && !customAngle ? angle : null} onChange={a => { setAngle(a); setCustomAngle(''); }} format={angleLabel} />
        <Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1] ?? (customAngle && !(angle > 0 && angle <= 90) ? 'Use an angle above 0° up to 90°' : null)} />
      </Card>
      <OffsetDiagram angle={angle} labels={ok ? { offset: formatLength(num(0)!, u), run: formatLength(ok.run, u), travel: formatLength(ok.travel, u) } : undefined} />
      <Card>
        <Field field={fields[2]!} onOpen={() => kp.openAt(2)} error={errs[2]} />
        <Field field={fields[3]!} onOpen={() => kp.openAt(3)} error={errs[3]} />
        <Note>Add the take-offs to get the cut length of the diagonal piece. Cut length = travel − take-off A − take-off B. The Cut length tool has a fitting table.</Note>
      </Card>
      {result && result.ok ? <Working title={snapshot?.summary ?? 'Offset'} steps={result.steps} /> : null}
      <CheckNote />
      {kp.element}
    </ToolFrame>
  );
}
