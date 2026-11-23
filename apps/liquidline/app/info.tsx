import { Text, View } from 'react-native';
import { glideAt, limits, satPressure } from '../src/core/pt.ts';
import { refrigerant, SAFETY_LABEL, safetyNote } from '../src/core/refrigerants.ts';
import { DELTA_LABEL, TEMP_LABEL, deltaFromK, fmt, tempFromC } from '../src/core/units.ts';
import { useCountry, usePrefs } from '../src/state/prefs.ts';
import { useSettings } from '../src/state/store.ts';
import { PT_TABLES } from '../src/data/ptTables.ts';
import { SPACE, usePalette } from '../src/theme/tokens.ts';
import { Body, Card, Label, Notice, Screen, Small } from '../src/ui/kit.tsx';
import { RefrigerantButton } from '../src/ui/RefrigerantButton.tsx';

function Fact({ k, v }: { k: string; v: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: p.line }}>
      <Text style={{ fontSize: 16, color: p.text2 }}>{k}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: p.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

export default function InfoScreen() {
  const s = useSettings();
  const c = useCountry();
  const pr = usePrefs();
  const r = refrigerant(s.refrigerant);
  const t = PT_TABLES[s.refrigerant];
  const lim = limits(s.refrigerant);
  if (!r || !t || !lim) return <Screen tab={false}><Small>No data.</Small></Screen>;
  const g0 = glideAt(s.refrigerant, satPressure(s.refrigerant, 0, 'dew') ?? NaN);
  const note = safetyNote(r.id, c.flammableStandard);
  return (
    <Screen tab={false}>
      <RefrigerantButton showNote={false} />
      <Card>
        <Fact k="Safety class" v={SAFETY_LABEL[r.safety]} />
        <Fact k="GWP (AR4, 100-yr)" v={String(r.gwp)} />
        <Fact k="ODP" v={String(r.odp)} />
        <Fact k="Type" v={r.kind === 'pure' ? 'Single component' : r.kind} />
        {r.composition ? <Fact k="Composition (mass %)" v={r.composition} /> : null}
        {g0 != null ? <Fact k={pr.temp === "F" ? "Glide at 32 °F (dew)" : "Glide at 0 °C (dew)"} v={`${fmt(deltaFromK(g0, pr.temp), 1)} ${DELTA_LABEL[pr.temp]}`} /> : null}
        {t.tCrit != null ? <Fact k="Critical temperature" v={`${fmt(tempFromC(t.tCrit, pr.temp), 1)} ${TEMP_LABEL[pr.temp]}`} /> : null}
        <Fact k="Table range" v={`${fmt(tempFromC(lim.tMin, pr.temp), 0)} to ${fmt(tempFromC(lim.tMax, pr.temp), 0)} ${TEMP_LABEL[pr.temp]}`} />
      </Card>
      <Card>
        <Label>Used in</Label>
        <Body>{r.uses}</Body>
        {r.kind === 'zeotrope' ? <Small>Zeotropic blend: charge as liquid, use the dew point for superheat and the bubble point for subcooling. A leak can shift the composition: recover and recharge rather than topping up large losses.</Small> : null}
        {r.id === 'R744' ? <Small>Above 31 °C CO₂ runs transcritical: there is no condensing temperature, so subcooling doesn’t apply on the gas cooler side.</Small> : null}
      </Card>
      {note ? <Notice text={note} /> : null}
      <Small>{`Saturation data: ${t.source}. GWP: IPCC AR4. Safety class: ASHRAE 34 / ISO 817.`}</Small>
    </Screen>
  );
}
