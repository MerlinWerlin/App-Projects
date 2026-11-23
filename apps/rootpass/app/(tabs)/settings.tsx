import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useApp } from '../../src/state/AppState.tsx';
import { Card, Screen, Section, Segmented, Txt } from '../../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';

const SITE = 'https://merlinwerlin.github.io/App-Projects/rootpass/';

function LinkRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 56, paddingHorizontal: SPACE.lg, backgroundColor: pressed ? C.raised : C.surface })}>
      <Ionicons name={icon} size={22} color={C.accent} />
      <Txt v="headline" style={{ flex: 1 }}>{label}</Txt>
      <Ionicons name="chevron-forward" size={20} color={C.ink3} />
    </Pressable>
  );
}

export default function Settings() {
  const app = useApp();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen>
      <Section title="Units">
        <Segmented value={app.prefs.units} onChange={u => app.setPrefs({ units: u })} options={[{ value: 'metric', label: 'Millimetres' }, { value: 'imperial', label: 'Inches' }]} />
        <Txt v="small" tone="ink3">Inches show decimals and the nearest 1/16. Open jobs convert when you switch.</Txt>
      </Section>
      <Section title="Template paper">
        <Segmented value={app.prefs.paper} onChange={p => app.setPrefs({ paper: p })} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} />
        <Txt v="small" tone="ink3">Big templates tile over several sheets with trim lines. Print at 100 % and check the 100 mm ruler on each sheet.</Txt>
      </Section>
      <Section title="Full Unlock">
        <Card>
          <Txt v="headline">{app.owned ? 'Unlocked. Thank you!' : app.trial.active ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : app.trial.started ? 'Free trial ended' : 'Free tools only'}</Txt>
          <Txt v="body" tone="ink2">{app.owned ? 'Every tool, printable templates and saved jobs are yours for good.' : 'Saddles, lobster-backs, cut lists, weld metal, printable templates and saved jobs.'}</Txt>
          <View style={{ borderRadius: RADIUS.md, overflow: 'hidden' }}>
            <LinkRow icon="flash" label={app.owned ? 'Restore or view' : 'See Full Unlock'} onPress={() => router.push('/unlock')} />
          </View>
        </Card>
      </Section>
      <Section title="About">
        <View style={{ borderRadius: RADIUS.lg, overflow: 'hidden', gap: 1, backgroundColor: C.line }}>
          <LinkRow icon="help-buoy-outline" label="Help and support" onPress={() => void Linking.openURL(`${SITE}support.html`)} />
          <LinkRow icon="shield-checkmark-outline" label="Privacy" onPress={() => void Linking.openURL(`${SITE}privacy.html`)} />
          <LinkRow icon="book-outline" label="Formulas and sources" onPress={() => void Linking.openURL(`${SITE}formulas.html`)} />
        </View>
        <Txt v="small" tone="ink3">Rootpass {version}. No account, no ads, no tracking: jobs stay on this phone. Answers are worked from published formulas and shown step by step, but they are a guide for skilled tradespeople. Check every cut and fit-up, and follow the design code for pressure and structural work.</Txt>
      </Section>
    </Screen>
  );
}
