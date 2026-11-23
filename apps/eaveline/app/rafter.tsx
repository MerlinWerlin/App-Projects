/** True rafter lengths, and hip/valley rafters for equal or unequal pitches. */
import { useState } from 'react';
import { hipValley, rafter } from '../src/core/geometry';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, ErrorLine, Figures, LengthField, PitchField, Screen, Segmented, Steps } from '../src/ui/kit';
import { Gate, SaveToJob } from '../src/ui/parts';

export default function Rafter() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const initialRun = roofReady(roof) ? (roof.type === 'skillion' ? roof.widthMm : roof.widthMm / 2) : null;
  const [mode, setMode] = useState<'common' | 'hip'>('common');
  const [run, setRun] = useState<number | null>(initialRun);
  const [p, setP] = useState<number | null>(roof.pitchDeg || null);
  const [p2, setP2] = useState<number | null>(null);
  const [oh, setOh] = useState<number | null>(0);
  const r = mode === 'common' && run && p ? rafter({ runMm: run, pitchDeg: p, overhangMm: oh ?? 0 }, ctx) : null;
  const h = mode === 'hip' && run && p ? hipValley({ runMm: run, pitchDeg: p, pitch2Deg: p2 }, ctx) : null;
  return (
    <Screen>
      <Segmented label="Rafter" value={mode} onChange={setMode} options={[{ value: 'common', label: 'Common rafter' }, { value: 'hip', label: `Hip / ${country.terms.valley}` }]} />
      <LengthField testID="rafter-run" label={mode === 'common' ? 'Run (level, wall to ridge line)' : 'Run of the first plane'} mm={run} onMm={setRun}
        hint={initialRun ? `From this roof: ${ctx.len(initialRun)}` : 'Half the span for a gable or hip.'} />
      <PitchField testID="rafter-pitch" label={mode === 'common' ? 'Pitch' : 'Pitch of the first plane'} deg={p} onDeg={setP} />
      {mode === 'common'
        ? <LengthField testID="rafter-overhang" label="Eave overhang (level)" mm={oh} onMm={setOh} size="short" />
        : <PitchField testID="rafter-pitch2" label="Pitch of the second plane (blank = same)" deg={p2} onDeg={setP2} />}
      {r && !r.ok ? <ErrorLine text={r.error} /> : null}
      {h && !h.ok ? <ErrorLine text={h.error} /> : null}
      <Gate tool="rafter">
        {r?.ok ? (
          <>
            <Answer testID="rafter-answer" label="Rafter length" value={ctx.len(r.value.totalMm)} lines={[`To the ridge line ${ctx.len(r.value.rafterMm)} + overhang ${ctx.len(r.value.overhangSlopeMm)}`]} />
            <Figures rows={[['Rise', ctx.len(r.value.riseMm)], ['Pitch factor', r.value.pitchFactor.toFixed(4)]]} />
            <Steps steps={r.steps} notes={r.notes} />
            <SaveToJob tool="rafter" title="Common rafter" lines={[`Run ${ctx.len(run!)} at ${ctx.pitch(p!)}`, `Rafter ${ctx.len(r.value.totalMm)} incl. ${ctx.len(oh ?? 0)} overhang`]} />
          </>
        ) : null}
        {h?.ok ? (
          <>
            <Answer testID="hip-answer" label={`Hip / ${country.terms.valley} length`} value={ctx.len(h.value.hipMm)} lines={[`Pitch ${ctx.pitch(h.value.hipPitchDeg)} · plan angle ${h.value.planAngleDeg.toFixed(1)}°`]} />
            <Figures rows={[
              ['In plan', ctx.len(h.value.hipPlanMm)], ['Rise', ctx.len(h.value.riseMm)],
              ['Common rafter (first plane)', ctx.len(h.value.commonMm)],
              ...(p2 && Math.abs(p2 - (p ?? 0)) > 1e-6 ? [['Run, second plane', ctx.len(h.value.run2Mm)] as [string, string], ['Common rafter (second plane)', ctx.len(h.value.common2Mm)] as [string, string]] : []),
            ]} />
            <Steps steps={h.steps} notes={h.notes} />
            <SaveToJob tool="hip" title={`Hip / ${country.terms.valley}`} lines={[`Hip/${country.terms.valley} ${ctx.len(h.value.hipMm)} at ${ctx.pitch(h.value.hipPitchDeg)}`]} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}
