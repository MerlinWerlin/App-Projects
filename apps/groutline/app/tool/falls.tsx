// Falls to the waste: perimeter height from the longest run, checked against the country's min and max fall.
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { calcFalls, gradientText, parseGradient } from '../../src/core/falls.ts';
import { fmt } from '../../src/core/steps.ts';
import { formatLength } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE, useTheme } from '../../src/theme/theme.ts';
import { useUnits } from '../../src/ui/fields.tsx';
import { Card, Field, Notes, Num, Problems, Row, Section, Segmented, Stat, Steps, Txt } from '../../src/ui/kit.tsx';
import { ToolScreen, useToolInputs } from '../../src/ui/ToolScreen.tsx';

export default function FallsTool() {
  const app = useApp();
  const t = useTheme();
  const u = useUnits();
  const c = app.country;
  const imperial = u.system === 'imperial';
  const defaultRatio = c.falls.target ?? c.falls.min;
  const ratioText = (n: number) => (imperial ? `${fmt(12 / n, 3)} in/ft` : `1:${fmt(n, 0)}`);
  const [s, set, job] = useToolInputs({ drain: 'point', basis: 'plane', length: '', width: '', dx: '', dy: '', ratio: ratioText(defaultRatio), thick: '' });
  const N = parseGradient(s.ratio as string) ?? NaN;
  const L = u.parse(s.length as string, 'room') ?? NaN, W = u.parse(s.width as string, 'room') ?? NaN;
  const dx = (s.dx as string).trim() ? u.parse(s.dx as string, 'room', true) ?? NaN : undefined;
  const dy = (s.dy as string).trim() ? u.parse(s.dy as string, 'room', true) ?? NaN : undefined;
  const r = calcFalls({
    drain: s.drain as 'point' | 'linear', basis: s.basis as 'plane' | 'valley', lengthMm: L, widthMm: W, drainXMm: dx, drainYMm: dy, minRatio: N, maxRatio: c.falls.max,
    thicknessAtWasteMm: (s.thick as string).trim() ? u.parse(s.thick as string, 'tile', true) : null, system: u.system,
  });
  const notes: string[] = r.ok ? [...r.notes] : [];
  if (r.ok && N > c.falls.min + 1e-9) notes.unshift(`${gradientText(N, u.system)} is shallower than the ${gradientText(c.falls.min, u.system)} minimum.`);
  const F = (mm: number) => formatLength(mm, u.system, 'tile');
  const summary = r.ok ? [`Perimeter ${F(r.value.rise)} above the ${c.terms.waste}`, `at ${gradientText(N, u.system)}`] : null;

  return (
    <ToolScreen tool="falls" inputs={s} job={job} summary={summary} steps={r.ok ? r.steps : []} intro={c.falls.label}
      result={r.ok ? (
        <Card>
          <Txt v="footnote" tone="ink2" style={{ fontWeight: '700' }}>{`SET THE PERIMETER ABOVE THE ${c.terms.waste.toUpperCase()}`}</Txt>
          <Num value={F(r.value.rise).replace(/ mm$|″$/, '')} unit={imperial ? 'in' : 'mm'} size={72} />
          <Row gap={SPACE.lg}>
            <Stat label="Longest run" value={formatLength(r.value.longestRun, u.system).replace(/ mm$/, '')} unit={imperial ? undefined : 'mm'} />
            {s.drain === 'point' ? <Stat label="Steepest plane" value={`1:${fmt(r.value.steepestRatio, 0)}`} /> : null}
            {r.value.valleyRatio ? <Stat label="Valley to corner" value={`1:${fmt(r.value.valleyRatio, 0)}`} /> : null}
            {r.value.perimeterThickness != null ? <Stat label="Bed at perimeter" value={F(r.value.perimeterThickness).replace(/ mm$/, '')} unit={imperial ? undefined : 'mm'} /> : null}
          </Row>
          {Number.isFinite(L) && Number.isFinite(W) ? <FallPlan L={L} W={W} dx={dx ?? L / 2} dy={dy ?? W / 2} linear={s.drain === 'linear'} /> : null}
          <Notes notes={r.value.tooSteep ? notes : notes} tone={r.value.tooSteep || N > c.falls.min ? 'warn' : 'ink2'} />
          <Steps steps={r.steps} />
        </Card>
      ) : <Problems problems={r.problems} />}
    >
      <Segmented label={`${c.terms.waste} type`} value={s.drain as string} onChange={v => set({ drain: v })} options={[{ id: 'point', label: `Centre ${c.terms.waste}` }, { id: 'linear', label: 'Strip / linear' }]} />
      <Section title="Floor">
        <Row>
          <Field label={s.drain === 'linear' ? 'Run to far wall' : 'Length'} value={s.length as string} onChangeText={v => set({ length: v })} unit={u.unit('room')} keyboard={u.keyboard} />
          <Field label="Width" value={s.width as string} onChangeText={v => set({ width: v })} unit={u.unit('room')} keyboard={u.keyboard} />
        </Row>
      </Section>
      {s.drain === 'point' ? (
        <Section title="Measure the fall">
          <Segmented label="Fall basis" value={s.basis as string} onChange={v => set({ basis: v })} options={[{ id: 'plane', label: 'Square to walls' }, { id: 'valley', label: 'Valleys too' }]} />
          <Txt v="footnote" tone="ink3" style={{ marginTop: 6 }}>{s.basis === 'valley' ? 'Stricter: even the valleys to the corners reach the minimum fall, so the planes come out steeper.' : 'Codes measure the fall of each floor plane square to the wall. The valleys to the corners fall less: shown below.'}</Txt>
        </Section>
      ) : null}
      {s.drain === 'point' ? (
        <Section title={`${c.terms.waste} position (blank = centre)`}>
          <Row>
            <Field label="From left wall" value={s.dx as string} onChangeText={v => set({ dx: v })} unit={u.unit('room')} keyboard={u.keyboard} />
            <Field label="From back wall" value={s.dy as string} onChangeText={v => set({ dy: v })} unit={u.unit('room')} keyboard={u.keyboard} />
          </Row>
        </Section>
      ) : null}
      <Section title={c.terms.falls}>
        <View style={{ gap: SPACE.sm }}>
          <Row>
            <Field label="Fall" value={s.ratio as string} onChangeText={v => set({ ratio: v })} keyboard="numbers-and-punctuation" hint={imperial ? 'e.g. 1/4 in/ft, 2% or 1:48' : 'e.g. 1:60 or 1.5%'} />
            <Field label={`Bed at the ${c.terms.waste}`} value={s.thick as string} onChangeText={v => set({ thick: v })} unit={u.unit('tile')} keyboard={u.keyboard} hint="Optional" />
          </Row>
          <Txt v="footnote" tone="ink3">{`${c.flag} ${gradientText(c.falls.min, u.system)} minimum${c.falls.max ? `, ${gradientText(c.falls.max, u.system)} steepest` : ''}.${c.falls.verified ? '' : ' Generic: check your local rules.'}`}</Txt>
        </View>
      </Section>
    </ToolScreen>
  );
}

