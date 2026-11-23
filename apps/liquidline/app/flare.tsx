import { Text, View } from 'react-native';
import { FLARE_TORQUE, NM_TO_FTLB } from '../src/core/flare.ts';
import { useSettings } from '../src/state/store.ts';
import { FONT, SPACE, usePalette } from '../src/theme/tokens.ts';
import { Card, Label, Notice, Screen, Small } from '../src/ui/kit.tsx';
import { Gate } from '../src/ui/Gate.tsx';

export default function FlareScreen() {
  const p = usePalette();
  const imperial = useSettings().units.length === 'ft';
  return (
    <Screen tab={false}>
      <Notice kind="info" text="Typical values printed in many split-system manuals for R32 / R410A flares. Your unit’s manual and the flare nut maker’s figures take precedence." />
      <Gate what="the flare torque table">
        <Card>
          <Label>Flare nut torque</Label>
          {FLARE_TORQUE.map((t, i) => (
            <View key={t.od} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: SPACE.sm, borderTopWidth: i ? 1 : 0, borderTopColor: p.line }}>
              <View>
                <Text style={{ fontFamily: FONT.display, fontSize: 34, color: p.text }}>{t.od}</Text>
                <Small>{`${t.odMm} mm OD`}</Small>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: FONT.numeral, fontSize: 30, color: p.text }}>{imperial ? `${Math.round(t.minNm * NM_TO_FTLB)}–${Math.round(t.maxNm * NM_TO_FTLB)} ft·lb` : `${t.minNm}–${t.maxNm} N·m`}</Text>
                <Small>{imperial ? `${t.minNm}–${t.maxNm} N·m` : `${Math.round(t.minNm * NM_TO_FTLB)}–${Math.round(t.maxNm * NM_TO_FTLB)} ft·lb`}</Small>
              </View>
            </View>
          ))}
        </Card>
        <Card>
          <Label>Good flares</Label>
          <Small>Cut square, deburr facing down, slide the nut on first, flare to the gauge for the refrigerant, oil only where the unit’s manual says and only its specified oil (never on the threads), tighten with a torque wrench and a backing spanner, then leak test.</Small>
        </Card>
      </Gate>
    </Screen>
  );
}
