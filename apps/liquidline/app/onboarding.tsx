// First launch: country first (device region pre-selected), then a one-tap confirmation that this is an aid for
// licensed technicians. No paywall here; the PT tool works straight away.
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { profileFor, type CountryCode } from '../src/core/countries.ts';
import { countryFromRegion, withCountry } from '../src/core/settings.ts';
import { deviceRegion, updateSettings, useSettings } from '../src/state/store.ts';
import { FONT, SPACE, usePalette } from '../src/theme/tokens.ts';
import { CountryList } from '../src/ui/CountryList.tsx';
import { Body, Button, Card, Heading, Notice, Screen, Small } from '../src/ui/kit.tsx';
import { Hero } from '../src/ui/Hero.tsx';

export default function Onboarding() {
  const p = usePalette();
  const s = useSettings();
  const detected = countryFromRegion(deviceRegion());
  const [step, setStep] = useState<0 | 1>(0);
  const [country, setCountry] = useState<CountryCode>(s.country ?? detected);
  const c = profileFor(country);

  if (step === 0) {
    return (
      <Screen>
        <Hero />
        <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 44, lineHeight: 46, color: p.text }}>Where do you work?</Text>
        <Body dim>Liquidline sets units, the refrigerants you’ll see, licence and standards names, and the pair coils and line sets wholesalers stock, for your country. You can change it any time in Settings.</Body>
        <CountryList value={country} onPick={setCountry} detected={detected} />
        {!c.guided ? <Notice kind="info" text="Other countries get metric units and generic guidance. Check your local rules and stocked sizes." /> : null}
        <Button testID="onboarding-next" title={`Continue with ${c.name}`} onPress={() => { updateSettings((cur) => withCountry(cur, country)); setStep(1); }} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 44, lineHeight: 46, color: p.text }}>Before you start</Text>
      <Card>
        <Heading>An aid for licensed technicians</Heading>
        <Body>Liquidline helps you check readings and do the sums on the job. The equipment manufacturer’s data and your local regulations always take precedence.</Body>
        {c.licence.slice(0, 1).map((l, i) => <Small key={i}>{`${c.name}: ${l.text}`}</Small>)}
      </Card>
      <Card>
        <Heading tone="low">Blue is the low side</Heading>
        <Small>Suction pressure, superheat, dew point.</Small>
        <Heading tone="high">Red is the high side</Heading>
        <Small>Liquid pressure, subcooling, bubble point.</Small>
      </Card>
      <Notice text="Flammable refrigerants (A2L such as R32 and R454B, A3 such as R290) need the right training, tools and charge limits. Liquidline reminds you when one is selected." />
      <View style={{ gap: SPACE.sm }}>
        <Button
          testID="onboarding-agree"
          title="I understand, open Liquidline"
          onPress={() => {
            updateSettings({ onboarded: true, acknowledged: true });
            router.replace('/');
          }}
        />
        <Button kind="plain" title="Back" onPress={() => setStep(0)} />
      </View>
    </Screen>
  );
}
