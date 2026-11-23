import { View } from 'react-native';
import { squareCheck } from '../src/core/square.ts';
import { useSettings } from '../src/state/settings.tsx';
import { space } from '../src/theme/theme.ts';
import { Blade, Checks, ErrorCard, Field, H, Readouts, StepsCard, useReaders, useBadField } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';

export default function Square() {
  const { fmt, settings } = useSettings();
  const fine = useFine();
  const r = useReaders();
  const { vals, set } = useToolInputs('square', (d) => ({ a: d.len(3000, 108), b: d.len(4000, 144), d1: '', d2: '' }));
  const res0 = squareCheck({ a: r.len(vals.a) ?? NaN, b: r.len(vals.b) ?? NaN, d1: r.len(vals.d1), d2: r.len(vals.d2), imperial: settings.units === 'imperial' }, fmt);
  const bad = useBadField(vals);
  const res: typeof res0 = bad ? { ok: false, error: bad } : res0;
  const save = res.ok ? { title: `Square ${fmt.len(r.len(vals.a) ?? 0)} x ${fmt.len(r.len(vals.b) ?? 0)}`, summary: `Diagonal ${fine(res.value.diagonal)}${res.value.measured ? `; measured corner ${fmt.deg(res.value.measured.corner)}` : ''}`, inputs: vals } : null;
  return (
    <ToolShell tool="square" save={save}>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <Field label="Side A" value={vals.a} onChange={set('a')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Side B" value={vals.b} onChange={set('b')} />
        </View>
      </View>
      {!res.ok ? (
        <ErrorCard text={res.error} />
      ) : (
        <>
          <Blade label="Diagonal when square" value={fine(res.value.diagonal)} />
          {res.value.triple ? (
            <Readouts
              rows={[
                { label: '3-4-5: mark along side A', value: fmt.len(res.value.triple.a) },
                { label: 'mark along side B', value: fmt.len(res.value.triple.b) },
                { label: 'between the marks', value: fmt.len(res.value.triple.c), strong: true },
              ]}
            />
          ) : null}
        </>
      )}
      <H>Check a frame</H>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <Field label="Diagonal 1" optional value={vals.d1} onChange={set('d1')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Diagonal 2" optional value={vals.d2} onChange={set('d2')} />
        </View>
      </View>
      {res.ok ? (
        <>
          {res.value.measured ? <Readouts rows={[{ label: 'Corner angle', value: fmt.deg(res.value.measured.corner), strong: true }, { label: 'Out of square', value: fmt.deg(res.value.measured.outBy) }]} /> : null}
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
        </>
      ) : null}
    </ToolShell>
  );
}
