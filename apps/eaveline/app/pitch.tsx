/** Pitch from rise and run, and a converter between degrees, x:12, percent and 1-in-N. Always free. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { pitchFromRiseRun } from '../src/core/geometry';
import { degFromX12, num, oneInFromDeg, percentFromDeg, pitchFactor, riseOver12 } from '../src/core/units';
import { useApp } from '../src/state/AppState';
import { Answer, Btn, ErrorLine, Figures, LengthField, PitchField, Screen, Section, Segmented, Steps } from '../src/ui/kit';
import { SaveToJob } from '../src/ui/parts';

export default function Pitch() {
  const app = useApp();
  const { ctx, prefs } = app;
  const router = useRouter();
  const [mode, setMode] = useState<'measure' | 'convert'>('measure');
  const [rise, setRise] = useState<number | null>(null);
  const [run, setRun] = useState<number | null>(null);
  const [deg, setDeg] = useState<number | null>(null);
  const measured = mode === 'measure' && rise != null && run ? pitchFromRiseRun({ riseMm: rise, runMm: run }, ctx) : null;
  const d = mode === 'measure' ? (measured?.ok ? measured.value.deg : null) : deg;
  const forms = (x: number): [string, string][] => [
    ['Degrees', `${num(x, 2)}°`],
    ['Rise per 12', `${num(riseOver12(x), 2)}:12`],
    ['Percent', `${num(percentFromDeg(x), 1)}%`],
    ['1 in N', x > 0 ? `1 in ${num(oneInFromDeg(x), 2)}` : '–'],
    ['Pitch factor (slope ÷ plan)', num(pitchFactor(x), 4)],
  ];
  const common = prefs.pitchStyle === 'x12' ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(degFromX12) : [2, 5, 10, 15, 20, 22.5, 25, 30, 35, 40, 45];
  return (
    <Screen>
      <Segmented label="What do you have?" value={mode} onChange={setMode} options={[{ value: 'measure', label: 'Rise & run' }, { value: 'convert', label: 'A pitch' }]} />
      {mode === 'measure' ? (
        <>
          <LengthField testID="pitch-rise" label="Rise (vertical)" mm={rise} onMm={setRise} size="short" hint={prefs.sys === 'imperial' ? 'Inches. Tip: measure the rise over a 12 in level.' : 'Tip: hold a 1 m level on the rafter and measure down to it.'} />
          <LengthField testID="pitch-run" label="Run (level)" mm={run} onMm={setRun} size="short" />
          {measured && !measured.ok ? <ErrorLine text={measured.error} /> : null}
        </>
      ) : (
        <PitchField testID="pitch-convert" label="Pitch (any form)" deg={deg} onDeg={setDeg} />
      )}
      {d != null ? (
        <>
          <Answer testID="pitch-answer" label="Pitch" value={ctx.pitch(d)} lines={[prefs.pitchStyle === 'x12' ? `${num(d, 2)}°` : `${num(riseOver12(d), 2)}:12 · ${num(percentFromDeg(d), 1)}%`]} />
          <Figures rows={forms(d)} />
          {measured?.ok ? <Steps steps={[{ label: 'Pitch', formula: 'atan(rise ÷ run)', value: `${num(d, 3)}°` }, { label: 'Rise per 12', formula: '12 × rise ÷ run', value: `${num(riseOver12(d), 3)}:12` }]} /> : null}
          <Btn label="Use as the roof pitch" kind="outline" icon="home-outline" onPress={() => { app.setRoof({ ...app.roof, pitchDeg: d }); router.push('/roof'); }} />
          <SaveToJob tool="pitch" title="Pitch" lines={[`${ctx.pitch(d)} (${prefs.pitchStyle === 'x12' ? `${num(d, 1)}°` : `${num(riseOver12(d), 2)}:12`})`]} />
        </>
      ) : null}
      <Section title="Common pitches">
        <Figures rows={common.map(x => [prefs.pitchStyle === 'x12' ? `${num(riseOver12(x), 0)}:12` : `${num(x, 1)}°`, prefs.pitchStyle === 'x12' ? `${num(x, 1)}° · factor ${num(pitchFactor(x), 3)}` : `${num(riseOver12(x), 2)}:12 · factor ${num(pitchFactor(x), 3)}`])} />
      </Section>
    </Screen>
  );
}
