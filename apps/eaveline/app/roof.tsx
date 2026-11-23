/** The roof every calculator works from: shape, plan size at the eaves, pitch → areas and lengths. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { roofGeometry, type RoofType } from '../src/core/geometry';
import { useApp } from '../src/state/AppState';
import { SPACE } from '../src/theme/theme';
import { Answer, Btn, ErrorLine, Figures, LengthField, PitchField, Screen, Segmented, Steps, Txt } from '../src/ui/kit';
import { Gate, RoofDiagram, SaveToJob } from '../src/ui/parts';

export default function Roof() {
  const app = useApp();
  const { ctx, country } = app;
  const router = useRouter();
  const [type, setType] = useState<RoofType>(app.roof.type);
  const [L, setL] = useState<number | null>(app.roof.lengthMm || null);
  const [W, setW] = useState<number | null>(app.roof.widthMm || null);
  const [p, setP] = useState<number | null>(app.roof.pitchDeg || null);
  const filled = !!(L && W && p);
  const g = filled ? roofGeometry({ type, lengthMm: L!, widthMm: W!, pitchDeg: p! }, ctx) : null;
  const keep = (next: Partial<{ type: RoofType; L: number | null; W: number | null; p: number | null }>) => {
    const r = { type: next.type ?? type, lengthMm: (next.L !== undefined ? next.L : L) ?? 0, widthMm: (next.W !== undefined ? next.W : W) ?? 0, pitchDeg: (next.p !== undefined ? next.p : p) ?? 0 };
    app.setRoof(r);
  };
  const v = g?.ok ? g.value : null;
  const lines = v ? [
    `${type} roof ${ctx.dim(v.lengthMm)} × ${ctx.dim(v.widthMm)} at ${ctx.pitch(v.pitchDeg)}`,
    `Roof area ${ctx.area(v.roofAreaM2)} (plan ${ctx.area(v.planAreaM2)})`,
    `Common rafter ${ctx.len(v.rafterMm)}`,
    ...(v.ridgeMm ? [`${country.terms.ridge} ${ctx.run(v.ridgeMm)}`] : []),
    ...(v.hipCount ? [`${v.hipCount} hips × ${ctx.len(v.hipEachMm)}`] : []),
    ...(v.bargeCount ? [`${v.bargeCount} ${country.terms.barge}s × ${ctx.len(v.bargeEachMm)}`] : []),
    `Eaves ${ctx.run(v.eavesMm)}`,
  ] : [];
  return (
    <Screen>
      <View style={{ alignItems: 'center' }}><RoofDiagram type={type} /></View>
      <Segmented label="Roof shape" value={type} onChange={t => { setType(t); keep({ type: t }); }}
        options={[{ value: 'gable', label: 'Gable' }, { value: 'hip', label: 'Hip' }, { value: 'skillion', label: 'Skillion' }]} />
      <LengthField testID="roof-length" label="Length (L), along the eaves" mm={L} onMm={x => { setL(x); keep({ L: x }); }} hint="Outside of fascia to outside of fascia, overhangs included." />
      <LengthField testID="roof-width" label={type === 'skillion' ? 'Width (W), low eave to high side' : 'Width (W), eave to eave'} mm={W} onMm={x => { setW(x); keep({ W: x }); }} />
      <PitchField testID="roof-pitch" deg={p} onDeg={x => { setP(x); keep({ p: x }); }} />
      {!filled ? <Txt v="subhead" tone="ink3">Measure the roof outline in plan (as seen from above) and enter its pitch. Every calculator then starts from this roof.</Txt> : null}
      {g && !g.ok ? <ErrorLine text={g.error} /> : null}
      {v ? (
        <Gate tool="roof">
          <Answer testID="roof-answer" label="Roof surface area" value={ctx.area(v.roofAreaM2)} lines={[`Plan area ${ctx.area(v.planAreaM2)}`]} />
          <Figures rows={[
            ['Common rafter', ctx.len(v.rafterMm)],
            ['Rise', ctx.len(v.riseMm)],
            ...(v.ridgeMm ? [[cap(country.terms.ridge), ctx.run(v.ridgeMm)] as [string, string]] : []),
            ...(v.hipCount ? [[`Hips (${v.hipCount})`, `${ctx.len(v.hipEachMm)} each`] as [string, string], ['Hip pitch', ctx.pitch(v.hipPitchDeg)] as [string, string]] : []),
            ...(v.bargeCount ? [[`${cap(country.terms.barge)}s (${v.bargeCount})`, `${ctx.len(v.bargeEachMm)} each`] as [string, string]] : []),
            ...(v.topEdgeMm ? [['High-side edge', ctx.run(v.topEdgeMm)] as [string, string]] : []),
            [`Eaves (${country.terms.gutter})`, ctx.run(v.eavesMm)],
          ]} />
          <Steps steps={g!.ok ? g!.steps : []} notes={g!.ok ? g!.notes : []} />
          <SaveToJob tool="roof" title="Roof size & area" lines={lines} />
          <Btn label="Work out the sheets" kind="outline" icon="arrow-forward" onPress={() => router.push(country.sheets.length || !country.guided ? '/sheets' : '/shingles')} style={{ marginTop: SPACE.xs }} />
        </Gate>
      ) : null}
    </Screen>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
