import { Stack } from 'expo-router';
import { useSettings } from '../src/state/settings.tsx';
import { CountryPicker } from '../src/ui/CountryPicker.tsx';
import { P, Screen } from '../src/ui/kit.tsx';

export default function CountryScreen() {
  const { settings, chooseCountry } = useSettings();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Country' }} />
      <CountryPicker value={settings.country ?? 'OTHER'} onChange={chooseCountry} />
      <P muted small>Changing country also switches to its usual units. Saved jobs keep the numbers you typed.</P>
    </Screen>
  );
}
