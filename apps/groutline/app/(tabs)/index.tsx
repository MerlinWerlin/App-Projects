// Tools home. The tool used most (Tiles, free) leads as a card with a small set-out drawing; the rest sit in one grouped
// list; the last saved job is one tap away at the top. Orange is kept for the answer and actions, not decoration.
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect } from 'react-native-svg';
import type { ToolId } from '../../src/plus/entitlement.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE, TAP, useTheme } from '../../src/theme/theme.ts';
import { plural } from '../../src/ui/fields.tsx';
import { GroutMark } from '../../src/ui/GroutMark.tsx';
import { Icon, type IconName } from '../../src/ui/Icon.tsx';
import { PressScale, Txt } from '../../src/ui/kit.tsx';
import { TOOL_NAMES } from '../../src/ui/ToolScreen.tsx';

type Words = { box: string; setOut: string; waterproofing: string; falls: string; waste: string; trim: string };
const REST: Array<{ id: ToolId; title: string; sub: (w: Words) => string; icon: IconName }> = [
  { id: 'setout', title: 'Set-out', sub: () => 'Centre the grid, no thin cuts', icon: 'setout' },
  { id: 'materials', title: 'Grout, adhesive & membrane', sub: w => `Bags and packs, ${w.waterproofing.toLowerCase()} take-off`, icon: 'materials' },
  { id: 'falls', title: 'Falls to waste', sub: w => `Perimeter height above the ${w.waste}`, icon: 'falls' },
  { id: 'trim', title: 'Trim & edging', sub: w => `${w.trim} lengths with a cut list`, icon: 'trim' },
  { id: 'stairs', title: 'Stairs & steps', sub: () => 'Treads, risers, nosings', icon: 'stairs' },
];

/** A tiny set-out plan: full tiles, cut edges, the centre lines. */
function MiniPlan({ full, cut, ink, accent }: { full: string; cut: string; ink: string; accent: string }) {
  const s = 84, g = 3, c = 11, f = (s - 2 * c - 3 * g) / 2;
  const pos = [[0, c], [c + g, f], [c + g + f + g, f], [s - c, c]] as const;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={s} height={s}>
        <Rect x={0} y={0} width={s} height={s} rx={8} fill={ink} />
        {pos.map(([x, w], i) => pos.map(([y, h], j) => (
          <Rect key={`${i}${j}`} x={x} y={y} width={w} height={h} rx={2} fill={i > 0 && i < 3 && j > 0 && j < 3 ? full : cut} />
        )))}
        <Line x1={s / 2} y1={0} x2={s / 2} y2={s} stroke={accent} strokeWidth={3} />
        <Line x1={0} y1={s / 2} x2={s} y2={s / 2} stroke={accent} strokeWidth={3} />
      </Svg>
    </View>
  );
}

