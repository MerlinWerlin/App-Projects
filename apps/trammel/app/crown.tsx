import { compoundMitre } from '../src/core/mitre.ts';
import { useSettings } from '../src/state/settings.tsx';
import { Blade, Checks, ErrorCard, Field, P, Readouts, Segment, StepsCard, useReaders } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

const SPRINGS = [
  { value: '38', label: '38° (52/38)' },
  { value: '45', label: '45° (45/45)' },
  { value: '52', label: '52°' },
];

export default function Crown() {
  const { fmt } = useSettings();
  const r = useReaders();
  const { vals, set } = useToolInputs('crown', () => ({ spring: '45', corner: '90' }));
  const res = compoundMitre(r.num(vals.spring) ?? NaN, r.num(vals.corner) ?? NaN, fmt);
  const save = res.ok ? { title: `Cornice, ${fmt.deg(res.value.corner)} corner`, summary: `Spring ${fmt.deg(res.value.tilt)}: bevel ${fmt.deg(res.value.bevel)}, mitre ${fmt.deg(res.value.mitre)} flat; or nested mitre ${fmt.deg(res.value.nestedMitre)}`, inputs: vals } : null;
  return (
    <ToolShell tool="crown" save={save}>
      <Field label="Spring angle" kind="angle" value={vals.spring} onChange={set('spring')} hint="Between the back of the moulding and the wall" />
      <Segment options={SPRINGS} value={vals.spring} onChange={set('spring')} />
      <Field label="Corner angle" kind="angle" value={vals.corner} onChange={set('corner')} hint="90 for a square room; inside and outside corners use the same angles" />
      {!res.ok ? (
        <ErrorCard text={res.error} />
      ) : (
        <>
          <Blade label="Lying flat on the saw" value={`${fmt.deg(res.value.bevel)} / ${fmt.deg(res.value.mitre)}`} sub="bevel (blade tilt) / mitre (table)" />
          <Readouts
            rows={[
              { label: 'Bevel', value: fmt.deg(res.value.bevel), strong: true },
              { label: 'Mitre', value: fmt.deg(res.value.mitre), strong: true },
              { label: 'Or nested against the fence: mitre', value: fmt.deg(res.value.nestedMitre) },
              { label: 'Nested: bevel', value: '0°' },
            ]}
          />
          <P muted small>Nested means upside down against the fence at its spring angle, as if the fence were the wall and the table the ceiling. Plaster cove cornice is normally cut nested in a mitre box.</P>
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
        </>
      )}
    </ToolShell>
  );
}
