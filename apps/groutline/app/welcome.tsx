// First launch: one question, the country. It sets units, standards, words and the materials lists.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CountryCode } from '../src/countries/index.ts';
import { useApp } from '../src/state/AppState.tsx';
import { SPACE, useTheme } from '../src/theme/theme.ts';
import { CountryList } from '../src/ui/CountryList.tsx';
import { Btn, Txt } from '../src/ui/kit.tsx';
import { GroutMark } from '../src/ui/GroutMark.tsx';

export default function Welcome() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<CountryCode>(app.suggestedCountry.code);
  const go = () => { app.setPrefs({ country: pick, units: null }); router.replace('/'); };
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SPACE.lg, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xl }}>
        <GroutMark size={64} />
        <Txt v="large" accessibilityRole="header" style={{ marginTop: SPACE.md }}>Where do you tile?</Txt>
        <Txt v="body" tone="ink2" style={{ marginTop: SPACE.xs, marginBottom: SPACE.lg }}>
          Groutline sets units, the standards it quotes, and the tile, adhesive, grout and membrane sizes your local suppliers stock. You can change it any time in Settings.
        </Txt>
        <CountryList selected={pick} suggested={app.suggestedCountry.code} onPick={setPick} />
      </ScrollView>
      <View style={{ paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm, paddingBottom: insets.bottom + SPACE.sm, borderTopWidth: 0.5, borderTopColor: t.line, backgroundColor: t.ground }}>
        <Btn label="Start tiling" onPress={go} icon="arrowRight" />
      </View>
    </View>
  );
}