export default function Tools() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const w = app.country.terms;
  const last = app.jobs[0];
  const trialLine = !app.owned && app.trial.active ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : null;
  return (
    <ScrollView style={{ backgroundColor: t.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
        <GroutMark size={36} />
        <Txt v="large" accessibilityRole="header" style={{ flex: 1 }}>Groutline</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={`Country: ${app.country.name}, ${app.system === 'metric' ? 'metric' : 'imperial'}. Change`} onPress={() => router.push('/country')} hitSlop={6}
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.chip, backgroundColor: t.sheet, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}>
          {app.country.code === 'XX' ? <Icon name="globe" size={16} color={t.ink} /> : <Txt v="headline">{app.country.flag}</Txt>}
          <Txt v="subhead" tone="ink2">{app.system === 'metric' ? 'mm' : 'ft-in'}</Txt>
        </Pressable>
      </View>
      {trialLine ? <Txt v="subhead" tone="ink2" style={{ marginTop: SPACE.xs }}>{trialLine}</Txt> : null}

      {last ? (
        <PressScale accessibilityRole="button" accessibilityLabel={`Carry on with ${last.name}: ${last.summary.join(', ')}`}
          onPress={() => router.push(`/tool/${last.tool}?job=${encodeURIComponent(last.id)}` as Href)}
          style={[s.row, { marginTop: SPACE.lg, backgroundColor: t.sheet, borderRadius: RADIUS.card, paddingVertical: SPACE.sm }]}>
          <View style={{ flex: 1 }}>
            <Txt v="footnote" tone="ink2" style={{ fontWeight: '600' }}>{`Carry on · ${TOOL_NAMES[last.tool]}`}</Txt>
            <Txt v="headline" numberOfLines={1}>{last.name}</Txt>
            <Txt v="subhead" tone="ink2" numberOfLines={1}>{last.summary.join(' · ')}</Txt>
          </View>
          <Icon name="chevronRight" size={14} color={t.ink3} />
        </PressScale>
      ) : null}

      <PressScale accessibilityRole="button" accessibilityLabel={`Tiles and ${plural(w.box, 2)}. Floor or wall, cut-outs, waste by layout. Free`}
        onPress={() => router.push('/tool/tiles')}
        style={{ marginTop: SPACE.md, backgroundColor: t.sheet, borderRadius: RADIUS.card, padding: SPACE.md, flexDirection: 'row', gap: SPACE.md, alignItems: 'center', borderWidth: 2, borderColor: t.accent }}>
        <MiniPlan full={t.dark ? '#D9D4CA' : '#F5F1E9'} cut={t.dark ? '#B86B3C' : '#FFBE96'} ink={t.dark ? '#0B0C0E' : '#464A50'} accent={t.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="title2">Tiles & boxes</Txt>
          <Txt v="subhead" tone="ink2">{`Floor or wall, cut-outs, waste by layout, ${plural(w.box, 2)} to buy`}</Txt>
          <Txt v="footnote" style={{ color: t.dark ? t.accent : t.warn, fontWeight: '700', marginTop: 2 }}>Free</Txt>
        </View>
      </PressScale>

      <View style={{ marginTop: SPACE.md, backgroundColor: t.sheet, borderRadius: RADIUS.card, overflow: 'hidden' }}>
        {REST.map((tool, i) => {
          const locked = !app.canUse(tool.id);
          return (
            <Pressable key={tool.id} accessibilityRole="button" accessibilityLabel={`${tool.title}. ${tool.sub(w)}${locked ? '. In Full Unlock' : ''}`}
              onPress={() => router.push(`/tool/${tool.id}` as Href)}
              style={({ pressed }) => [s.row, { backgroundColor: pressed ? t.sunk : 'transparent' }]}>
              <View style={[s.glyph, { backgroundColor: t.sunk }]}><Icon name={tool.icon} size={20} color={t.ink} /></View>
              <View style={{ flex: 1, paddingVertical: SPACE.sm, borderBottomWidth: i < REST.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.line, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <View style={{ flex: 1 }}>
                  <Txt v="headline">{tool.title}</Txt>
                  <Txt v="subhead" tone="ink2">{tool.sub(w)}</Txt>
                </View>
                <Icon name={locked ? 'lock' : 'chevronRight'} size={14} color={t.ink3} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {!app.unlocked ? (
        <PressScale accessibilityRole="button" onPress={() => router.push('/unlock')} style={{ marginTop: SPACE.md, borderRadius: RADIUS.card, backgroundColor: t.ink, padding: SPACE.md }}>
          <Txt v="headline" style={{ color: t.ground }}>{app.trial.started ? 'Full Unlock: every tool, one payment' : 'Try every tool free for 7 days'}</Txt>
          <Txt v="subhead" style={{ color: t.ground, opacity: 0.8 }}>No subscription. Nothing is charged automatically.</Txt>
        </PressScale>
      ) : null}
      <Txt v="footnote" tone="ink3" style={{ marginTop: SPACE.lg }}>
        Quantities are estimates from the makers' published coverage. Check the product data sheet and your local rules before you order.
      </Txt>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { minHeight: TAP + 8, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  glyph: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
