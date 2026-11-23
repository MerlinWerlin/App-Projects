import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, Switch, Text, View } from 'react-native';
import { useAccess } from '../../src/state/access.ts';
import { useSettings } from '../../src/state/settings.tsx';
import { fonts, space, useTheme, sys } from '../../src/theme/theme.ts';
import { Button, Card, H, P, Screen, Segment } from '../../src/ui/kit.tsx';
import { accessLine, PRIVACY_URL } from '../../src/ui/Paywall.tsx';
import { countrySummary } from '../../src/ui/CountryPicker.tsx';

const SUPPORT_URL = 'https://merlinwerlin.github.io/App-Projects/trammel/support.html';

export default function Settings() {
  const t = useTheme();
  const { settings, update, country } = useSettings();
  const a = useAccess();
  return (
    <Screen>
      <Card>
        <H>Trammel Full Unlock</H>
        <P>{accessLine(a)}</P>
        <Button label={a.state === 'unlocked' ? 'Purchases and restore' : 'Free trial and Full Unlock'} kind={a.state === 'unlocked' ? 'secondary' : 'blade'} icon="unlock" onPress={() => router.push('/paywall')} />
      </Card>
      <Card>
        <H>Country</H>
        <P>{country.name}</P>
        <P muted small>{countrySummary(country.code)}</P>
        <Button label="Change country" kind="secondary" icon="globe" onPress={() => router.push('/country')} />
      </Card>
      <Card>
        <H>Units</H>
        <Segment options={[{ value: 'metric', label: 'Metric (mm)' }, { value: 'imperial', label: 'Imperial (in)' }]} value={settings.units} onChange={(units) => update({ units })} />
        {settings.units === 'imperial' ? <Segment label="Round to" options={[{ value: 8, label: '1/8"' }, { value: 16, label: '1/16"' }, { value: 32, label: '1/32"' }]} value={settings.denom} onChange={(denom) => update({ denom })} /> : null}
        <P muted small>You can always type any unit into a field: 2400, 2.4m, 240cm, 54 1/2 or 4' 6".</P>
      </Card>
      <Card>
        <H>Saw kerf</H>
        <P muted small>Used by the cut list. Most circular and drop saw blades take 2.5-3.2 mm.</P>
        <Segment chips options={[2, 2.5, 3, 3.2, 4].map((k) => ({ value: k, label: `${k} mm` }))} value={settings.kerf} onChange={(kerf) => update({ kerf })} />
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
          <Text style={{ ...sys.bodyBold, fontSize: 18, color: t.ink }}>Haptics</Text>
          <Switch value={settings.haptics} onValueChange={(haptics) => update({ haptics })} accessibilityLabel="Haptics" />
        </View>
      </Card>
      <Card>
        <H>About</H>
        <Button label="About the maths and sources" kind="quiet" icon="book" onPress={() => router.push('/about')} />
        <Button label="Support" kind="quiet" icon="help" onPress={() => Linking.openURL(SUPPORT_URL).catch(() => {})} />
        <Button label="Privacy policy" kind="quiet" icon="shield" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
        <P muted small>{`No account, no ads, no tracking. Your jobs stay on this phone.\nTrammel ${Constants.expoConfig?.version ?? ''}`}</P>
      </Card>
    </Screen>
  );
}
