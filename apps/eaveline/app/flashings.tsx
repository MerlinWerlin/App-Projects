/** Flashings, cappings and trims from the roof: each run in pieces of a stock length. */
import { useState } from 'react';
import { trimRuns, trims } from '../src/core/flashing';
import { roofGeometry } from '../src/core/geometry';
import { grouped } from '../src/core/units';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, ErrorLine, Figures, LengthField, NumField, Picker, Screen, Section, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';

export default function Flashings() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const [stockId, setStockId] = useState(String(country.defaults.trimStockMm));
  const [customStock, setCustomStock] = useState<number | null>(country.defaults.trimStockMm);
  const [lap, setLap] = useState<number | null>(country.defaults.trimLapMm);
  const [valleyLen, setValleyLen] = useState<number | null>(null);
  const [valleys, setValleys] = useState<number | null>(0);
  const [apron, setApron] = useState<number | null>(null);
  const [waste, setWaste] = useState<number | null>(0);
  const stock = stockId === 'custom' ? customStock : Number(stockId);
  const g = roofReady(roof) ? roofGeometry(roof, ctx) : null;
  const runs = g?.ok ? trimRuns(g.value, ctx, { valleyMm: valleyLen ?? 0, valleys: valleys ?? 0, apronMm: apron ?? 0 }) : [];
  const res = g?.ok && stock ? trims({ runs, stockMm: stock, lapMm: lap ?? 0, wastePct: waste ?? 0 }, ctx) : null;
  const choices = [...new Set([...country.trimStockMm, country.defaults.trimStockMm])].sort((a, b) => a - b).map(mm => ({ id: String(mm), title: ctx.len(mm) }));
  return (
    <Screen>
      <RoofCard />
      <Picker label="Stock length" value={stockId} onPick={setStockId} choices={choices} customLabel="Other length" />
      {stockId === 'custom' ? <LengthField label="Stock length" mm={customStock} onMm={setCustomStock} /> : null}
      <LengthField label="Lap where pieces join" mm={lap} onMm={setLap} size="short" />
      <Section title={`${cap(ctx.terms.valley)}s and walls (optional)`}>
        <LengthField label={`${cap(ctx.terms.valley)} length (each)`} mm={valleyLen} onMm={setValleyLen} hint="Use Rafters & hips for a true valley length." />
        <NumField label={`Number of ${ctx.terms.valley}s`} value={valleys} onValue={setValleys} max={50} />
        <LengthField label="Apron / wall flashing (total)" mm={apron} onMm={setApron} />
      </Section>
      <NumField label="Spare pieces" value={waste} onValue={setWaste} suffix="%" max={50} />
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      <Gate tool="flashings">
        {res?.ok ? (
          <>
            <Answer testID="flashings-answer" label="Pieces to order" value={grouped(res.value.pieces)} lines={[`${ctx.run(res.value.totalMm)} of flashing and trim`]} />
            <Figures rows={res.value.lines.map(l => [`${l.label}${l.runs > 1 ? ` (${l.runs})` : ''}`, `${ctx.run(l.totalMm)} · ${l.pieces} pcs`])} />
            <Steps steps={res.steps} notes={res.notes} />
            <SaveToJob tool="flashings" title="Flashings & cappings" lines={res.value.lines.map(l => `${l.label}: ${ctx.run(l.totalMm)}, ${l.pieces} × ${ctx.len(stock!)}`)} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
