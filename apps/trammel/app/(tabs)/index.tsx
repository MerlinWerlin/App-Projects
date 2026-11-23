// Tools: every calculator, grouped the way a job runs (frame, roof, trim, set-out). Paid tools show a lock until the
// trial starts; free ones never do. No paywall or prompt on first launch.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOOLS, type ToolId } from '../../src/core/tools.ts';
import { useAccess } from '../../src/state/access.ts';
import { fonts, radius, space, useTheme } from '../../src/theme/theme.ts';

const ICONS: Record<ToolId, keyof typeof Ionicons.glyphMap> = {
  stairs: 'stats-chart',
  layout: 'barcode-outline',
  decking: 'reorder-four',
  cutlist: 'cut',
  rafter: 'triangle-outline',
  hip: 'git-merge-outline',
  pitch: 'trending-up',
  mitre: 'contract-outline',
  crown: 'shapes-outline',
  square: 'scan-outline',
  arc: 'radio-button-off',
  convert: 'swap-horizontal',
};

const GROUPS = ['Frame', 'Roof', 'Trim', 'Set-out'] as const;

export default function Tools() {
  const t = useTheme();
  const a = useAccess();
  const insets = useSafeAreaInsets();
  const locked = (free: boolean) => !free && !a.canEdit;
  const status =
    a.state === 'trial'
      ? `Free trial: ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`
      : a.state === 'expired'
        ? 'Trial finished. Free tools still open.'
        : a.state === 'new'
          ? 'Try every tool free for 7 days'
          : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + space.m, paddingHorizontal: space.l, paddingBottom: space.xxl, gap: space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 52, height: 52, borderRadius: 12 }} accessibilityIgnoresInvertColors />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 44, color: t.ink, letterSpacing: 0.5 }}>
            TRAMMEL
          </Text>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: t.muted }}>The chippy’s calculator. Every step shown.</Text>
        </View>
      </View>
      {status ? (
        <Pressable onPress={() => router.push('/paywall')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: t.blade, borderRadius: radius.m, minHeight: 52, paddingHorizontal: space.l, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name={a.state === 'trial' ? 'time-outline' : 'lock-open-outline'} size={22} color={t.bladeInk} />
          <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: t.bladeInk }}>{status}</Text>
          <Ionicons name="chevron-forward" size={20} color={t.bladeInk} />
        </Pressable>
      ) : null}
      {GROUPS.map((g) => (
        <View key={g} style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 18, letterSpacing: 1.2, textTransform: 'uppercase', color: t.muted }}>
            {g}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m }}>
            {TOOLS.filter((x) => x.group === g).map((tool) => {
              const lock = locked(tool.free);
              return (
                <Pressable
                  key={tool.id}
                  onPress={() => router.push(`/${tool.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tool.name}. ${tool.blurb}${lock ? '. Locked, part of Full Unlock' : ''}`}
                  style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', minHeight: 120, borderRadius: radius.l, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, padding: space.m, gap: space.s, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: t.blade, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={ICONS[tool.id]} size={24} color={t.bladeInk} />
                    </View>
                    {lock ? <Ionicons name="lock-closed" size={18} color={t.muted} /> : tool.free ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: t.ok }}>FREE</Text> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.display, fontSize: 21, lineHeight: 23, color: t.ink }}>{tool.name}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 19, color: t.muted }}>{tool.blurb}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
