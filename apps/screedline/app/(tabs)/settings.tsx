import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseNumber } from '../../src/core/units';
import { useApp } from '../../src/state/AppState';
import { FONT, SPACE } from '../../src/theme/theme';
import { Choice, FieldShell, Group, NumberInput, Row, ScreedLine, SectionHeader, T } from '../../src/ui/kit';
import { useState } from 'react';

export default function SettingsScreen() {
  const app = useApp();
  const { theme, prefs, access, trial } = app;
  const insets = useSafeAreaInsets();
  const [waste, setWaste] = useState(String(prefs.waste));
  const wasteN = parseNumber(waste);
  const wasteErr = wasteN === null || wasteN < 0 || wasteN > 50 ? 'Use a number from 0 to 50.' : undefined;
  const status = access.full ? 'Unlocked. Thank you!' : trial.active ? `Trial: ${trial.daysLeft} ${trial.daysLeft === 1 ? 'day' : 'days'} left` : trial.started ? 'Trial ended' : 'Free version';
  const restore = async () => {
    const r = await app.restore();
    Alert.alert(r.ok ? 'Restored' : 'Restore purchases', r.ok ? (r.access.full ? 'Full Unlock is back on this phone.' : 'Your trial was found.') : r.message);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.m, paddingHorizontal: SPACE.l, paddingBottom: SPACE.xxl }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ gap: SPACE.s }} accessibilityRole="header">
        <ScreedLine theme={theme} width={56} />
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: FONT.numBold, fontSize: 44, lineHeight: 48, color: theme.ink }}>Settings</Text>
      </View>

      <SectionHeader>Country</SectionHeader>
      <Group>
        <Row testID="settings-country" icon="earth" title={app.country.name} subtitle={app.country.verified ? 'Local products, units and standards' : 'Generic sizes and metric units'} onPress={() => router.push('/country')} />
      </Group>

      <SectionHeader>Units</SectionHeader>
      <Choice label="Units" value={prefs.units} onChange={v => app.setPrefs({ units: v as 'metric' | 'imperial' })} options={[{ value: 'metric', label: 'Metric (m, mm)' }, { value: 'imperial', label: 'Imperial (ft, in)' }]} />

      <SectionHeader>Display</SectionHeader>
      <Choice label="Appearance" value={prefs.appearance} onChange={v => app.setPrefs({ appearance: v as typeof prefs.appearance })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'sun', label: 'Sun' }]} />
      <T kind="small" style={{ marginTop: SPACE.s }}>Sun mode is pure black on white with heavy borders, for reading in direct sunlight.</T>

      <SectionHeader>Defaults</SectionHeader>
      <FieldShell label="Waste allowance for concrete" error={wasteErr} help="Used when you open a concrete tool for the first time.">
        <NumberInput label="Waste allowance" value={waste} unit="%" error={!!wasteErr} onChange={s => { setWaste(s); const x = parseNumber(s); if (x !== null && x >= 0 && x <= 50) app.setPrefs({ waste: x }); }} />
      </FieldShell>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, marginTop: SPACE.m }}>
        <T kind="label" style={{ flex: 1 }}>Haptics</T>
        <Switch accessibilityLabel="Haptics" value={prefs.haptics} onValueChange={v => app.setPrefs({ haptics: v })} trackColor={{ true: theme.amber, false: theme.line }} />
      </View>

      <SectionHeader>Full Unlock</SectionHeader>
      <Group>
        <Row icon="lock-open-variant-outline" title="Full Unlock" subtitle={status} onPress={() => router.push('/unlock')} />
        <Row icon="restore" title="Restore purchases" onPress={() => void restore()} />
      </Group>

      <SectionHeader>About</SectionHeader>
      <Group>
        <Row icon="book-open-variant" title="Sources and formulas" subtitle="Where every number comes from" onPress={() => router.push('/sources')} />
        <Row icon="shield-check-outline" title="Privacy" subtitle="No account, no ads, no tracking. Jobs stay on this phone." />
      </Group>
      <T kind="small" style={{ marginTop: SPACE.l, textAlign: 'center' }}>Screedline {Constants.expoConfig?.version ?? ''} · Quantities are estimates. Confirm with your supplier, and with your engineer for anything structural.</T>
    </ScrollView>
  );
}
