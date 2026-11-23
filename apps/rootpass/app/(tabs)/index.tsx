import { Icon } from '../../src/ui/Icon.tsx';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/state/AppState.tsx';
import { Glyph } from '../../src/ui/Glyph.tsx';
import { Txt } from '../../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../../src/ui/theme.ts';
import { TOOL_META } from '../../src/ui/tools.ts';
import { SaddleCurve } from '../../src/ui/Art.tsx';
import type { ToolId } from '../../src/plus/entitlement.ts';

const GROUPS: { title: string; tools: ToolId[] }[] = [
  { title: 'Fabrication', tools: ['lobster', 'frame', 'cutlist', 'pcd'] },
  { title: 'Materials', tools: ['weight', 'weld', 'bend'] },
];

export default function Tools() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
            <Icon name="flash" size={16} color={C.accent} />
            <Txt v="label" tone="accent">{trial.active ? `Trial: ${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'}` : 'Unlock'}</Txt>
          </Pressable>
        ) : null}
      </View>

      <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel={`Set up for ${app.country.name}. Change country`} style={st.where}>
        <Icon name="location" size={18} color={C.ink2} />
        <Txt v="small" tone="ink2" style={{ flex: 1 }}>Set up for {app.country.name}{app.country.standards ? ` · ${app.country.standards.hollow} sizes` : ' · common sizes'}</Txt>
        <Txt v="small" tone="accent">Change</Txt>
      </Pressable>

      <Pressable
        onPress={() => router.push('/tool/saddle')}
        accessibilityRole="button"
        accessibilityLabel={app.sp(`${TOOL_META.saddle.title}. ${TOOL_META.saddle.short}${app.can('saddle') ? '' : '. In Full Unlock'}`)}
        style={({ pressed }) => [st.feature, { opacity: pressed ? 0.9 : 1 }]}
      >
        <SaddleCurve width={width - SPACE.gutter * 2 - 2} />
        <View style={{ padding: SPACE.lg, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
            <Txt v="title" style={{ flex: 1 }}>{TOOL_META.saddle.title}</Txt>
            {!app.can('saddle') ? <Icon name="lock" size={18} color={C.ink3} /> : <Icon name="chevronRight" size={18} color={C.ink3} />}
          </View>
          <Txt v="body" tone="ink2">Fishmouth templates for any angle, size and offset. Print true scale and wrap them round the pipe.</Txt>
        </View>
      </Pressable>

      {GROUPS.map(g => (
        <View key={g.title} style={{ gap: SPACE.sm }}>
          <Txt v="label" tone="ink3" accessibilityRole="header">{g.title}</Txt>
          <View style={st.group}>
            {g.tools.map((id, k) => {
              const m = TOOL_META[id];
              const locked = !app.can(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => router.push(`/tool/${id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={app.sp(`${m.title}. ${m.short}${locked ? '. In Full Unlock' : ''}`)}
                  style={({ pressed }) => [st.row, k > 0 && st.rowLine, pressed && { backgroundColor: C.raised }]}
                >
                  <Glyph tool={id} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt v="headline" style={{ fontSize: 18 }}>{m.title}</Txt>
                    <Txt v="small" tone="ink2">{m.short}</Txt>
                  </View>
                  <Icon name={locked ? 'lock' : 'chevronRight'} size={17} color={C.ink3} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Txt v="small" tone="ink3" style={{ textAlign: 'center' }}>Results are a guide for skilled tradespeople. Check every cut and fit-up on the job.</Txt>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: SPACE.md, borderRadius: 22, borderWidth: 1.5, borderColor: C.accent },
  where: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 44, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, backgroundColor: C.surface },
  feature: { backgroundColor: C.surface, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  group: { backgroundColor: C.surface, borderRadius: RADIUS.lg, overflow: 'hidden' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
});
