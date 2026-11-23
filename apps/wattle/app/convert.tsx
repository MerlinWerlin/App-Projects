/** Quick converter. Free for everyone. */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { QUANTITIES, ampsToKva, awgAreaMm2, awgLabel, convert, kvaToAmps, mm2ToAwg, type QuantityId } from '../src/core/convert.ts';
import { fmt, fmtSig, parseNum } from '../src/core/num.ts';
import { SPACE } from '../src/theme/theme.ts';
import { Card, FieldRow, NumField, Picks, Result, Screen, SectionLabel, Segmented, Toggle, Txt } from '../src/ui/kit.tsx';

type Tab = 'awg' | QuantityId | 'kva';

export default function Convert() {
  const [tab, setTab] = useState<Tab>('awg');
  return (
    <Screen pushed title="Convert" sub="Quick trade conversions">
      <Segmented label="Conversion" value={tab} onChange={setTab} options={[{ id: 'awg', label: 'mm² ↔ AWG' }, { id: 'kva', label: 'kVA ↔ A' }, ...QUANTITIES.map(q => ({ id: q.id, label: q.label }))]} />
      {tab === 'awg' ? <Awg /> : tab === 'kva' ? <Kva /> : <Units q={tab} />}
    </Screen>
  );
}

function Awg() {
  const [mm, setMm] = useState('2.5');
  const [awg, setAwg] = useState('');
  const r = useMemo(() => mm2ToAwg(parseNum(mm)), [mm]);
  const a = parseNum(awg);
  const awgOk = a != null && Number.isInteger(a) && a >= -3 && a <= 40;
  return (
    <>
      <NumField label="Metric size" value={mm} onChange={setMm} unit="mm²" />
      <Picks values={[1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]} current={mm} onPick={setMm} />
      <Result error={r.ok ? null : r.error} answers={r.ok ? [{ label: 'Nearest AWG', value: `${r.value.nearestLabel} AWG` }, { label: 'That AWG is', value: `${fmt(r.value.nearestArea, 2)} mm²` }] : []} steps={r.ok ? r.steps : []} warnings={r.ok ? r.warnings : []} />
      <SectionLabel>AWG to mm²</SectionLabel>
      <NumField label="AWG number" value={awg} onChange={setAwg} hint="For 1/0 enter 0, 2/0 enter −1, 3/0 enter −2, 4/0 enter −3." placeholder="12" />
      {awg.trim() ? (
        <Card>
          <Txt v="answerSm">{awgOk ? `${awgLabel(a)} AWG = ${fmt(awgAreaMm2(a), 3)} mm²` : 'Enter a whole AWG number from −3 (4/0) to 40.'}</Txt>
        </Card>
      ) : null}
      <Txt v="footnote" tone="ink2">AWG from ASTM B258. Nearest size by area only: Australian cables are rated in mm², so check ratings in AS/NZS 3008.</Txt>
    </>
  );
}

function Kva() {
  const [phase, setPhase] = useState<'single' | 'three'>('three');
  const [v, setV] = useState('400');
  const [kva, setKva] = useState('');
  const [amps, setAmps] = useState('');
  const V = parseNum(v);
  const k = parseNum(kva);
  const A = parseNum(amps);
  return (
    <>
      <Toggle label="Supply" value={phase} onChange={p => { setPhase(p); setV(p === 'three' ? '400' : '230'); }} options={[{ id: 'single', label: 'Single-phase' }, { id: 'three', label: 'Three-phase' }]} />
      <NumField label={phase === 'three' ? 'Line voltage' : 'Voltage'} value={v} onChange={setV} unit="V" />
      <FieldRow>
        <NumField label="kVA" value={kva} onChange={setKva} unit="kVA" />
        <NumField label="Amps" value={amps} onChange={setAmps} unit="A" />
      </FieldRow>
      <Card style={{ gap: SPACE.xs }}>
        {V && V > 0 && k && k > 0 ? <Txt v="answerSm">{fmtSig(k)} kVA = {fmtSig(kvaToAmps(k, V, phase))} A</Txt> : null}
        {V && V > 0 && A && A > 0 ? <Txt v="answerSm">{fmtSig(A)} A = {fmtSig(ampsToKva(A, V, phase))} kVA</Txt> : null}
        {!(V && V > 0) || (!(k && k > 0) && !(A && A > 0)) ? <Txt v="callout" tone="ink2">Enter kVA or amps.</Txt> : null}
        <Txt v="footnote" tone="ink2">{phase === 'three' ? 'I = S ÷ (√3 × V)' : 'I = S ÷ V'}</Txt>
      </Card>
    </>
  );
}

function Units({ q }: { q: QuantityId }) {
  const quantity = QUANTITIES.find(x => x.id === q)!;
  const [from, setFrom] = useState(quantity.units[0]!.id);
  const [val, setVal] = useState('1');
  const fromId = quantity.units.some(u => u.id === from) ? from : quantity.units[0]!.id;
  const fromUnit = quantity.units.find(u => u.id === fromId)!;
  const x = parseNum(val);
  return (
    <>
      <Segmented label="From unit" value={fromId} onChange={setFrom} options={quantity.units.map(u => ({ id: u.id, label: u.label }))} />
      <NumField label={`Value in ${fromUnit.label}`} value={val} onChange={setVal} unit={fromUnit.label} />
      <Card style={{ gap: SPACE.sm }}>
        {quantity.units.filter(u => u.id !== fromId).map(u => {
          const out = convert(q, fromId, u.id, x);
          return (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACE.xs }}>
              <Txt v="answerSm" selectable>{out == null ? '–' : fmtSig(out, 5)}</Txt>
              <Txt v="headline" tone="ink2">{u.label}</Txt>
            </View>
          );
        })}
        {x != null && convert(q, fromId, quantity.units[1]!.id === fromId ? quantity.units[0]!.id : quantity.units[1]!.id, x) == null ? <Txt v="footnote" tone="fail">That value can’t be converted (below zero or absolute zero).</Txt> : null}
      </Card>
    </>
  );
}
