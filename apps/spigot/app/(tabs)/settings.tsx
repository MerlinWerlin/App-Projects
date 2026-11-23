import React from 'react';
import { Alert, Linking, Switch } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useApp } from '../../src/state/AppState';
import { useCountry } from '../../src/country/useCountry';
import { Body, Card, Divider, FieldLabel, Row, Screen, Segmented } from '../../src/ui/kit';
import { usePalette } from '../../src/ui/theme';

export default function Settings() {
  const c = usePalette();
  const app = useApp();
  const { prefs, setPrefs } = app;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const country = useCountry();
  const unlockSub = app.owned ? 'Unlocked. Thank you!' : app.trial.active ? `Free trial: ${app.trial.daysLeft} ${app.trial.daysLeft === 1 ? 'day' : 'days'} left` : 'Free 7-day trial, then a one-time unlock';
  return (
    <Screen>
      <Card>
        <FieldLabel>Country</FieldLabel>
        <Row icon="earth-outline" title={country.name} subtitle={`${country.codeName}. Sets units, codes and materials`} onPress={() => router.push('/country')} />
      </Card>
      <Card>
        <Segmented label="Units" value={prefs.unit} onChange={unit => setPrefs({ unit })} options={[{ value: 'metric', label: 'Millimetres (mm, m)' }, { value: 'imperial', label: 'Inches (ft, in)' }]} />
        <Body muted style={{ fontSize: 14 }}>Inches show to the nearest 1/16″. Flow stays in litres and m/s.</Body>
      </Card>
      <Card>
        <Segmented label="Appearance" value={prefs.appearance} onChange={appearance => setPrefs({ appearance })} options={[{ value: 'system', label: 'Match phone' }, { value: 'light', label: 'Light (sun)' }, { value: 'dark', label: 'Dark' }]} />
        <Divider />
        <Row title="Haptics" subtitle="A small buzz on key presses" right={<Switch value={prefs.haptics} onValueChange={haptics => setPrefs({ haptics })} trackColor={{ true: c.copper, false: c.line }} accessibilityLabel="Haptics" />} />
      </Card>
      <Card>
        <FieldLabel>Spigot Full Unlock</FieldLabel>
        <Row icon="lock-open-outline" title="Full Unlock and restore" subtitle={unlockSub} onPress={() => router.push('/unlock')} />
      </Card>
      <Card>
        <FieldLabel>Your data</FieldLabel>
        <Body>Jobs, saved results and custom fittings are kept on this phone only. Spigot has no account and collects no data.</Body>
        <Row icon="time-outline" title="Clear recent calculations" onPress={() => Alert.alert('Clear recent calculations?', 'Saved jobs are kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => app.clearRecents() }])} />
      </Card>
      <Card>
        <FieldLabel>About</FieldLabel>
        <Body>Spigot does the maths; you know the job. Results are only as good as the measurements and fitting data you put in. Always check against the manufacturer’s data and AS/NZS 3500 or your local code.</Body>
        <Row icon="help-buoy-outline" title="Support" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/spigot/support.html')} />
        <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/spigot/privacy.html')} />
        <Body muted style={{ fontSize: 14 }}>{`Spigot ${version}`}</Body>
      </Card>
    </Screen>
  );
}
