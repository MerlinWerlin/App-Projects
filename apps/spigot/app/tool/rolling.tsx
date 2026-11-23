import React, { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { rollingOffset, FITTING_ANGLES } from '../../src/calc/offset';
import { formatLength, lengthToInput } from '../../src/calc/units';
import { useApp } from '../../src/state/AppState';
import { Card, CheckNote, Chips, Field, Note, ResultPanel, Working, readField, useKeypad, type NumField } from '../../src/ui/kit';
import { ToolFrame, useOpenedRecord } from '../../src/ui/ToolFrame';
import { RollingDiagram } from '../../src/ui/diagrams';
import { fmtNumber } from '../../src/ui/format';

const angleLabel = (a: number) => (a === 11.25 ? '11¼°' : a === 22.5 ? '22½°' : `${a}°`);
const ANGLES = FITTING_ANGLES.filter(a => a !== 90);

export default function RollingScreen() {
  const { prefs } = useApp();
  const u = prefs.unit;
  const rec = useOpenedRecord('rolling');
  const init = (k: string) => (typeof rec?.inputs[k] === 'number' ? lengthToInput(rec.inputs[k] as number, u) : '');
  const [rise, setRise] = useState(init('rise'));
  const [roll, setRoll] = useState(init('roll'));
  const [ta, setTa] = useState(init('takeoffA'));
  const [tb, setTb] = useState(init('takeoffB'));
  const [angle, setAngle] = useState<number>(typeof rec?.inputs.angle === 'number' ? (rec.inputs.angle as number) : 45);

  const fields: NumField[] = [
    { label: 'Rise (up or down)', text: rise, setText: setRise, hint: 'Offset in the first direction' },
    { label: 'Roll (across)', text: roll, setText: setRoll, hint: 'Offset in the second direction, also called spread' },
    { label: 'Take-off, fitting A', text: ta, setText: setTa, optional: true },
    { label: 'Take-off, fitting B', text: tb, setText: setTb, optional: true },
  ];
  const kp = useKeypad(fields);
  const parsed = fields.map(f => readField(f, u));
  const errs = parsed.map(p => (p && typeof p === 'object' ? p.error : null));
  const num = (i: number) => { const p = parsed[i]; return typeof p === 'number' ? p : undefined; };
  const result = useMemo(() => {
    const r = num(0), s = num(1);
    if (r === undefined || s === undefined || errs.some(Boolean)) return null;
    return rollingOffset({ rise: r, roll: s, angle, takeoffA: num(2), takeoffB: num(3) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rise, roll, angle, ta, tb, u]);
  const ok = result && result.ok ? result.value : null;
  const snapshot = ok ? {
    inputs: { rise: num(0)!, roll: num(1)!, angle, ...(num(2) !== undefined ? { takeoffA: num(2) } : {}), ...(num(3) !== undefined ? { takeoffB: num(3) } : {}) },
    summary: `Rolling ${formatLength(num(0)!, u)} × ${formatLength(num(1)!, u)} at ${angleLabel(angle)}: travel ${formatLength(ok.travel, u)}`,
  } : null;

  return (
    <ToolFrame tool="rolling" snapshot={snapshot}>
      <Stack.Screen options={{ title: 'Rolling offset' }} />
      <ResultPanel
        main={ok ? (ok.cut !== undefined ? { label: 'Cut length', value: formatLength(ok.cut, u) } : { label: 'Travel (centre to centre)', value: formatLength(ok.travel, u) }) : null}
        rest={ok ? [
          ...(ok.cut !== undefined ? [{ label: 'Travel', value: formatLength(ok.travel, u) }] : []),
          { label: 'True offset', value: formatLength(ok.trueOffset, u) },
          { label: 'Setback (run)', value: formatLength(ok.run, u) },
          { label: 'Roll fitting', value: `${fmtNumber(ok.rollAngle, 1)}°` },
        ] : undefined}
        empty={result && !result.ok ? result.error : 'Enter the rise and roll'}
      />
      {result && result.ok && result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
      <Card>
        <Field field={fields[0]!} onOpen={() => kp.openAt(0)} error={errs[0]} />
        <Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1]} />
        <Chips label="Fitting angle" options={ANGLES} value={angle} onChange={setAngle} format={angleLabel} />
      </Card>
      <RollingDiagram />
      <Card>
        <Field field={fields[2]!} onOpen={() => kp.openAt(2)} error={errs[2]} />
        <Field field={fields[3]!} onOpen={() => kp.openAt(3)} error={errs[3]} />
        <Note>“Roll fitting” is how far to turn the fittings from the rise direction so the diagonal points at the true offset.</Note>
      </Card>
      {result && result.ok ? <Working title={snapshot?.summary ?? 'Rolling offset'} steps={result.steps} /> : null}
      <CheckNote />
      {kp.element}
    </ToolFrame>
  );
}
