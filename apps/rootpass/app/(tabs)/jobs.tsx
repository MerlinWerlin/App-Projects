import { Icon } from '../../src/ui/Icon.tsx';
import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useApp } from '../../src/state/AppState.tsx';
import { EmptyBenchArt } from '../../src/ui/Art.tsx';
import { GlyphTile } from '../../src/ui/Glyph.tsx';
import { Btn, Screen, Txt } from '../../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';
import { TOOL_META } from '../../src/ui/tools.ts';

export default function Jobs() {
  const app = useApp();
  const router = useRouter();
  const remove = (id: string, name: string) =>
    Alert.alert(`Delete "${name}"?`, 'This removes the saved job from this phone. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void app.deleteJob(id).catch(() => Alert.alert('Could not delete', 'Please try again.')) },
    ]);
  if (!app.jobs.length) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: SPACE.md, paddingTop: SPACE.xl }}>
          <EmptyBenchArt />
          <Txt v="title" style={{ textAlign: 'center' }}>No saved jobs yet</Txt>
          <Txt v="body" tone="ink2" style={{ textAlign: 'center', maxWidth: 320 }}>
            Open a tool, set it up, then tap the bookmark at the top right to keep it here for next time. Jobs stay on this phone.
          </Txt>
          <View style={{ alignSelf: 'stretch', marginTop: SPACE.sm }}>
            <Btn label="Go to the tools" icon="construct" onPress={() => router.navigate('/')} />
          </View>
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      {app.jobs.map(j => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: RADIUS.lg }}>
          <Pressable
            onPress={() => router.push({ pathname: `/tool/${j.tool}`, params: { job: j.id } })}
            accessibilityRole="button"
            accessibilityLabel={app.sp(`${j.name}, ${TOOL_META[j.tool].title}`)}
            style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, opacity: pressed ? 0.8 : 1, minHeight: 76 })}
          >
            <GlyphTile tool={j.tool} />
            <View style={{ flex: 1 }}>
              <Txt v="headline" numberOfLines={2}>{j.name}</Txt>
              <Txt v="small" tone="ink3">{TOOL_META[j.tool].title} · {new Date(j.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</Txt>
            </View>
          </Pressable>
          <Pressable onPress={() => remove(j.id, j.name)} accessibilityRole="button" accessibilityLabel={`Delete ${j.name}`} style={{ width: 60, minHeight: 76, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trash" size={24} color={C.ink3} />
          </Pressable>
        </View>
      ))}
    </Screen>
  );
}
