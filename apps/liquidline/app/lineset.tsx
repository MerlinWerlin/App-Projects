// Line set & pipe: typical pipe pair for a capacity, then how much pair coil / line set to buy from the lengths
// stocked in the person's country (or a custom coil length).
import { useState } from 'react';
import { View } from 'react-native';
import { typicalPair } from '../src/core/flare.ts';
import { neededLength, planCoils } from '../src/core/lineset.ts';
import { btuhToW, fmt, parseNum } from '../src/core/units.ts';
import { useCountry } from '../src/state/prefs.ts';
import { Body, Card, Chip, Label, Notice, NumberField, Readout, Screen, Segmented, Small, Working } from '../src/ui/kit.tsx';
import { Gate } from '../src/ui/Gate.tsx';

export default function LineSetScreen() {
  return (
    <Screen tab={false}>
      <Gate what="the line set planner">
        <LineSet />
      </Gate>
    </Screen>
  );
}

function LineSet() {
  const c = useCountry();
  const cat = c.lineSets;
  const u = cat.unit;
  const [capUnit, setCapUnit] = useState<'kW' | 'BTU'>(c.units.temp === 'F' ? 'BTU' : 'kW');
  const [cap, setCap] = useState(c.units.temp === 'F' ? '12000' : '3.5');
  const [route, setRoute] = useState(u === 'ft' ? '30' : '8');
  const [perEnd, setPerEnd] = useState(u === 'ft' ? '2' : '0.5');
  const [pct, setPct] = useState('10');
  const [source, setSource] = useState<'stock' | 'custom'>('stock');
  const [custom, setCustom] = useState(u === 'ft' ? '50' : '15');
  const kw = capUnit === 'kW' ? parseNum(cap) : btuhToW(parseNum(cap)) / 1000;
  const pair = typicalPair(kw);
  const stocked = pair ? cat.pairs.some((x) => x.liquid === pair.liquid && x.suction === pair.suction) : false;
  const need = neededLength(parseNum(route), parseNum(perEnd), parseNum(pct));
  const lengths = source === 'stock' ? cat.lengths : [parseNum(custom)].filter((x) => x > 0);
  const plan = planCoils(need, lengths, u);
  return (
    <>
      <Card>
        <Label>System capacity (cooling)</Label>
        <Segmented label="Capacity unit" value={capUnit} onChange={setCapUnit} options={[{ value: 'kW', label: 'kW' }, { value: 'BTU', label: 'BTU/h' }]} />
        <NumberField label="Nominal capacity" value={cap} onChange={setCap} unit={capUnit === 'kW' ? 'kW' : 'BTU/h'} step={capUnit === 'kW' ? 0.5 : 3000} allowNegative={false} />
        {pair ? (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}><Readout label="Liquid" value={pair.liquid} tone="high" size="mid" /></View>
            <View style={{ flex: 1 }}><Readout label="Suction" value={pair.suction} tone="low" size="mid" /></View>
          </View>
        ) : (
          <Small>Enter a capacity up to 16 kW (about 54 000 BTU/h). Larger systems: size from the manufacturer’s tables.</Small>
        )}
        <Small>{`Typical single-split sizes for R32 / R410A. Always use the sizes on the unit’s service valves and in its manual; long runs and big lifts may need different pipe.${kw > 0 ? ` (${fmt(kw, 2)} kW)` : ''}`}</Small>
        {pair && !stocked ? <Notice kind="info" text={`${pair.liquid} × ${pair.suction} isn’t a common ${c.lineSetWord} in ${c.name}: use straight lengths or single coils.`} /> : null}
      </Card>
      <Card>
        <Label>{`How much ${c.lineSetWord}`}</Label>
        <NumberField label="Route length (one way)" value={route} onChange={setRoute} unit={u} step={u === 'ft' ? 5 : 1} allowNegative={false} />
        <NumberField label="Allowance at each end" value={perEnd} onChange={setPerEnd} unit={u} step={u === 'ft' ? 1 : 0.25} allowNegative={false} hint="Service loop, flaring and the bends into each unit." />
        <NumberField label="Extra for the route" value={pct} onChange={setPct} unit="%" step={5} allowNegative={false} />
        <Segmented label="Coil lengths" value={source} onChange={setSource} options={[{ value: 'stock', label: `Stocked in ${c.code === 'OTHER' ? 'general' : c.name}` }, { value: 'custom', label: 'Custom length' }]} />
        {source === 'custom' ? <NumberField label="Your coil length" value={custom} onChange={setCustom} unit={u} step={u === 'ft' ? 5 : 1} allowNegative={false} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cat.lengths.map((l) => <Chip key={l} text={`${l} ${u}`} />)}
            {cat.precharged?.length ? <Chip text={`Pre-charged sets: ${cat.precharged.join(', ')} ${u}`} tone="low" /> : null}
          </View>
        )}
        {plan ? (
          <>
            <Readout label="Buy" value={plan.coils.length === 1 ? `${plan.coils[0]}` : plan.coils.join(' + ')} unit={u} />
            <Working steps={plan.steps} initiallyOpen />
            {plan.joins ? <Notice text="Longer than one coil: plan the join (brazed with nitrogen purge, or a fitting approved for the refrigerant and pressure) where it can be leak-tested and reached." /> : null}
          </>
        ) : <Small>Enter the route length.</Small>}
      </Card>
      <Card>
        <Label>{`Stocked in ${c.name}`}</Label>
        <Body>{cat.pairs.map((x) => `${x.liquid} × ${x.suction}`).join('   ·   ')}</Body>
        <Small>{`Insulation: ${cat.insulation.join(', ')}. ${cat.note}${cat.checked ? '' : ' Check with your wholesaler: these sizes weren’t all confirmed for your country.'}`}</Small>
      </Card>
    </>
  );
}
