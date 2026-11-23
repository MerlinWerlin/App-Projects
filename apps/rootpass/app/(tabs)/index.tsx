import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/state/AppState.tsx';
import { JointArt } from '../../src/ui/Art.tsx';
import { Glyph } from '../../src/ui/Glyph.tsx';
import { Btn, Segmented, Txt } from '../../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';
import { TOOL_META, TOOL_ORDER } from '../../src/ui/tools.ts';

export default function Tools() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 3 : 2;
  const tileW = (width - SPACE.gutter * 2 - SPACE.md * (cols - 1)) / cols;
  const trial = app.trial;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingBottom: SPACE.xxl, paddingHorizontal: SPACE.gutter, gap: SPACE.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt v="display" accessibilityRole="header">ROOTPASS</Txt>
          <Txt v="label" tone="accent">Weld & fab calculator</Txt>
        </View>
        {!app.owned ? (
          <Pressable onPress={() => router.push('/unlock')} accessibilityRole="button" style={st.pill}>
            <Ionicons name="flash" size={16} color={C.accent} />
            <Txt v="label" tone="accent">{trial.active ? `Trial: ${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'}` : 'Unlock'}</Txt>
          </Pressable>
        ) : null}
      </View>

      {!app.prefs.welcomed ? (
        <View style={st.welcome}>
          <View style={{ alignItems: 'center', marginHorizontal: -SPACE.lg, marginTop: -SPACE.sm }}>
            <JointArt width={Math.min(width - 32, 380)} height={Math.min(width - 32, 380) * 0.56} />
          </View>
          <Txt v="title">Measure twice. Cut once.</Txt>
          <Txt v="body" tone="ink2">Saddle templates you print at true scale and tape round the pipe, mitres, cut lists, steel weight, filler and bolt circles. Every answer shows its working. Nothing leaves your phone.</Txt>
          <Segmented
            label="Measure in"
            value={app.prefs.units}
            options={[{ value: 'metric', label: 'Millimetres' }, { value: 'imperial', label: 'Inches' }]}
            onChange={u => app.setPrefs({ units: u, paper: u === 'imperial' ? 'letter' : 'a4' })}
          />
          <Btn label="Got it" onPress={() => app.setPrefs({ welcomed: true })} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }}>
        {TOOL_ORDER.map(id => {
          const m = TOOL_META[id];
          const locked = !app.can(id);
          return (
            <Pressable
              key={id}
              onPress={() => router.push(`/tool/${id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}. ${m.short}${locked ? '. In Full Unlock' : ''}`}
              style={({ pressed }) => [st.tile, { width: tileW, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Glyph tool={id} size={46} />
                {locked ? <Ionicons name="lock-closed" size={18} color={C.ink3} /> : null}
              </View>
              <Txt v="title" style={{ fontSize: 23, lineHeight: 26 }}>{m.title}</Txt>
              <Txt v="small" tone="ink2">{m.short}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt v="small" tone="ink3" style={{ textAlign: 'center' }}>Results are a guide for skilled tradespeople. Check every cut and fit-up on the job.</Txt>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: SPACE.md, borderRadius: 22, borderWidth: 1.5, borderColor: C.accent },
  welcome: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.md, overflow: 'hidden' },
  tile: { minHeight: 168, backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: 6, borderWidth: 1, borderColor: C.line },
});
