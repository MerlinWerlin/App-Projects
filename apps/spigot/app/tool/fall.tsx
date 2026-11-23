import React, { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { fall, gradeFromDrop, gradeToText, trim, type FallResult, type GradeInput } from '../../src/calc/fall';
import { formatLength, lengthToInput } from '../../src/calc/units';
import { useApp } from '../../src/state/AppState';
import { Card, Chips, Field, Note, ResultPanel, Segmented, Working, readField, useKeypad, type NumField } from '../../src/ui/kit';
import { ToolFrame, useOpenedRecord } from '../../src/ui/ToolFrame';
import { FallDiagram } from '../../src/ui/diagrams';
import { useCountry } from '../../src/country/useCountry';
import { fmtNumber } from '../../src/ui/format';

type Mode = 'drop' | 'check';
type GradeKind = GradeInput['kind'];

export default function FallScreen() {
  const { prefs } = useApp();
  const country = useCountry();
  const T = country.terms;
  const u = prefs.unit;
  const rec = useOpenedRecord('fall');
  const ri = rec?.inputs ?? {};
  const [mode, setMode] = useState<Mode>(ri.mode === 'check' ? 'check' : 'drop');
  const [length, setLength] = useState(typeof ri.length === 'number' ? lengthToInput(ri.length, u) : '');
  const [dropText, setDropText] = useState(typeof ri.drop === 'number' ? lengthToInput(ri.drop, u) : '');
  const [gradeKind, setGradeKind] = useState<GradeKind>(ri.gradeKind === 'percent' || ri.gradeKind === 'mmPerM' ? ri.gradeKind : 'ratio');
  const [gradeText, setGradeText] = useState(() => typeof ri.n === 'number' ? gradeToText(ri.n, ri.gradeKind === 'percent' || ri.gradeKind === 'mmPerM' ? ri.gradeKind : 'ratio', u) : String(country.commonGrades[0] ?? 60));
  const [start, setStart] = useState(typeof ri.startLevel === 'number' ? String(ri.startLevel) : '');

  const perLabel = u === 'imperial' ? 'in per ft' : 'mm per m';
  const gradeSuffix = gradeKind === 'ratio' ? '' : gradeKind === 'percent' ? '%' : u === 'imperial' ? 'in/ft' : 'mm/m';
  const fields: NumField[] = [
    { label: mode === 'drop' ? 'Length of run' : 'Length measured', text: length, setText: setLength, hint: u === 'imperial' ? 'Horizontal length, e.g. 40\' 6' : 'Horizontal length. Add m for metres (12m)' },
    mode === 'drop'
      ? { label: gradeKind === 'ratio' ? 'Grade 1 :' : gradeKind === 'percent' ? 'Grade (percent)' : 'Fall per metre', text: gradeText, setText: setGradeText, kind: gradeKind === 'mmPerM' && u === 'imperial' ? 'length' : 'number', suffix: gradeSuffix, hint: gradeKind === 'ratio' ? 'The N in 1:N, e.g. 60' : undefined }
      : { label: 'Measured drop', text: dropText, setText: setDropText, hint: 'Difference in level over that length' },
    { label: 'Start invert level', text: start, setText: setStart, kind: 'number', signed: true, suffix: 'm', optional: true, hint: 'Reduced level in metres, e.g. 10.250' },
  ];
  const kp = useKeypad(mode === 'drop' ? fields : fields.slice(0, 2));
  const parsed = fields.map(f => readField(f, u));
  const errs = parsed.map(p => (p && typeof p === 'object' ? p.error : null));
  const num = (i: number) => { const p = parsed[i]; return typeof p === 'number' ? p : undefined; };

  const grade = (): GradeInput | null => {
    const g = num(1);
    if (g === undefined) return null;
    if (gradeKind === 'ratio') return { kind: 'ratio', n: g };
    if (gradeKind === 'percent') return { kind: 'percent', pct: g };
    // Imperial "in per ft" is typed as a length (so 1/4 works) and arrives in mm.
    return u === 'imperial' ? { kind: 'inPerFt', inches: g / 25.4 } : { kind: 'mmPerM', mm: g };
  };

  const result = useMemo(() => {
    if (errs.some(Boolean)) return null;
    const l = num(0);
    if (l === undefined) return null;
    if (mode === 'check') { const d = num(1); return d === undefined ? null : gradeFromDrop(l, d); }
    const g = grade();
    if (!g) return null;
    return fall({ length: l, grade: g, startLevel: num(2) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, length, dropText, gradeKind, gradeText, start, u]);

  const drop = result && result.ok && mode === 'drop' ? (result.value as FallResult) : null;
  const check = result && result.ok && mode === 'check' ? (result.value as { n: number; percent: number }) : null;
  const snapshot = drop ? {
    inputs: { mode, length: num(0)!, gradeKind, n: drop.n, ...(num(2) !== undefined ? { startLevel: num(2) } : {}) },
    summary: `1:${trim(drop.n)} over ${formatLength(num(0)!, u, { metres: true })}: fall ${formatLength(drop.drop, u)}`,
  } : check ? {
    inputs: { mode, length: num(0)!, drop: num(1)! },
    summary: `${formatLength(num(1)!, u)} over ${formatLength(num(0)!, u, { metres: true })} = 1:${trim(check.n)}`,
  } : null;

  const flattest = country.minGrades ? Math.max(...country.minGrades.rules.map(r => r.n)) : null;
  const shownN = drop?.n ?? check?.n;
  const minGradeWarn = shownN !== undefined && flattest !== null && shownN > flattest ? `Flatter than any minimum ${T.fallLower} in ${country.codeName} (1:${trim(flattest)}). Check the table in Reference.` : shownN !== undefined && flattest === null && shownN > 100 ? `Flatter than 1:100 (1 %). Check the minimum ${T.fallLower} in your local code.` : null;

  return (
    <ToolFrame tool="fall" snapshot={snapshot}>
      <Stack.Screen options={{ title: T.fall }} />
      <Segmented value={mode} onChange={setMode} options={[{ value: 'drop', label: `${T.fall} from a grade` }, { value: 'check', label: 'Check a grade' }]} />
      <ResultPanel
        main={drop ? { label: `Total ${T.fallLower}`, value: formatLength(drop.drop, u) } : check ? { label: 'Grade', value: `1 : ${trim(check.n)}` } : null}
        rest={drop ? [
          { label: 'Grade', value: `1 : ${trim(drop.n)}` },
          { label: 'Percent', value: `${fmtNumber(drop.percent, 2)} %` },
          u === 'imperial' ? { label: 'Per foot', value: formatLength(304.8 / drop.n, u) } : { label: 'Per metre', value: formatLength(drop.mmPerMetre, u) },
          ...(drop.endLevel !== undefined ? [{ label: 'Finish level', value: `${drop.endLevel.toFixed(3)} m` }] : []),
        ] : check ? [{ label: 'Percent', value: `${fmtNumber(check.percent, 2)} %` }, u === 'imperial' ? { label: 'Per foot', value: formatLength(304.8 / check.n, u) } : { label: 'Per metre', value: formatLength(1000 / check.n, u) }] : undefined}
        empty={result && !result.ok ? result.error : mode === 'drop' ? 'Enter the length and grade' : 'Enter the length and drop'}
      />
      {minGradeWarn ? <Note tone="warn">{minGradeWarn}</Note> : null}
      <Card>
        <Field field={fields[0]!} onOpen={() => kp.openAt(0)} error={errs[0]} />
        {mode === 'drop' ? (
          <>
            <Segmented label="Grade as" value={gradeKind} onChange={k => { setGradeKind(k); setGradeText(''); }} options={[{ value: 'ratio', label: '1 : N' }, { value: 'percent', label: 'Percent' }, { value: 'mmPerM', label: perLabel }]} />
            {gradeKind === 'ratio' ? <Chips label="Common grades" options={country.commonGrades} value={num(1) ?? null} onChange={n => setGradeText(String(n))} format={n => country.gradeLabel ? country.gradeLabel(n) : `1:${n}`} /> : null}
            <Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1]} />
          </>
        ) : (
          <Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={errs[1]} />
        )}
      </Card>
      <FallDiagram word={T.fall.toUpperCase()} drop={drop ? formatLength(drop.drop, u) : undefined} length={num(0) !== undefined ? formatLength(num(0)!, u, { metres: true }) : undefined} />
      {mode === 'drop' ? (
        <Card>
          <Field field={fields[2]!} onOpen={() => kp.openAt(2)} error={errs[2]} />
          <Note>Give the upstream invert level to get the downstream one. Levels are in metres.</Note>
        </Card>
      ) : null}
      {result && result.ok ? <Working title={snapshot?.summary ?? 'Fall'} steps={result.steps} /> : null}
      <Note>{`Minimum grades depend on pipe size and use. Check ${country.codeName} and the pipe manufacturer.`}</Note>
      {kp.element}
    </ToolFrame>
  );
}
