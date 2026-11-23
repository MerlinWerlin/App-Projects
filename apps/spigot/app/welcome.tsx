import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../src/state/AppState';
import { deviceCountry, profileFor } from '../src/country/countries';
import { CountryPicker } from '../src/ui/CountryPicker';
import { Button } from '../src/ui/kit';
import { font, space, usePalette } from '../src/ui/theme';
import { ART } from '../src/ui/art';
import type { CountryCode } from '../src/state/data';

/**
 * First launch, one step: where do you work? The device region is pre-selected, so most people tap Continue once.
 * The choice sets units, code names, terms and the materials on offer; it can be changed any time in Settings.
 */
export default function Welcome() {
  const c = usePalette();
  const { setPrefs } = useApp();
  const insets = useSafeAreaInsets();
  const [country, setCountry] = useState<CountryCode>(() => deviceCountry());
  const p = profileFor(country);
  const go = () => {
    setPrefs({ country, unit: p.defaultUnit, stock: p.stockLengthMm });
    router.replace('/');
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.l, paddingBottom: 140 + insets.bottom, gap: space.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Image source={ART.mark} style={{ width: 52, height: 52, borderRadius: 12 }} accessible={false} />
          <Text accessibilityRole="header" style={{ fontFamily: font.displayHeavy, fontSize: 44, color: c.ink, letterSpacing: 0.5 }}>SPIGOT</Text>
        </View>
        <View style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={{ fontFamily: font.displayHeavy, fontSize: 34, lineHeight: 36, color: c.ink }}>WHERE DO YOU WORK?</Text>
          <Text style={{ fontSize: 17, lineHeight: 24, color: c.ink2 }}>Spigot sets your units, the code it quotes and the pipe and fittings that are sold there. You can change it later in Settings.</Text>
        </View>
        <CountryPicker value={country} onChange={setCountry} />
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, gap: space.s }}>
        <Button label={`Continue · ${country === 'OTHER' ? 'metric' : p.name}`} icon="arrow-forward" onPress={go} />
      </View>
    </View>
  );
}
