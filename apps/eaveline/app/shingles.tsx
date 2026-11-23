/** Asphalt shingles: squares, bundles, starter, hip & ridge, nails. */
import { useState } from 'react';
import { roofGeometry } from '../src/core/geometry';
import { shingles } from '../src/core/shingles';
import { grouped, num } from '../src/core/units';
import { VERIFIED_LABEL } from '../src/data/src';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, ErrorLine, Figures, Notice, NumField, Picker, Screen, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';

export default function Shingles() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const [id, setId] = useState<string>(country.shingles[0]?.id ?? 'custom');
  const sh = country.shingles.find(x => x.id === id) ?? null;
  const [bps, setBps] = useState<number | null>(sh?.bundlesPerSquare ?? 3);
  const [sps, setSps] = useState<number | null>(sh?.shinglesPerSquare ?? 64);
  const [nails, setNails] = useState<number | null>(sh?.nailsPerShingle ?? 4);
  const [waste, setWaste] = useState<number | null>(country.defaults.wastePct);
  const starter = country.caps.find(c => c.kind === 'starter');
  const capProd = country.caps.find(c => c.kind === 'shingleCap');
  const pick = (x: string) => {
    setId(x);
    const s = country.shingles.find(y => y.id === x);
    if (s) { setBps(s.bundlesPerSquare); setSps(s.shinglesPerSquare); setNails(s.nailsPerShingle); }
  };
  const g = roofReady(roof) ? roofGeometry(roof, ctx) : null;
  const v = g?.ok ? g.value : null;
  const res = v && bps && sps && nails ? shingles({
    roofAreaM2: v.roofAreaM2, bundlesPerSquare: bps, shinglesPerSquare: sps, wastePct: waste ?? 0, nailsPerShingle: nails,
    starterRunMm: v.eavesMm + v.bargeEachMm * v.bargeCount, capRunMm: v.ridgeMm + v.hipEachMm * v.hipCount,
    starterFtPerBundle: starter?.ftPerBundle ?? null, capFtPerBundle: capProd?.ftPerBundle ?? null,
  }, ctx) : null;
  const belowMin = sh?.minPitchDeg != null && v && v.pitchDeg < sh.minPitchDeg - 1e-9;
  return (
    <Screen>
      <RoofCard />
      <Picker label="Shingle" value={id} onPick={pick} choices={country.shingles.map(x => ({ id: x.id, title: x.name, sub: `${x.bundlesPerSquare} bundles a square · ${x.nailsPerShingle} nails`, tag: VERIFIED_LABEL[x.src.verified] }))} />
      {sh?.note ? <Notice icon="information-circle-outline" text={sh.note} /> : null}
      {belowMin ? <Notice tone="danger" icon="warning-outline" text={`This roof is ${ctx.pitch(v!.pitchDeg)}, below the ${ctx.pitch(sh!.minPitchDeg!)} minimum for this shingle.`} /> : null}
      <NumField label="Bundles per square" value={bps} onValue={setBps} max={10} />
      <NumField label="Shingles per square" value={sps} onValue={setSps} max={200} />
      <NumField label="Nails per shingle" value={nails} onValue={setNails} max={12} />
      <NumField label="Waste" value={waste} onValue={setWaste} suffix="%" max={50} />
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      <Gate tool="shingles">
        {res?.ok ? (
          <>
            <Answer testID="shingles-answer" label="Bundles" value={grouped(res.value.bundles)} lines={[`${num(res.value.squares, 2)} squares before waste`]} />
            <Figures rows={[
              ...(res.value.starterBundles ? [['Starter strip', `${res.value.starterBundles} bundle${res.value.starterBundles === 1 ? '' : 's'}`] as [string, string]] : []),
              ...(res.value.capBundles ? [['Hip & ridge', `${res.value.capBundles} bundle${res.value.capBundles === 1 ? '' : 's'}`] as [string, string]] : []),
              ['Nails', grouped(res.value.nails)],
            ]} />
            <Steps steps={res.steps} notes={res.notes} />
            <SaveToJob tool="shingles" title={`Shingles · ${sh?.name ?? 'custom'}`} lines={[`${res.value.bundles} bundles (${num(res.value.squares, 2)} squares + ${waste ?? 0}%)`, `${res.value.starterBundles} starter, ${res.value.capBundles} hip & ridge bundles`, `${res.value.nails} nails`]} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}
