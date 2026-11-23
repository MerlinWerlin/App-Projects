// A PT chart for the selected refrigerant, every 1, 2 or 5 degrees, in the person's units (gauge or absolute).
import { useState } from 'react';
import { Text, View } from 'react-native';
import { hasGlide, satPressure } from '../src/core/pt.ts';
import { fmt, PRESSURE_LABEL, TEMP_LABEL, pressureDecimals, pressureFromKpa, tempFromC, tempToC } from '../src/core/units.ts';
import { usePrefs } from '../src/state/prefs.ts';
import { useSettings } from '../src/state/store.ts';
import { FONT, SPACE, usePalette } from '../src/theme/tokens.ts';
import { Card, Screen, Segmented, Small } from '../src/ui/kit.tsx';
import { RefrigerantButton } from '../src/ui/RefrigerantButton.tsx';
import { PT_TABLES } from '../src/data/ptTables.ts';

export default function ChartScreen() {
  const p = usePalette();
  const s = useSettings();
  const pr = usePrefs();
  const [step, setStep] = useState<'1' | '2' | '5'>('5');
  const id = s.refrigerant;
  const glide = hasGlide(id);
  const t = PT_TABLES[id];
  const rows: { tU: number; bubble: number; dew: number }[] = [];
  if (t) {
    const n = Number(step);
    const lo = Math.ceil(tempFromC(t.tMin, pr.temp) / n) * n;
    for (let tu = lo; tempToC(tu, pr.temp) <= t.tMax + 1e-9; tu += n) {
      const b = satPressure(id, tempToC(tu, pr.temp), 'bubble');
      const d = satPressure(id, tempToC(tu, pr.temp), 'dew');
      if (b != null && d != null) rows.push({ tU: tu, bubble: b, dew: d });
    }
  }
  const show = (kpa: number) => fmt(pressureFromKpa(kpa - (pr.gauge ? pr.atmKpa : 0), pr.pressure), pressureDecimals(pr.pressure));
  const pu = `${PRESSURE_LABEL[pr.pressure]}${pr.gauge ? '' : ' abs'}`;
  const cell = { flex: 1, textAlign: 'right' as const, fontFamily: FONT.numeral, fontSize: 22 };
  return (
    <Screen tab={false}>
      <RefrigerantButton showNote={false} />
      <Segmented label="Step" value={step} onChange={setStep} options={[{ value: '1', label: '1°' }, { value: '2', label: '2°' }, { value: '5', label: '5°' }]} />
      <Card>
        <View style={{ flexDirection: 'row', paddingBottom: SPACE.sm, borderBottomWidth: 2, borderBottomColor: p.text }}>
          <Text style={{ flex: 1, fontWeight: '800', color: p.text }}>{TEMP_LABEL[pr.temp]}</Text>
          {glide ? (
            <>
              <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', color: p.high }}>{`Bubble ${pu}`}</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', color: p.low }}>{`Dew ${pu}`}</Text>
            </>
          ) : <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', color: p.text }}>{pu}</Text>}
        </View>
        {rows.map((r) => (
          <View key={r.tU} accessible accessibilityLabel={`${r.tU} degrees: ${glide ? `bubble ${show(r.bubble)}, dew ${show(r.dew)}` : show(r.bubble)} ${pu}`} style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: r.tU === 0 ? 2 : 0, borderBottomColor: p.line }}>
            <Text style={{ ...cell, textAlign: 'left', color: p.text }}>{r.tU}</Text>
            {glide ? (
              <>
                <Text style={{ ...cell, color: p.high }}>{show(r.bubble)}</Text>
                <Text style={{ ...cell, color: p.low }}>{show(r.dew)}</Text>
              </>
            ) : <Text style={{ ...cell, color: p.text }}>{show(r.bubble)}</Text>}
          </View>
        ))}
      </Card>
      <Small>{`Data: ${PT_TABLES[id]?.source ?? ''}.${pr.gauge ? ' Gauge pressures at the atmosphere set in Settings.' : ''} Negative gauge pressure means vacuum.`}</Small>
    </Screen>
  );
}
