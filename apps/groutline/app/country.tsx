import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../src/state/AppState.tsx';
import { SPACE, useTheme } from '../src/theme/theme.ts';
import { CountryList } from '../src/ui/CountryList.tsx';
import { Txt } from '../src/ui/kit.tsx';

export default function CountryScreen() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ padding: SPACE.gutter, paddingBottom: insets.bottom + SPACE.xl }}>
      <Txt v="body" tone="ink2" style={{ marginBottom: SPACE.md }}>Changes units, the standards quoted in notes, and the materials lists. Saved jobs keep their numbers.</Txt>
      <CountryList selected={app.country.code} suggested={app.suggestedCountry.code} onPick={c => { app.setPrefs({ country: c, units: null }); router.back(); }} />
    </ScrollView>
  );
}
