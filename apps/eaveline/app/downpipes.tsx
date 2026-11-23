/** Downpipe estimate from catchment and rainfall, by the country's method. Always labelled an estimate. */
import { useState } from 'react';
import { roofGeometry } from '../src/core/geometry';
import { num, SQFT_PER_M2 } from '../src/core/units';
import { downpipePlan } from '../src/data/drainagePlan';
import { VERIFIED_LABEL } from '../src/data/src';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, ErrorLine, Notice, NumField, Picker, Screen, Section, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';

export default function Downpipes() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const d = country.drainage;
  const t = ctx.terms;
  const imperial = ctx.sys === 'imperial';
  const g = roofReady(roof) ? roofGeometry(roof, ctx) : null;
  const roofPlan = g?.ok ? g.value.planAreaM2 : null;
  const [area, setArea] = useState<number | null>(roofPlan != null ? round(imperial ? roofPlan * SQFT_PER_M2 : roofPlan) : null);
  const [cityId, setCityId] = useState<string>(d.cities[0] ? d.cities[0].name : 'custom');
  const city = d.cities.find(c => c.name === cityId) ?? null;
  const [customI, setCustomI] = useState<number | null>(d.designIntensityMmPerHr ? round(imperial ? d.designIntensityMmPerHr / 25.4 : d.designIntensityMmPerHr) : null);
  const [gutterId, setGutterId] = useState<string>(country.gutters[0]?.id ?? 'custom');
  const [pipeId, setPipeId] = useState<string>(country.downpipes[0]?.id ?? 'custom');
  const [cap_, setCap] = useState<number | null>(null);
  const [perDp, setPerDp] = useState<number | null>(d.areaPerDownpipeExample?.m2 ?? null);
  const planM2 = area == null ? null : imperial ? area / SQFT_PER_M2 : area;
  const I = city ? city.mmPerHr : customI == null ? null : imperial ? customI * 25.4 : customI;
  const gutter = country.gutters.find(x => x.id === gutterId);
  const pipe = country.downpipes.find(x => x.id === pipeId);
  const needsCap = d.mode === 'flow' && !pipe?.ruleAreaM2 && !(gutter?.capacityLps || pipe?.capacityLps);
  const res = planM2 && roof.pitchDeg >= 0 ? downpipePlan(country, {
    planM2, pitchDeg: roof.pitchDeg || 0, intensityMmPerHr: I, gutterId: gutter ? gutterId : null, downpipeId: pipe ? pipeId : null,
    customCapacityLps: needsCap ? cap_ : null, areaPerDownpipeM2: d.mode === 'areaPerDownpipe' ? perDp : null, runMm: g?.ok ? g.value.eavesMm : null,
  }, ctx) : null;
  return (
    <Screen>
      <Notice icon="water-outline" text={`An estimate to plan with, using ${d.method}. A plumber or designer confirms the real system and overflow.`} />
      <RoofCard need={false} />
      <NumField testID="dp-area" label={`Plan area draining to these ${t.gutters} (${imperial ? 'sq ft' : 'm²'})`} value={area} onValue={setArea} max={imperial ? 1e6 : 1e5}
        hint={roofPlan != null ? `Whole roof in plan: ${ctx.area(roofPlan)}` : 'The roof area as seen from above.'} />
      {d.mode !== 'areaTable' ? (
        <Section title="Rainfall">
          {d.cities.length ? (
            <Picker label="Design rainfall" value={cityId} onPick={setCityId} customLabel="Enter my own"
              choices={d.cities.map(c => ({ id: c.name, title: `${c.name} · ${imperial ? `${num(c.mmPerHr / 25.4, 2)} in/h` : `${c.mmPerHr} mm/h`}`, sub: c.basis, tag: VERIFIED_LABEL[c.src.verified] }))} />
          ) : null}
          {!city ? <NumField testID="dp-intensity" label={`Rainfall intensity (${imperial ? 'in/h' : 'mm/h'})`} value={customI} onValue={setCustomI} max={imperial ? 40 : 1000} hint={d.intensityNote} /> : <Notice icon="information-circle-outline" text={d.intensityNote} />}
        </Section>
      ) : <Notice icon="information-circle-outline" text={d.intensityNote} />}
      <Section title="Rainwater goods">
        {country.gutters.length ? (
          <Picker label={cap(t.gutter)} value={gutterId} onPick={setGutterId} choices={country.gutters.map(x => ({ id: x.id, title: x.name, sub: x.capacityLps ? `${num(x.capacityLps, 2)} L/s per outlet` : x.effectiveAreaMm2 ? `${x.effectiveAreaMm2} mm² effective area` : x.note, tag: VERIFIED_LABEL[x.src.verified] }))} />
        ) : null}
        {country.downpipes.length ? (
          <Picker label={cap(t.downpipe)} value={pipeId} onPick={setPipeId} choices={country.downpipes.map(x => ({ id: x.id, title: x.name, sub: x.note, tag: VERIFIED_LABEL[x.src.verified] }))} />
        ) : null}
        {d.mode === 'areaPerDownpipe' ? (
          <NumField testID="dp-perdp" label={`Catchment per ${t.downpipe} from the chart (m²)`} value={perDp} onValue={setPerDp} max={1000} hint={d.areaPerDownpipeExample?.text} />
        ) : null}
        {needsCap ? <NumField testID="dp-capacity" label={`What one outlet and ${t.downpipe} carries (L/s)`} value={cap_} onValue={setCap} max={100} hint="From the maker’s data for your gutter, outlet and fall." /> : null}
      </Section>
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      <Gate tool="downpipes">
        {res?.ok ? (
          <>
            <Answer testID="downpipes-answer" label={`${cap(t.downpipes)} (estimate)`} value={String(res.value.downpipes)}
              lines={[res.value.flowLps != null ? `Design flow ${num(res.value.flowLps, 2)} L/s` : `For ${ctx.area(res.value.catchmentM2)}`]} />
            <Steps steps={res.steps} notes={[...res.notes, d.slopeFactorNote]} />
            <SaveToJob tool="downpipes" title={cap(t.downpipes)} lines={[`${res.value.downpipes} ${t.downpipes} (estimate) for ${ctx.area(planM2!)} plan`, ...(res.value.flowLps != null ? [`Design flow ${num(res.value.flowLps, 2)} L/s`] : [])]} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