function FallPlan({ L, W, dx, dy, linear }: { L: number; W: number; dx: number; dy: number; linear: boolean }) {
  const t = useTheme();
  const size = 220;
  const sc = size / Math.max(L, W);
  const w = L * sc, h = W * sc, ox = (size - w) / 2 + 20, oy = 10;
  return (
    <View style={{ alignItems: 'center', marginTop: SPACE.sm }} accessible accessibilityRole="image" accessibilityLabel={linear ? 'Plan: strip waste along one wall, one plane falling to it' : 'Plan: falls run from the corners down to the waste'}>
      <Svg width={size + 40} height={h + 20}>
        <Rect x={ox} y={oy} width={w} height={h} fill={t.sunk} stroke={t.ink} strokeWidth={2} />
        {linear ? <Rect x={ox + w - 6} y={oy} width={6} height={h} fill={t.accent} /> : (
          <>
            {[[0, 0], [w, 0], [0, h], [w, h]].map(([cx, cy], i) => <Line key={i} x1={ox + cx} y1={oy + cy} x2={ox + dx * sc} y2={oy + dy * sc} stroke={t.ink3} strokeWidth={1.5} strokeDasharray="4 4" />)}
            <Circle cx={ox + dx * sc} cy={oy + dy * sc} r={8} fill={t.accent} stroke={t.ink} strokeWidth={2} />
          </>
        )}
      </Svg>
    </View>
  );
}
