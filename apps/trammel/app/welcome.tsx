// First launch: one question, "Where do you build?", with the phone's region already ticked. Everything after it
// (units, trade words, the stair code checked, the timber sizes offered) follows the answer. No paywall, no account.
import { getLocales } from 'expo-localization';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryFromRegion, type CountryCode } from '../src/core/country.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, space, useTheme, sys } from '../src/theme/theme.ts';
import { CountryPicker } from '../src/ui/CountryPicker.tsx';
import { Button } from '../src/ui/kit.tsx';

export function deviceCountry(): CountryCode {
  try {
    return countryFromRegion(getLocales()[0]?.regionCode);
  } catch {
    return 'OTHER';
  }
}

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { chooseCountry } = useSettings();
  const [c, setC] = useState<CountryCode>(deviceCountry);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.l, paddingBottom: space.xl, gap: space.l }}>
        <Image source={require('../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 16 }} accessibilityIgnoresInvertColors />
        <View style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, color: t.ink }}>
            Where do you build?
          </Text>
          <Text style={{ ...sys.body, fontSize: 17, lineHeight: 24, color: t.muted }}>
            Trammel checks your stairs against the local code and offers the timber sizes your yard stocks. You can change it later in Settings.
          </Text>
        </View>
        <CountryPicker value={c} onChange={setC} />
      </ScrollView>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: Math.max(insets.bottom, space.m), borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.bg }}>
        <Button
          label="Continue"
          kind="blade"
          onPress={() => {
            chooseCountry(c);
            router.replace('/');
          }}
        />
      </View>
    </View>
  );
}
