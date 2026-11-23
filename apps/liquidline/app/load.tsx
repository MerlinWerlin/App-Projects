import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { estimateLoad, nextSizeBtu, nextSizeKw, type Insulation, type Sun } from '../src/core/load.ts';
import { fmt, parseNum, wToBtuh } from '../src/core/units.ts';
import { useCountry } from '../src/state/prefs.ts';
import { usePalette } from '../src/theme/tokens.ts';
import { Body, Button, Card, Label, Notice, NumberField, Readout, Screen, Segmented, Small, Working } from '../src/ui/kit.tsx';
import { Gate } from '../src/ui/Gate.tsx';
import { stashReading } from '../src/ui/saveStash.ts';

export default function LoadScreen() {
  return (
    <Screen tab={false}>
      <Notice kind="info" text="A rough estimate for quoting and sanity checks, not a heat-load calculation. Glass, orientation, air leakage and local climate data change the answer." />
      <Gate what="the room load estimate">
        <Load />
      </Gate>
    </Screen>
  );
}

function Load() {
  const p = usePalette();
  const c = useCountry();
  const imperial = c.units.length === 'ft';
  const [area, setArea] = useState(imperial ? '250' : '25');
  const [height, setHeight] = useState(imperial ? '8' : '2.4');
  const [insulation, setInsulation] = useState<Insulation>('average');
  const [sun, setSun] = useState<Sun>('some');
  const [coolClimate, setCool] = useState<'mild' | 'warm' | 'hot'>('warm');
  const [heatClimate, setHeat] = useState<'mild' | 'cool' | 'cold'>('cool');
  const [people, setPeople] = useState('2');
  const [extra, setExtra] = useState('0');
  const [glass, setGlass] = useState(false);
  const [roof, setRoof] = useState(false);
  const areaM2 = imperial ? parseNum(area) * 0.09290304 : parseNum(area);
  const heightM = imperial ? parseNum(height) * 0.3048 : parseNum(height);
  const r = estimateLoad({ areaM2, heightM, insulation, sun, coolClimate, heatClimate, people: parseNum(people), extraW: parseNum(extra), bigGlass: glass, topFloorOrUnderRoof: roof });
  const show = (w: number) => (imperial ? `${Math.round(wToBtuh(w) / 100) * 100}` : fmt(w / 1000, 1));
  const unit = imperial ? 'BTU/h' : 'kW';
  const westGlass = c.code === 'US' || c.code === 'CA' || c.code === 'GB' || c.code === 'IE' ? 'west or south' : 'west or north';
  return (
    <>
      <Card>
        <NumberField label="Floor area" value={area} onChange={setArea} unit={imperial ? 'ft²' : 'm²'} step={imperial ? 10 : 1} allowNegative={false} />
        <NumberField label="Ceiling height" value={height} onChange={setHeight} unit={imperial ? 'ft' : 'm'} step={imperial ? 0.5 : 0.1} allowNegative={false} />
        <Label>Insulation</Label>
        <Segmented label="Insulation" value={insulation} onChange={setInsulation} options={[{ value: 'good', label: 'Good' }, { value: 'average', label: 'Average' }, { value: 'poor', label: 'Poor' }]} />
        <Label>Sun on walls and windows</Label>
        <Segmented label="Sun" value={sun} onChange={setSun} options={[{ value: 'shaded', label: 'Shaded' }, { value: 'some', label: 'Some' }, { value: 'full', label: 'Full sun' }]} />
        <Label tone="high">Summer</Label>
        <Segmented label="Summer climate" tone="high" value={coolClimate} onChange={setCool} options={[{ value: 'mild', label: 'Mild' }, { value: 'warm', label: 'Warm' }, { value: 'hot', label: 'Hot' }]} />
        <Label tone="low">Winter</Label>
        <Segmented label="Winter climate" tone="low" value={heatClimate} onChange={setHeat} options={[{ value: 'mild', label: 'Mild' }, { value: 'cool', label: 'Cool' }, { value: 'cold', label: 'Cold' }]} />
        <NumberField label="People usually in the room" value={people} onChange={setPeople} step={1} allowNegative={false} />
        <NumberField label="Extra heat from equipment" value={extra} onChange={setExtra} unit="W" step={100} allowNegative={false} hint="Kitchen appliances, computers, servers, gym gear." />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
          <View style={{ flex: 1 }}><Body>{`Large ${westGlass}-facing glass`}</Body></View>
          <Switch accessibilityLabel="Large sun-facing glass" value={glass} onValueChange={setGlass} trackColor={{ true: p.high, false: p.line }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
          <View style={{ flex: 1 }}><Body>Top floor or directly under the roof</Body></View>
          <Switch accessibilityLabel="Under the roof" value={roof} onValueChange={setRoof} trackColor={{ true: p.high, false: p.line }} />
        </View>
      </Card>
      <Card>
        {'error' in r ? <Small>{r.error}</Small> : (
          <>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1 }}><Readout testID="load-cool" label="Cooling" value={show(r.coolW)} unit={unit} tone="high" size="mid" /></View>
              <View style={{ flex: 1 }}><Readout testID="load-heat" label="Heating" value={show(r.heatW)} unit={unit} tone="low" size="mid" /></View>
            </View>
            {(() => {
              const w = Math.max(r.coolW, r.heatW);
              const size = imperial ? nextSizeBtu(w) : nextSizeKw(w);
              return size ? <Body dim>{`Nearest common size up: ${imperial ? `${size / 1000}k BTU/h` : `${size} kW`}. Check the heating capacity at your winter design temperature.`}</Body> : <Small>Bigger than a typical single split: do a full load calculation.</Small>;
            })()}
            <Label>Cooling working</Label>
            <Working steps={r.coolSteps} />
            <Label>Heating working</Label>
            <Working steps={r.heatSteps} />
            <Button kind="secondary" icon="add-circle-outline" title="Save to a job" onPress={() => { stashReading({ kind: 'load', title: 'Room load (rough)', result: `cool ${show(r.coolW)} / heat ${show(r.heatW)} ${unit}`, steps: [...r.coolSteps, ...r.heatSteps] }); router.push('/save'); }} />
          </>
        )}
      </Card>
    </>
  );
}
