import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE, TAP, useTheme } from '../../src/theme/theme.ts';
import { Section, Segmented, ToggleRow, Txt } from '../../src/ui/kit.tsx';
import { Icon, type IconName } from '../../src/ui/Icon.tsx';

function LinkRow({ icon, label, value, onPress, last }: { icon: IconName; label: string; value?: string; onPress(): void; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label} onPress={onPress}
      style={({ pressed }) => ({ minHeight: TAP, paddingLeft: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: pressed ? t.sunk : 'transparent' })}>
      <Icon name={icon} size={20} color={t.ink} />
      <View style={{ flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingRight: SPACE.md, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
        <Txt v="headline" style={{ flex: 1 }}>{label}</Txt>
        {value ? <Txt v="subhead" tone="ink2">{value}</Txt> : null}
        <Icon name="chevronRight" size={14} color={t.ink3} />
      </View>
    </Pressable>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.sheet, borderRadius: RADIUS.card, overflow: 'hidden' }}>{children}</View>;
}

export default function Settings() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = app.owned ? 'Owned' : app.trial.active ? `Trial, ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : app.trial.started ? 'Trial ended' : 'Not unlocked';
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl }}>
      <Txt v="large" accessibilityRole="header">Settings</Txt>
      <Section title="Where you work">
        <Group>
          <LinkRow icon="flag" label="Country" value={app.country.code === 'XX' ? app.country.name : `${app.country.flag} ${app.country.name}`} onPress={() => router.push('/country')} />
          <LinkRow icon="book" label="Standards & rules" onPress={() => router.push('/standards')} last />
        </Group>
      </Section>
      <Section title="Units">
        <Segmented label="Units" value={app.prefs.units ?? 'auto'} onChange={v => app.setPrefs({ units: v === 'auto' ? null : v })}
          options={[{ id: 'auto', label: `Country (${app.country.system === 'metric' ? 'mm' : 'ft-in'})` }, { id: 'metric', label: 'Metric' }, { id: 'imperial', label: 'Imperial' }]} />
      </Section>
      <Section title="Feel">
        <ToggleRow label="Haptics" sub="Small taps when you pick an option or save" value={app.prefs.haptics} onChange={v => app.setPrefs({ haptics: v })} />
      </Section>
      <Section title="Groutline">
        <Group>
          <LinkRow icon="unlock" label="Full Unlock" value={status} onPress={() => router.push('/unlock')} />
          <LinkRow icon="help" label="Help & support" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/groutline/support.html')} />
          <LinkRow icon="privacy" label="Privacy" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/groutline/privacy.html')} last />
        </Group>
      </Section>
      <Txt v="footnote" tone="ink3" style={{ marginTop: SPACE.lg }}>
        {`Groutline ${Constants.expoConfig?.version ?? ''}. No account, no ads, no tracking. Jobs stay on this phone.`}
      </Txt>
    </ScrollView>
  );
}
