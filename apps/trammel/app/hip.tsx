import { Text, View } from 'react-native';
import { MAX_CREEPERS, regularHip } from '../src/core/roof.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, useTheme, sys } from '../src/theme/theme.ts';
import { Blade, Card, Segment, Checks, ErrorCard, Field, H, P, Readouts, StepsCard, useReaders, Verify, useBadField } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

export default function Hip() {
  const t = useTheme();
  const { fmt } = useSettings();
  const r = useReaders();
  const { vals, set } = useToolInputs('hip', (d) => ({ kind: 'hip', run: d.len(3000, 144), pitch: '25', spacing: d.len(600, 24) }));
  const spacing = r.len(vals.spacing);
  const res0 = regularHip({ run: r.len(vals.run) ?? NaN, pitchDeg: r.num(vals.pitch) ?? NaN, spacing }, fmt);
  const bad = useBadField(vals);
  const res: typeof res0 = bad ? { ok: false, error: bad } : res0;
  const save = res.ok ? { title: `Hip at ${fmt.deg(res.value.hipPitch)}`, summary: `Hip ${fmt.len(res.value.hipLength)} at ${fmt.deg(res.value.hipPitch)}; creepers ${res.value.creepers.map((c) => fmt.len(c)).join(', ') || 'none'}`, inputs: vals } : null;
  return (
    <ToolShell tool="hip" save={save}>
      <Segment options={[{ value: 'hip', label: 'Hip' }, { value: 'valley', label: 'Valley' }]} value={vals.kind === 'valley' ? 'valley' : 'hip'} onChange={set('kind')} />
      <P muted small>{`Regular ${vals.kind === 'valley' ? 'valley' : 'hip'}: both roof planes at the same pitch, at 45° in plan.`}</P>
      <Field label="Common rafter run" value={vals.run} onChange={set('run')} hint="Half the span, less half the ridge" />
      <Field label="Roof pitch" kind="angle" value={vals.pitch} onChange={set('pitch')} />
      <Field label="Creeper spacing" optional value={vals.spacing} onChange={set('spacing')} />
      {!res.ok ? (
        <ErrorCard text={res.error} />
      ) : (
        <>
          <Blade label="Hip length" value={fmt.len(res.value.hipLength)} sub={`Hip pitch ${fmt.deg(res.value.hipPitch)} · common ${fmt.len(res.value.commonLength)}`} />
          <Readouts
            rows={[
              { label: 'Rise', value: fmt.len(res.value.rise) },
              { label: 'Hip run (plan)', value: fmt.len(res.value.hipRun) },
              { label: 'Hip plumb cut: set the square to', value: fmt.deg(res.value.hipPitch), strong: true },
              { label: 'Hip and creeper cheek cuts', value: 'plumb, 45° bevel' },
              ...(res.value.creeperStep ? [{ label: 'Each creeper shorter by', value: fmt.len(res.value.creeperStep) }] : []),
            ]}
          />
          {res.value.creepers.length && spacing ? (
            <Card>
              <H>{vals.kind === 'valley' ? 'Valley jacks' : 'Creepers'}</H>
              <P muted small>{vals.kind === 'valley' ? 'Position measured along the ridge from where the valley meets it, and length to the valley centre line.' : 'Position from the corner along the wall plate, and length to the hip centre line.'}</P>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {res.value.creepers.map((c, i) => (
                  <View key={i} accessible accessibilityLabel={`Creeper ${i + 1} at ${fmt.len((i + 1) * spacing)}: ${fmt.len(c)}`} style={{ backgroundColor: t.sunk, borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m, minWidth: 100 }}>
                    <Text style={{ ...sys.body, fontSize: 13, color: t.muted }}>
                      #{i + 1} at {fmt.len((i + 1) * spacing)}
                    </Text>
                    <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.ink }}>{fmt.len(c)}</Text>
                  </View>
                ))}
              </View>
              {res.value.creepers.length >= MAX_CREEPERS ? <P muted small>{`Showing the first ${MAX_CREEPERS}: check the spacing and units.`}</P> : null}
            </Card>
          ) : null}
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
          <Verify />
        </>
      )}
    </ToolShell>
  );
}
