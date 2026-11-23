// Charge: superheat (low side, blue), subcooling (high side, red) and additional charge for long line sets.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { additionalCharge, fixedOrificeTargetK, subcooling, superheat, type Reading } from '../../src/core/charge.ts';
import { chargeDefault } from '../../src/core/countries.ts';
import {
  DELTA_LABEL, LENGTH_LABEL, MASS_LABEL, PRESSURE_LABEL, RATE_LABEL, TEMP_LABEL, deltaFromK, deltaToK, fmt, lengthFromM, lengthToM,
  massFromG, parseNum, rateFromGPerM, rateToGPerM, tempToC,
} from '../../src/core/units.ts';
import { useCountry, usePrefs } from '../../src/state/prefs.ts';
import { useSettings } from '../../src/state/store.ts';
import { Gate } from '../../src/ui/Gate.tsx';
import { Body, Button, Card, Chip, Label, Notice, NumberField, Readout, Screen, Segmented, Small, Working, type Tone } from '../../src/ui/kit.tsx';
import { RefrigerantButton } from '../../src/ui/RefrigerantButton.tsx';
import { stashReading } from '../../src/ui/saveStash.ts';
import { SettingsButton } from './index.tsx';

type Mode = 'sh' | 'sc' | 'extra';

/** The published default rates (R32 / R410A ductless, R410A / R454B ducted) only apply to these refrigerants. */
const RATE_COVERS = ['R32', 'R410A', 'R454B'];

export default function ChargeScreen() {
  const [mode, setMode] = useState<Mode>('sh');
  const pr = usePrefs();
  const st = useSettings();
  const k = `${pr.pressure}-${pr.temp}-${pr.length}-${pr.mass}-${st.country}-${pr.gauge}-${Math.round(pr.atmKpa * 10)}-${st.refrigerant}`;
  return (
    <Screen title="Charge" subtitle="Superheat, subcooling and extra refrigerant" right={<SettingsButton />}>
      <Segmented
        label="Calculation"
        value={mode}
        onChange={setMode}
        tone={mode === 'sh' ? 'low' : mode === 'sc' ? 'high' : 'neutral'}
        options={[
          { value: 'sh', label: 'Superheat' },
          { value: 'sc', label: 'Subcooling' },
          { value: 'extra', label: 'Extra charge' },
        ]}
      />
      <Gate what="the charging calculators">
        {mode === 'sh' ? <Superheat key={k} /> : mode === 'sc' ? <Subcooling key={k} /> : <Extra key={k} />}
      </Gate>
    </Screen>
  );
}

function verdictChip(r: Reading, tone: Tone) {
  if (!r.ok || !r.verdict) return null;
  const map = { ok: 'On target', low: 'Below target', high: 'Above target', warn: 'Check the reading' } as const;
  return <Chip text={map[r.verdict]} tone={r.verdict === 'ok' ? tone : 'warn'} />;
}

function SaveButton({ onPress }: { onPress: () => void }) {
  return <Button kind="secondary" icon="add-circle-outline" title="Save to a job" onPress={onPress} />;
}

