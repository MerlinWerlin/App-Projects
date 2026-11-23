// Full system check: suction and liquid readings together, drawn on the cycle, read against the superheat /
// subcooling fault pattern. Likely causes to check, never a verdict.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { systemCheck } from '../src/core/diagnose.ts';
import { DELTA_LABEL, PRESSURE_LABEL, TEMP_LABEL, deltaFromK, deltaToK, fmt, parseNum, tempFromC } from '../src/core/units.ts';
import { usePrefs } from '../src/state/prefs.ts';
import { useSettings } from '../src/state/store.ts';
import { SPACE } from '../src/theme/tokens.ts';
import { CycleDiagram } from '../src/ui/CycleDiagram.tsx';
import { Gate } from '../src/ui/Gate.tsx';
import { Body, Button, Card, Checklist, Chip, Heading, Label, Notice, NumberField, Screen, Small, Working } from '../src/ui/kit.tsx';
import { RefrigerantButton } from '../src/ui/RefrigerantButton.tsx';
import { stashReading } from '../src/ui/saveStash.ts';

export default function CheckScreen() {
  const pr = usePrefs();
  const s = useSettings();
  return (
    <Screen tab={false}>
      <Gate what="the full system check">
        <Check key={`${pr.pressure}-${pr.temp}-${pr.gauge}-${s.refrigerant}`} />
      </Gate>
    </Screen>
  );
}

function Check() {
  const pr = usePrefs();
  const s = useSettings();
  const f = pr.temp === 'F';
  const psi = pr.pressure === 'psi';
  const bar = pr.pressure === 'bar';
  const [sp, setSp] = useState(psi ? '118' : bar ? '8.1' : pr.pressure === 'MPa' ? '0.81' : '810');
  const [st, setSt] = useState(f ? '50' : '10');
  const [lp, setLp] = useState(psi ? '340' : bar ? '24.0' : pr.pressure === 'MPa' ? '2.40' : '2400');
  const [lt, setLt] = useState(f ? '100' : '38');
  const [tsh, setTsh] = useState(f ? '11' : '6');
  const [tsc, setTsc] = useState(f ? '9' : '5');
  const du = DELTA_LABEL[pr.temp];
  const tu = TEMP_LABEL[pr.temp];
  const pu = PRESSURE_LABEL[pr.pressure];
  const r = systemCheck(
    { refrigerant: s.refrigerant, suctionReading: parseNum(sp), suctionLineTemp: parseNum(st), liquidReading: parseNum(lp), liquidLineTemp: parseNum(lt), targetShK: deltaToK(parseNum(tsh), pr.temp), targetScK: deltaToK(parseNum(tsc), pr.temp) },
    pr,
  );
  const T = (c: number) => `${fmt(tempFromC(c, pr.temp), 1)}${tu}`;
  const D = (k: number) => `${fmt(deltaFromK(k, pr.temp), 1)} ${du}`;
  const step = pr.pressure === 'kPa' ? 10 : psi ? 1 : 0.1;
  return (
    <>
      <RefrigerantButton />
      <Card tone="low">
        <Heading tone="low">Low side</Heading>
        <NumberField testID="check-sp" tone="low" label={`Suction pressure (${pr.gauge ? 'gauge' : 'abs'})`} value={sp} onChange={setSp} unit={pu} step={step} />
        <NumberField testID="check-st" tone="low" label="Suction line temperature" value={st} onChange={setSt} unit={tu} step={0.5} />
      </Card>
      <Card tone="high">
        <Heading tone="high">High side</Heading>
        <NumberField testID="check-lp" tone="high" label={`Liquid line pressure (${pr.gauge ? 'gauge' : 'abs'})`} value={lp} onChange={setLp} unit={pu} step={step} />
        <NumberField testID="check-lt" tone="high" label="Liquid line temperature" value={lt} onChange={setLt} unit={tu} step={0.5} />
      </Card>
      {r.ok ? (
        <Card>
          <CycleDiagram
            v={{
              evap: T(r.evapC), cond: T(r.condC),
              suctionLine: `${st}${tu}`, liquidLine: `${lt}${tu}`,
              suctionP: `${sp} ${pu}`, liquidP: `${lp} ${pu}`,
              sh: D(r.shK), sc: D(r.scK), shOk: r.shBand === 'ok', scOk: r.scBand === 'ok',
            }}
          />
          <View style={{ flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <Chip text={`Superheat ${r.shBand === 'ok' ? 'on target' : r.shBand}`} tone={r.shBand === 'ok' ? 'neutral' : 'low'} />
            <Chip text={`Subcooling ${r.scBand === 'ok' ? 'on target' : r.scBand}`} tone={r.scBand === 'ok' ? 'neutral' : 'high'} />
          </View>
          <Heading>{r.pattern.title}</Heading>
          <Label>{r.pattern.tone === 'ok' ? 'Still check' : 'Likely causes to check'}</Label>
          <Checklist items={r.pattern.causes} />
          {r.notes.map((n, i) => <Notice key={i} text={n} />)}
          <Small>The superheat / subcooling pattern for TXV and EEV systems. Fixed-orifice systems charge by superheat alone. Airflow, load and the manufacturer’s charging chart come first.</Small>
          <Working steps={r.steps} />
          <Button
            kind="secondary"
            icon="add-circle-outline"
            title="Save to a job"
            onPress={() => {
              stashReading({ kind: 'note', title: `System check ${s.refrigerant}`, result: `${r.pattern.title}: SH ${D(r.shK)}, SC ${D(r.scK)}`, steps: [{ label: 'Evaporating', value: T(r.evapC) }, { label: 'Condensing', value: T(r.condC) }, ...r.steps, ...r.pattern.causes.map((c, i) => ({ label: `Check ${i + 1}`, value: c }))] });
              router.push('/save');
            }}
          />
        </Card>
      ) : (
        <Card><Body dim>{r.error}</Body></Card>
      )}
      <Card>
        <Label>Targets</Label>
        <NumberField label="Target superheat" value={tsh} onChange={setTsh} unit={du} step={0.5} allowNegative={false} hint="TXV / EEV: often 5–8 K (9–14 °F) at the evaporator outlet; use the manufacturer’s figure." />
        <NumberField label="Target subcooling" value={tsc} onChange={setTsc} unit={du} step={0.5} allowNegative={false} hint="From the outdoor unit’s data plate." />
      </Card>
    </>
  );
}
