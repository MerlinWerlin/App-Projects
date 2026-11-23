// Saved jobs, newest first. Tap to reopen in its calculator; swipe-free delete via a confirm (glove friendly).
import { useRouter, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCountry } from '../../src/countries/index.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE, useTheme } from '../../src/theme/theme.ts';
import { Btn, Txt } from '../../src/ui/kit.tsx';
import { Icon } from '../../src/ui/Icon.tsx';
import { TOOL_NAMES } from '../../src/ui/ToolScreen.tsx';

export default function Jobs() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const remove = (id: string, name: string) => Alert.alert(`Delete "${name}"?`, 'This removes the saved job from this phone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => app.deleteJob(id) },
  ]);
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl }}>
      <Txt v="large" accessibilityRole="header">Jobs</Txt>
      {app.jobs.length === 0 ? (
        <View style={{ marginTop: SPACE.xl, alignItems: 'flex-start', gap: SPACE.sm }}>
          <Icon name="jobs" size={36} color={t.ink3} />
          <Txt v="title2">No saved jobs yet</Txt>
          <Txt v="body" tone="ink2">Work something out, then tap the bookmark at the top of the calculator to keep it here. Jobs stay on this phone.</Txt>
          <Btn label="Count some tiles" onPress={() => router.push('/tool/tiles')} icon="tiles" style={{ alignSelf: 'stretch', marginTop: SPACE.sm }} />
        </View>
      ) : (
        <View style={{ marginTop: SPACE.md, gap: SPACE.sm }}>
          {app.jobs.map(j => (
            <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.sheet, borderRadius: RADIUS.card }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${j.name}, ${TOOL_NAMES[j.tool]}. ${j.summary.join(', ')}`} accessibilityHint="Opens the job"
                onPress={() => router.push(`/tool/${j.tool}?job=${encodeURIComponent(j.id)}` as Href)}
                style={({ pressed }) => ({ flex: 1, padding: SPACE.md, opacity: pressed ? 0.8 : 1 })}>
                <Txt v="footnote" tone="ink2" style={{ fontWeight: '700' }}>{`${TOOL_NAMES[j.tool]} · ${getCountry(j.country).flag || getCountry(j.country).name} · ${new Date(j.updatedAt).toLocaleDateString()}`}</Txt>
                <Txt v="title2">{j.name}</Txt>
                <Txt v="subhead" tone="ink2">{j.summary.join(' · ')}</Txt>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${j.name}`} onPress={() => remove(j.id, j.name)} style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trash" size={18} color={t.ink3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