function Superheat() {
  const pr = usePrefs();
  const s = useSettings();
  const [p, setP] = useState(pr.pressure === 'psi' ? '120' : pr.pressure === 'bar' ? '8.5' : pr.pressure === 'MPa' ? '0.85' : '850');
  const [t, setT] = useState(pr.temp === 'F' ? '50' : '10');
  const [targetMode, setTargetMode] = useState<'none' | 'manual' | 'orifice'>('none');
  const [target, setTarget] = useState(pr.temp === 'F' ? '10' : '5');
  const [wb, setWb] = useState(pr.temp === 'F' ? '63' : '17');
  const [db, setDb] = useState(pr.temp === 'F' ? '90' : '32');
  const orificeK = useMemo(() => fixedOrificeTargetK(tempToC(parseNum(wb), pr.temp), tempToC(parseNum(db), pr.temp)), [wb, db, pr.temp]);
  const targetK = targetMode === 'manual' ? deltaToK(parseNum(target), pr.temp) : targetMode === 'orifice' ? orificeK : null;
  const r = superheat(s.refrigerant, parseNum(p), parseNum(t), pr, targetK != null && Number.isFinite(targetK) ? targetK : null);
  const du = DELTA_LABEL[pr.temp];
  return (
    <>
      <RefrigerantButton />
      <Card tone="low">
        <NumberField testID="sh-pressure" tone="low" label={`Suction pressure (${pr.gauge ? 'gauge' : 'abs'})`} value={p} onChange={setP} unit={PRESSURE_LABEL[pr.pressure]} step={pr.pressure === 'kPa' ? 10 : pr.pressure === 'psi' ? 1 : 0.1} />
        <NumberField testID="sh-temp" tone="low" label="Suction line temperature" value={t} onChange={setT} unit={TEMP_LABEL[pr.temp]} step={0.5} hint="Clamp the probe on clean copper, insulated, about 15 cm (6 in) from the service valve." />
      </Card>
      <Card tone="low">
        {r.ok ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Readout testID="sh-result" label="Superheat" value={fmt(deltaFromK(r.valueK, pr.temp), 1)} unit={du} tone="low" />
              {verdictChip(r, 'low')}
            </View>
            {r.note ? <Notice text={r.note} /> : null}
            <Working steps={r.steps} initiallyOpen />
            <SaveButton onPress={() => { stashReading({ kind: 'superheat', title: `Superheat ${s.refrigerant}`, result: `${fmt(deltaFromK(r.valueK, pr.temp), 1)} ${du}`, steps: r.steps }); router.push('/save'); }} />
          </>
        ) : (
          <Small>{r.error}</Small>
        )}
      </Card>
      <Card>
        <Label>Target superheat</Label>
        <Segmented
          label="Target"
          value={targetMode}
          onChange={setTargetMode}
          options={[
            { value: 'none', label: 'None' },
            { value: 'manual', label: 'Enter' },
            { value: 'orifice', label: 'Orifice' },
          ]}
        />
        {targetMode === 'manual' ? <NumberField label="Target superheat" value={target} onChange={setTarget} unit={du} step={0.5} allowNegative={false} hint="From the unit’s data plate or manual. TXV / EEV systems are usually set by subcooling." /> : null}
        {targetMode === 'orifice' ? (
          <>
            <NumberField label="Indoor wet bulb (return air)" value={wb} onChange={setWb} unit={TEMP_LABEL[pr.temp]} step={0.5} />
            <NumberField label="Outdoor dry bulb" value={db} onChange={setDb} unit={TEMP_LABEL[pr.temp]} step={0.5} />
            <Small>{orificeK == null ? 'Outside the range charging charts cover, or too low to charge by superheat: use the manufacturer’s method.' : `Rule of thumb: fixed-orifice target ≈ ${fmt(deltaFromK(orificeK, pr.temp), 1)} ${du}, from common charging charts. The unit’s own chart wins.`}</Small>
          </>
        ) : null}
      </Card>
    </>
  );
}

function Subcooling() {
  const pr = usePrefs();
  const s = useSettings();
  const [p, setP] = useState(pr.pressure === 'psi' ? '340' : pr.pressure === 'bar' ? '24' : pr.pressure === 'MPa' ? '2.4' : '2400');
  const [t, setT] = useState(pr.temp === 'F' ? '95' : '35');
  const [target, setTarget] = useState('');
  const du = DELTA_LABEL[pr.temp];
  const tk = parseNum(target);
  const r = subcooling(s.refrigerant, parseNum(p), parseNum(t), pr, Number.isFinite(tk) ? deltaToK(tk, pr.temp) : null);
  return (
    <>
      <RefrigerantButton />
      <Card tone="high">
        <NumberField testID="sc-pressure" tone="high" label={`Liquid line pressure (${pr.gauge ? 'gauge' : 'abs'})`} value={p} onChange={setP} unit={PRESSURE_LABEL[pr.pressure]} step={pr.pressure === 'kPa' ? 10 : pr.pressure === 'psi' ? 1 : 0.1} />
        <NumberField testID="sc-temp" tone="high" label="Liquid line temperature" value={t} onChange={setT} unit={TEMP_LABEL[pr.temp]} step={0.5} hint="Measure near the liquid service valve, insulated from ambient air." />
        <NumberField label="Target subcooling (optional)" value={target} onChange={setTarget} unit={du} step={0.5} allowNegative={false} hint="Usually printed on the outdoor unit’s data plate or in the manual." />
      </Card>
      <Card tone="high">
        {r.ok ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Readout testID="sc-result" label="Subcooling" value={fmt(deltaFromK(r.valueK, pr.temp), 1)} unit={du} tone="high" />
              {verdictChip(r, 'high')}
            </View>
            {r.note ? <Notice text={r.note} /> : null}
            <Working steps={r.steps} initiallyOpen />
            <SaveButton onPress={() => { stashReading({ kind: 'subcooling', title: `Subcooling ${s.refrigerant}`, result: `${fmt(deltaFromK(r.valueK, pr.temp), 1)} ${du}`, steps: r.steps }); router.push('/save'); }} />
          </>
        ) : (
          <Small>{r.error}</Small>
        )}
      </Card>
    </>
  );
}

