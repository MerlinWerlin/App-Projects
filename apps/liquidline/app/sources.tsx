// Rules, licences and standards for the person's country, and where the app's numbers come from.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useCountry } from '../src/state/prefs.ts';
import { SPACE, usePalette } from '../src/theme/tokens.ts';
import { Body, Card, Label, Notice, Screen, Small } from '../src/ui/kit.tsx';

function RuleLine({ text, checked }: { text: string; checked: boolean }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
      <Ionicons name={checked ? 'checkmark-circle' : 'help-circle-outline'} size={20} color={checked ? p.ok : p.warn} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Body>{text}</Body>
        {!checked ? <Small>Check locally: this wasn’t confirmed on an official page.</Small> : null}
      </View>
    </View>
  );
}

export default function SourcesScreen() {
  const c = useCountry();
  const p = usePalette();
  return (
    <Screen tab={false}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '800', color: p.text }}>{`${c.flag} ${c.name}`}</Text>
      {!c.guided ? <Notice kind="info" text="Generic guidance: Liquidline doesn’t hold checked local data for your country yet. Follow your local licensing rules and standards." /> : null}
      <Card>
        <Label>Licence and certification</Label>
        {c.licence.map((l, i) => <RuleLine key={i} {...l} />)}
      </Card>
      <Card>
        <Label>Safety standards</Label>
        {c.standards.map((s, i) => <Body key={i}>{`• ${s}`}</Body>)}
      </Card>
      {c.rules.length ? (
        <Card>
          <Label>Refrigerant rules</Label>
          {c.rules.map((r, i) => <RuleLine key={i} {...r} />)}
        </Card>
      ) : null}
      <Card>
        <Label>Where the numbers come from</Label>
        <Small>Saturation pressures: generated from CoolProp 8 (open-source reference equations of state, the same equations NIST REFPROP uses for pure refrigerants). Checked in the app’s tests against the NIST Chemistry WebBook for pure refrigerants and against the refrigerant makers’ published tables for blends; R454B, R448A, R449A and R513A are calibrated to those published points.</Small>
        <Small>Safety classes: ASHRAE 34 / ISO 817. GWP: IPCC Fourth Assessment Report (100-year).</Small>
        <Small>Pair coil and line set sizes, licences and rules: public catalogues and government pages, checked November 2026. Items marked “check locally” were seen only in listings or summaries.</Small>
        <Small>Charge rates, pipe sizes, flare torques and the load estimate are typical values for orientation. The equipment manufacturer’s data and your local regulations always take precedence.</Small>
      </Card>
    </Screen>
  );
}
