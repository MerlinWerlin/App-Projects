/** Settings: country first, units, appearance, the unlock, and where every number comes from. */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Switch, View } from 'react-native';
import { flag } from '../../src/data';
import { useApp } from '../../src/state/AppState';
import { SPACE } from '../../src/theme/theme';
import { Card, Divider, Row, Screen, Section, Segmented, Txt } from '../../src/ui/kit';

const PRIVACY = 'https://merlinwerlin.github.io/App-Projects/eaveline/privacy.html';
const SUPPORT = 'https://merlinwerlin.github.io/App-Projects/eaveline/support.html';

export default function Settings() {
  const app = useApp();
  const { prefs, country, theme } = app;
  const router = useRouter();
  const unlockSub = app.owned ? 'Unlocked. Thank you!' : app.trial.active ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : app.trial.started ? 'Trial ended' : '7-day free trial, then a one-time unlock';
  return (
    <Screen>
      <Section title="Country">
        <Card style={{ paddingVertical: 0 }}>
          <Row testID="settings-country" icon="earth-outline" title={`${flag(country.code)} ${country.name}`} sub={country.guided ? 'Fully guided: local standards, words and materials' : 'General guidance, metric'} onPress={() => router.push('/onboarding')} />
        </Card>
      </Section>
      <Section title="Units">
        <Segmented label="Lengths" value={prefs.sys} onChange={sys => app.setPrefs({ sys })} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Feet & inches' }]} />
        <Segmented label="Pitch" value={prefs.pitchStyle} onChange={pitchStyle => app.setPrefs({ pitchStyle })} options={[{ value: 'deg', label: 'Degrees' }, { value: 'x12', label: 'Rise : 12' }]} />
      </Section>
      <Section title="Appearance">
        <Segmented label="Theme" value={prefs.theme} onChange={t => app.setPrefs({ theme: t })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'sun', label: 'Sun' }]} />
        <Txt v="footnote" tone="ink3">Sun is pure black on white with heavier lines, for bright sites.</Txt>
        <Card style={{ paddingVertical: 0 }}>
          <Row title="Haptics" sub="A tap when you change a setting or save" right={<Switch value={prefs.haptics} onValueChange={haptics => app.setPrefs({ haptics })} trackColor={{ true: theme.ink, false: theme.line }} thumbColor={theme.accent} accessibilityLabel="Haptics" />} />
        </Card>
      </Section>
      <Section title="Eaveline Full Unlock">
        <Card style={{ paddingVertical: 0 }}>
          <Row testID="settings-unlock" icon="lock-open-outline" title="Full Unlock" sub={unlockSub} onPress={() => router.push('/unlock')} />
        </Card>
      </Section>
      <Section title="About">
        <Card style={{ paddingVertical: 0 }}>
          <Row icon="library-outline" title="Standards & sources" sub="Where every value comes from" onPress={() => router.push('/sources')} />
          <Divider />
          <Row icon="warning-outline" title="Working at heights" onPress={() => router.push('/safety')} />
          <Divider />
          <Row icon="shield-checkmark-outline" title="Privacy policy" sub="No data collected. Jobs stay on this phone." onPress={() => void Linking.openURL(PRIVACY)} />
          <Divider />
          <Row icon="help-buoy-outline" title="Support" onPress={() => void Linking.openURL(SUPPORT)} />
        </Card>
        <View style={{ paddingHorizontal: SPACE.xxs }}>
          <Txt v="footnote" tone="ink3">Eaveline {Constants.expoConfig?.version ?? ''}. Results are estimates for planning and ordering. Check them against the maker’s data and your local code; a licensed plumber or designer confirms drainage.</Txt>
        </View>
      </Section>
    </Screen>
  );
}
