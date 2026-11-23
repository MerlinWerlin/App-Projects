import { flatMitre, polygonMitre } from '../src/core/mitre.ts';
import { useSettings } from '../src/state/settings.tsx';
import { MitreDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Checks, ErrorCard, Field, Readouts, Segment, StepsCard, useReaders, useBadField } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

export default function Mitre() {
  const { fmt } = useSettings();
  const r = useReaders();
  const { vals, set } = useToolInputs('mitre', () => ({ mode: 'corner', corner: '90', sides: '6' }));
  const corner = vals.mode === 'corner';
  const sides = r.num(vals.sides);
  const res0 = corner ? flatMitre(r.num(vals.corner) ?? NaN, fmt) : polygonMitre(sides ?? NaN, fmt);
  const bad = useBadField(vals);
  const res: typeof res0 = bad ? { ok: false, error: bad } : res0;
  const mitre = res.ok ? ('corner' in res.value ? res.value.mitre : res.value.mitre) : 0;
  const drawCorner = res.ok ? ('corner' in res.value ? res.value.corner : res.value.interior) : 90;
  const save = res.ok ? { title: corner ? `Mitre for a ${fmt.deg(drawCorner)} corner` : `${sides}-sided frame`, summary: `Saw at ${fmt.deg(mitre)} off square on each piece`, inputs: vals } : null;
  return (
    <ToolShell tool="mitre" save={save}>
      <Segment options={[{ value: 'corner', label: 'Any corner' }, { value: 'polygon', label: 'Polygon' }]} value={vals.mode} onChange={set('mode')} />
      {corner ? <Field label="Corner angle" kind="angle" value={vals.corner} onChange={set('corner')} hint="Inside or outside; an outside corner measured 270° works too" /> : <Field label="Number of sides" kind="int" value={vals.sides} onChange={set('sides')} />}
      {!res.ok ? (
        <ErrorCard text={res.error} />
      ) : (
        <>
          <Blade label="Set the saw to" value={fmt.deg(mitre)} sub="on each piece, measured off square" />
          <MitreDiagram corner={drawCorner} />
          <Readouts
            rows={[
              { label: corner ? 'Corner' : 'Interior angle', value: fmt.deg(drawCorner) },
              { label: 'Angle on the piece from its edge', value: fmt.deg(90 - mitre) },
              ...(!corner && sides ? [{ label: 'Cuts', value: `${sides * 2} (${sides} pieces)` }] : []),
            ]}
          />
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
        </>
      )}
    </ToolShell>
  );
}
