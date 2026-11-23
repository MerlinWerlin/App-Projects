import { View } from 'react-native';
import { pitchFromDegrees, pitchFromRiseRun } from '../src/core/roof.ts';
import { useSettings } from '../src/state/settings.tsx';
import { space } from '../src/theme/theme.ts';
import { Blade, ErrorCard, Field, Readouts, Segment, useReaders, Verify } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

export default function Pitch() {
  const { fmt } = useSettings();
  const r = useReaders();
  const { vals, set } = useToolInputs('pitch', (d) => ({ mode: 'deg', deg: '22.5', rise: d.len(250, 6), run: d.len(1000, 12) }));
  const p = vals.mode === 'deg' ? pitchFromDegrees(r.num(vals.deg) ?? NaN) : pitchFromRiseRun(r.len(vals.rise) ?? NaN, r.len(vals.run) ?? NaN);
  const save = p ? { title: `Pitch ${fmt.deg(p.deg)}`, summary: `${fmt.deg(p.deg)} = ${fmt.num(p.per1000, 0)} per 1000 = ${fmt.num(p.in12, 2)} in 12 = ${fmt.num(p.percent, 1)}%`, inputs: vals } : null;
  return (
    <ToolShell tool="pitch" save={save}>
      <Segment options={[{ value: 'deg', label: 'From degrees' }, { value: 'riserun', label: 'From rise and run' }]} value={vals.mode} onChange={set('mode')} />
      {vals.mode === 'deg' ? (
        <Field label="Pitch" kind="angle" value={vals.deg} onChange={set('deg')} />
      ) : (
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <Field label="Rise" value={vals.rise} onChange={set('rise')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Run" value={vals.run} onChange={set('run')} />
          </View>
        </View>
      )}
      {!p ? (
        <ErrorCard text={vals.mode === 'deg' ? 'Enter a pitch between 0° and 90°.' : 'Enter a rise and a run, both more than zero.'} />
      ) : (
        <>
          <Blade label="Pitch" value={fmt.deg(p.deg)} sub={`${fmt.num(p.in12, 2)} in 12 · 1 : ${fmt.num(p.ratio, 2)}`} />
          <Readouts
            rows={[
              { label: 'Rise per 1000 of run', value: `${fmt.num(p.per1000, 0)} mm` },
              { label: 'Rise per 12 of run', value: fmt.num(p.in12, 2) },
              { label: 'Grade', value: `${fmt.num(p.percent, 1)}%` },
              { label: 'Ratio', value: `1 : ${fmt.num(p.ratio, 2)}` },
              { label: 'Rafter per 1000 of run', value: `${fmt.num(1000 / Math.cos((p.deg * Math.PI) / 180), 0)} mm` },
            ]}
          />
          <Verify text="Minimum pitches for roof sheets and tiles come from the manufacturer: check them for your product." />
        </>
      )}
    </ToolShell>
  );
}
