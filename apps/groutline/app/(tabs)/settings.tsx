import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE, TAP, useTheme } from '../../src/theme/theme.ts';
import { Section, Segmented, ToggleRow, Txt } from '../../src/ui/kit.tsx';

function LinkRow({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label} onPress={onPress}
      style={({ pressed }) => ({ minHeight: TAP, backgroundColor: t.sheet, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, opacity: pressed ? 0.85 : 1 })}>
      <Ionicons name={icon} size={22} color={t.ink} />
      <Txt v="headline" style={{ flex: 1 }}>{label}</Txt>
      {value ? <Txt v="subhead" tone="ink2">{value}</Txt> : null}
      <Ionicons name="chevron-forward" size={20} color={t.ink3} />
    </Pressable>
  );
}

export default function Settings() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = app.owned ? 'Full Unlock' : app.trial.active ? `Trial, ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : app.trial.started ? 'Trial ended' : 'Free';
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl }}>
      <Txt v="large" accessibilityRole="header">Settings</Txt>
      <Section title="Where you work">
        <View style={{ gap: SPACE.xs }}>
          <LinkRow icon="flag-outline" label="Country" value={`${app.country.flag} ${app.country.name}`} onPress={() => router.push('/country')} />
          <LinkRow icon="book-outline" label="Standards & rules" onPress={() => router.push('/standards')} />
        </View>
      </Section>
      <Section title="Units">
        <Segmented label="Units" value={app.prefs.units ?? 'auto'} onChange={v => app.setPrefs({ units: v === 'auto' ? null : v })}
          options={[{ id: 'auto', label: `Country (${app.country.system === 'metric' ? 'mm' : 'ft-in'})` }, { id: 'metric', label: 'Metric' }, { id: 'imperial', label: 'Imperial' }]} />
      </Section>
      <Section title="Feel">
        <ToggleRow label="Haptics" sub="A small tap when you save" value={app.prefs.haptics} onChange={v => app.setPrefs({ haptics: v })} />
      </Section>
      <Section title="Groutline">
        <View style={{ gap: SPACE.xs }}>
          <LinkRow icon="lock-open-outline" label="Full Unlock" value={status} onPress={() => router.push('/unlock')} />
          <LinkRow icon="help-buoy-outline" label="Help & support" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/groutline/support.html')} />
          <LinkRow icon="shield-checkmark-outline" label="Privacy" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/groutline/privacy.html')} />
        </View>
      </Section>
      <Txt v="footnote" tone="ink3" style={{ marginTop: SPACE.lg }}>
        {`Groutline ${Constants.expoConfig?.version ?? ''}. No account, no ads, no tracking. Jobs stay on this phone.`}
      </Txt>
    </ScrollView>
  );
}
