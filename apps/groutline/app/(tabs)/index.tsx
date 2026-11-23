// Tools home: big tiles for each calculator. Tile count is free; the rest show a lock until the trial or Full Unlock.
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ToolId } from '../../src/plus/entitlement.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE, useTheme } from '../../src/theme/theme.ts';
import { GroutMark } from '../../src/ui/GroutMark.tsx';
import { Txt } from '../../src/ui/kit.tsx';

const TOOLS: Array<{ id: ToolId; title: string; sub: (w: Words) => string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'tiles', title: 'Tiles & boxes', sub: w => `Floor or wall, cut-outs, waste by layout, ${w.box}s to buy`, icon: 'grid-outline' },
  { id: 'setout', title: 'Set-out', sub: w => `Centre the grid, no thin cuts, ${w.setOut.toLowerCase()} diagram`, icon: 'scan-outline' },
  { id: 'materials', title: 'Grout, adhesive & membrane', sub: w => `Bags and packs from joint, notch and ${w.waterproofing.toLowerCase()}`, icon: 'flask-outline' },
  { id: 'falls', title: 'Falls to waste', sub: w => `${w.falls} to the ${w.waste}, perimeter heights`, icon: 'water-outline' },
  { id: 'trim', title: 'Trim & edging', sub: w => `${w.trim} lengths with a cut list`, icon: 'remove-outline' },
  { id: 'stairs', title: 'Stairs & steps', sub: () => 'Treads, risers, nosings, riser check', icon: 'stats-chart-outline' },
];
type Words = { box: string; setOut: string; waterproofing: string; falls: string; waste: string; trim: string };

export default function Tools() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const w = app.country.terms;
  const trialLine = !app.owned && app.trial.active ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : null;
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
        <GroutMark size={40} />
        <Txt v="large" accessibilityRole="header" style={{ flex: 1 }}>Groutline</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={`Country: ${app.country.name}. Change`} onPress={() => router.push('/country')}
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.chip, backgroundColor: t.sheet, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}>
          <Txt v="headline">{app.country.flag}</Txt>
          <Txt v="subhead" tone="ink2">{app.system === 'metric' ? 'mm' : 'ft-in'}</Txt>
        </Pressable>
      </View>
      {trialLine ? <Txt v="subhead" tone="ink2" style={{ marginTop: SPACE.xs }}>{trialLine}</Txt> : null}
      <View style={{ marginTop: SPACE.lg, gap: SPACE.sm }}>
        {TOOLS.map((tool, i) => {
          const locked = !app.canUse(tool.id);
          const hero = i === 0;
          return (
            <Pressable key={tool.id} accessibilityRole="button" accessibilityLabel={`${tool.title}. ${tool.sub(w)}${locked ? '. In Full Unlock' : ''}`}
              onPress={() => router.push(`/tool/${tool.id}` as Href)}
              style={({ pressed }) => ({ borderRadius: RADIUS.card, backgroundColor: hero ? t.accent : t.sheet, padding: SPACE.md, minHeight: hero ? 132 : 88, flexDirection: 'row', alignItems: hero ? 'flex-end' : 'center', gap: SPACE.md, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: hero ? t.onAccent : t.sunk, alignItems: 'center', justifyContent: 'center', alignSelf: hero ? 'flex-start' : 'center' }}>
                <Ionicons name={tool.icon} size={28} color={hero ? t.accent : t.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v={hero ? 'title' : 'title2'} style={{ color: hero ? t.onAccent : t.ink }}>{tool.title}</Txt>
                <Txt v="subhead" style={{ color: hero ? t.onAccent : t.ink2 }}>{tool.sub(w)}</Txt>
              </View>
              <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={22} color={hero ? t.onAccent : t.ink3} />
            </Pressable>
          );
        })}
      </View>
      {!app.unlocked ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/unlock')} style={({ pressed }) => ({ marginTop: SPACE.lg, borderRadius: RADIUS.card, backgroundColor: t.ink, padding: SPACE.md, opacity: pressed ? 0.9 : 1 })}>
          <Txt v="headline" style={{ color: t.ground }}>{app.trial.started ? 'Full Unlock: every tool, one payment' : 'Try every tool free for 7 days'}</Txt>
          <Txt v="subhead" style={{ color: t.ground, opacity: 0.8 }}>No subscription. Nothing is charged automatically.</Txt>
        </Pressable>
      ) : null}
      <Txt v="footnote" tone="ink3" style={{ marginTop: SPACE.lg }}>
        Quantities are estimates from the makers' published coverage. Check the product data sheet and your local rules before you order.
      </Txt>
    </ScrollView>
  );
}