function Extra() {
  const pr = usePrefs();
  const s = useSettings();
  const c = useCountry();
  const [liquid, setLiquid] = useState<'1/4"' | '3/8"'>('1/4"');
  const d = chargeDefault(c, liquid);
  const covered = RATE_COVERS.includes(s.refrigerant);
  const L = (m: number) => fmt(lengthFromM(m, pr.length), pr.length === 'ft' ? 0 : 1);
  const R = (g: number) => fmt(rateFromGPerM(g, pr.mass), pr.mass === 'oz' ? 2 : 0);
  const [len, setLen] = useState(L(15));
  const [pre, setPre] = useState(L(d.prechargedM));
  const [rate, setRate] = useState(covered ? R(d.gPerM) : '');
  const [price, setPrice] = useState('');
  const pickLiquid = (v: '1/4"' | '3/8"') => {
    setLiquid(v);
    const nd = chargeDefault(c, v);
    setPre(L(nd.prechargedM));
    setRate(covered ? R(nd.gPerM) : '');
  };
  const r = additionalCharge(lengthToM(parseNum(len), pr.length), lengthToM(parseNum(pre), pr.length), rateToGPerM(parseNum(rate), pr.mass), null, { length: pr.length, mass: pr.mass });
  const priceN = parseNum(price);
  const perKg = pr.mass === 'oz' ? 'lb' : 'kg';
  const cost = r.ok && Number.isFinite(priceN) ? (pr.mass === 'oz' ? (r.extraG / 453.59237) * priceN : (r.extraG / 1000) * priceN) : null;
  const massOut = r.ok ? (pr.mass === 'oz' ? `${fmt(massFromG(r.extraG, 'oz'), 1)}` : fmt(r.extraG, 0)) : '–';
  return (
    <>
      <Card>
        <Label>Liquid line size</Label>
        <Segmented label="Liquid line" value={liquid} onChange={pickLiquid} options={[{ value: '1/4"', label: '1/4" liquid' }, { value: '3/8"', label: '3/8" liquid' }]} />
        <NumberField testID="extra-length" label="Line set length (one way)" value={len} onChange={setLen} unit={LENGTH_LABEL[pr.length]} step={pr.length === 'ft' ? 5 : 1} allowNegative={false} />
        <NumberField testID="extra-pre" label="Factory pre-charged for" value={pre} onChange={setPre} unit={LENGTH_LABEL[pr.length]} step={pr.length === 'ft' ? 5 : 0.5} allowNegative={false} />
        <NumberField testID="extra-rate" label="Additional charge rate" value={rate} onChange={setRate} unit={RATE_LABEL[pr.mass]} step={pr.mass === 'oz' ? 0.05 : 1} allowNegative={false} />
        <Small>{covered ? d.note : `No typical rate for ${s.refrigerant}: enter the rate from the unit’s nameplate or manual.`}</Small>
        {c.currency.code ? (
          <NumberField label={`Refrigerant price per ${perKg} (optional)`} value={price} onChange={setPrice} unit={`${c.currency.symbol} ${c.currency.code}`} step={1} allowNegative={false} />
        ) : null}
      </Card>
      <Card>
        {r.ok ? (
          <>
            <Readout testID="extra-result" label={`Add ${s.refrigerant}`} value={massOut} unit={MASS_LABEL[pr.mass]} />
            {cost != null ? <Body dim>{`Refrigerant cost ≈ ${c.currency.symbol}${cost.toFixed(2)} ${c.currency.code}`}</Body> : null}
            {r.note ? <Notice text={r.note} kind="info" /> : null}
            <Working steps={r.steps} initiallyOpen />
            <Small>Weigh it in by liquid (zeotropic blends must be charged as liquid). Use the unit’s nameplate rate if it differs.</Small>
            <SaveButton onPress={() => { stashReading({ kind: 'extra-charge', title: `Extra charge ${s.refrigerant}`, result: `${massOut} ${MASS_LABEL[pr.mass]}`, steps: r.steps }); router.push('/save'); }} />
          </>
        ) : (
          <Small>{r.error}</Small>
        )}
      </Card>
    </>
  );
}
