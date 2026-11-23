/** Gutter fall over a run at a gradient, or the gradient you get from a fixed fall. Always free. */
import { useState } from 'react';
import { gradientFromFall, gutterFall } from '../src/core/drainage';
import { num } from '../src/core/units';
import { useApp } from '../src/state/AppState';
import { Answer, ErrorLine, Figures, LengthField, Notice, NumField, Screen, Segmented, Steps } from '../src/ui/kit';
import { SaveToJob } from '../src/ui/parts';

export default function Fall() {
  const app = useApp();
  const { ctx, country } = app;
  const d = country.drainage;
  const [mode, setMode] = useState<'fall' | 'gradient'>('fall');
  const [run, setRun] = useState<number | null>(null);
  const [ratio, setRatio] = useState<number | null>(d.fallRatio);
  const [fall, setFall] = useState<number | null>(null);
  const res = mode === 'fall' && run && ratio ? gutterFall({ runMm: run, ratio }, ctx) : null;
  const grad = mode === 'gradient' && run && fall ? gradientFromFall(run, fall) : null;
  const g = ctx.terms.gutter;
  return (
    <Screen>
      <Segmented label="Work out" value={mode} onChange={setMode} options={[{ value: 'fall', label: 'Fall needed' }, { value: 'gradient', label: 'Gradient I get' }]} />
      <LengthField testID="fall-run" label={`${cap(g)} run (outlet to the far end)`} mm={run} onMm={setRun} />
      {mode === 'fall'
        ? <NumField testID="fall-ratio" label="Gradient, 1 in" value={ratio} onValue={setRatio} min={50} max={2000} hint={`${d.fallNote}`} />
        : <LengthField testID="fall-fall" label="Fall available" mm={fall} onMm={setFall} size="short" />}
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      {res?.ok ? (
        <>
          <Answer testID="fall-answer" label="Fall" value={ctx.len(res.value.fallMm)} lines={[`over ${ctx.run(run!)} at 1:${num(ratio!, 0)}`]} />
          <Figures rows={[[ctx.sys === 'imperial' ? 'Per 10 ft' : 'Per metre', ctx.len(ctx.sys === 'imperial' ? 3048 / ratio! : res.value.perMetreMm)], ['Set the high end above the outlet by', ctx.len(res.value.fallMm)]]} />
          <Steps steps={res.steps} notes={[`${d.fallNote}`]} />
          <SaveToJob tool="fall" title={`${cap(g)} fall`} lines={[`${ctx.len(res.value.fallMm)} over ${ctx.run(run!)} (1:${num(ratio!, 0)})`]} />
        </>
      ) : null}
      {grad ? (
        <>
          <Answer testID="gradient-answer" label="Gradient" value={`1:${num(grad, 0)}`} lines={[`${ctx.len(fall!)} over ${ctx.run(run!)}`]} />
          {grad > d.fallRatio ? <Notice tone="danger" icon="warning-outline" text={`Flatter than the 1:${d.fallRatio} guide for ${country.name}.`} /> : <Notice icon="checkmark-circle-outline" tone="ok" text={`At least as steep as the 1:${d.fallRatio} guide.`} />}
        </>
      ) : null}
    </Screen>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
