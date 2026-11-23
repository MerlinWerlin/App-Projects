import { router } from 'expo-router';
import { useApp } from '../src/state/AppState';
import { CountryPicker } from '../src/ui/CountryPicker';

export default function CountryScreen() {
  const { setCountry } = useApp();
  return <CountryPicker onDone={c => { setCountry(c); router.back(); }} />;
}
