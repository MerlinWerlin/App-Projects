/**
 * Tools: the roof you're on, then every calculator in job order (measure → order → drainage), each row showing its
 * live figure for this roof so the home screen is already an answer sheet.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trimRuns, trims } from '../../src/core/flashing';
import { roofGeometry } from '../../src/core/geometry';
import { sheets } from '../../src/core/sheets';
import { grouped } from '../../src/core/units';
import { flag } from '../../src/data';
import { CAPTURE, useApp } from '../../src/state/AppState';
import { roofReady, type ToolId } from '../../src/state/model';
import { RADIUS, SPACE, TOUCH, TYPE } from '../../src/theme/theme';
import { tap, Txt } from '../../src/ui/kit';
import { RoofCard, SafetyLine } from '../../src/ui/parts';

interface Tool { id: ToolId; title: string; icon: keyof typeof Ionicons.glyphMap; value?: string | null; sub: string }

export default function Tools() {
  const app = useApp();
  const { theme, country, prefs, roof, ctx } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const w = country.terms;
  const big = (s: string) => s[0]!.toUpperCase() + s.slice(1);

  // Live figures for the current roof (pure, cheap; recomputed only when the roof or units change).
  const live = useMemo(() => {
    if (!roofReady(roof)) return null;
    const g = roofGeometry(roof, ctx);
    if (!g.ok) return null;
    const p = country.sheets[0];
    const s = p ? sheets({ planes: g.value.planes, pitchDeg: roof.pitchDeg, coverWidthMm: p.coverMm, overhangMm: country.defaults.overhangMm, ridgeAllowanceMm: 0, maxSheetMm: country.defaults.maxSheetMm, endLapMm: p.endLapMm ?? 0 }, ctx) : null;
    const t = trims({ runs: trimRuns(g.value, ctx), stockMm: country.defaults.trimStockMm, lapMm: country.defaults.trimLapMm, wastePct: 0 }, ctx);
    const tile = country.tiles.find(x => x.tilesPerM2);
    return {
      area: ctx.area(g.value.roofAreaM2).replace(/ \(.*\)$/, ''),
      rafter: ctx.len(g.value.rafterMm),
      sheets: s?.ok ? `${grouped(s.value.sheets)} sheets` : null,
      tiles: tile?.tilesPerM2 ? `≈ ${grouped(Math.ceil(g.value.roofAreaM2 * tile.tilesPerM2))}` : null,
      squares: ctx.sys === 'imperial' ? `${grouped((g.value.roofAreaM2 * 10.7639) / 100, 1)} sq` : null,
      trims: t.ok ? `${grouped(t.value.pieces)} pcs` : null,
      fall: ctx.len(g.value.lengthMm / country.drainage.fallRatio),
    };
  }, [roof, ctx, country]);

  const groups: { title: string; tools: Tool[] }[] = [
    { title: 'Measure', tools: [
      { id: 'pitch', title: 'Pitch', icon: 'triangle-outline', value: roofReady(roof) ? ctx.pitch(roof.pitchDeg) : null, sub: prefs.pitchStyle === 'x12' ? 'Rise and run, x:12 and degrees' : 'Rise and run, degrees and x:12' },
      { id: 'level', title: 'Phone level', icon: 'phone-portrait-outline', sub: 'Lay it on a rafter or sheet' },
      { id: 'roof', title: 'Roof area', icon: 'home-outline', value: live?.area, sub: 'Gable, hip and skillion' },
      { id: 'rafter', title: 'Rafters, hips & valleys', icon: 'git-merge-outline', value: live?.rafter, sub: 'True lengths with overhang' },
    ] },
    { title: 'Order', tools: [
      ...(country.sheets.length || !country.guided ? [{ id: 'sheets' as const, title: 'Sheets', icon: 'reorder-four-outline' as const, value: live?.sheets, sub: 'Count and cut list' }] : []),
      ...(country.tiles.length || !country.guided ? [{ id: 'tiles' as const, title: `Tiles & ${w.battens}`, icon: 'apps-outline' as const, value: live?.tiles, sub: 'Gauge, courses, capping' }] : []),
      ...(country.shingles.length ? [{ id: 'shingles' as const, title: 'Shingles', icon: 'layers-outline' as const, value: live?.squares, sub: 'Bundles, starter, nails' }] : []),
      { id: 'flashings', title: 'Flashings & cappings', icon: 'analytics-outline', value: live?.trims, sub: `${big(w.ridge)}, ${w.barge}s, ${w.valley}s` },
      { id: 'fixings', title: 'Fixings', icon: 'construct-outline', sub: 'Screws, clips and nails by the box' },
    ] },
    { title: 'Drainage', tools: [
      { id: 'fall', title: `${big(w.gutter)} fall`, icon: 'trending-down-outline', value: live?.fall, sub: `1:${country.drainage.fallRatio} over the run` },
      { id: 'downpipes', title: big(w.downpipes), icon: 'rainy-outline', sub: 'How many, by the local method' },
    ] },
  ];

  const trialText = app.owned || CAPTURE ? null : app.trial.active ? `Free trial · ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : app.trial.started ? 'Trial ended · unlock to keep every tool' : 'Try every tool free for 7 days';
  return (
    <ScrollView style={{ backgroundColor: theme.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl, gap: SPACE.md }}>
      <View style={st.head}>
        <Text style={[TYPE.display, { color: theme.ink, flex: 1 }]} accessibilityRole="header">Eaveline</Text>
        <Pressable testID="country-chip" accessibilityRole="button" accessibilityLabel={`Country: ${country.name}. Change`} onPress={() => router.push('/onboarding')}
          hitSlop={8} style={({ pressed }) => [st.chip, { borderColor: theme.ink, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <Text style={TYPE.headline}>{flag(country.code)}</Text>
          <Txt v="headline">{country.guided ? country.code : 'Other'}</Txt>
        </Pressable>
      </View>
      <RoofCard />
      {trialText ? (
        <Pressable testID="trial-banner" accessibilityRole="button" onPress={() => router.push('/unlock')}
          style={({ pressed }) => [st.trial, { backgroundColor: theme.ink, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <Ionicons name={app.trial.active ? 'time-outline' : 'lock-open-outline'} size={22} color={theme.accent} />
          <Txt v="headline" style={{ color: theme.ground, flex: 1 }}>{trialText}</Txt>
          <Ionicons name="chevron-forward" size={20} color={theme.ground} />
        </Pressable>
      ) : null}
      {groups.map(gr => (
        <View key={gr.title} style={{ gap: SPACE.xs }}>
          <Txt v="title2" accessibilityRole="header" style={{ marginTop: SPACE.xs }}>{gr.title}</Txt>
          <View style={[st.group, { backgroundColor: theme.sheet, borderColor: theme.line }]}>
            {gr.tools.map((t, i) => {
              const locked = !app.can(t.id);
              return (
                <Pressable key={t.id} testID={`tool-${t.id}`} accessibilityRole="button"
                  accessibilityLabel={`${t.title}${t.value && !locked ? `, ${t.value}` : ''}. ${t.sub}${locked ? '. Part of the Full Unlock' : ''}`}
                  onPress={() => { tap(prefs.haptics); router.push(`/${t.id}` as Href); }}
                  style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.line }, pressed && { backgroundColor: theme.sheet2 }]}>
                  <View style={[st.icon, { backgroundColor: theme.sheet2 }]}>
                    <Ionicons name={t.icon} size={24} color={theme.ink} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt v="headline">{t.title}</Txt>
                    <Txt v="footnote" tone="ink3">{t.sub}</Txt>
                  </View>
                  {locked
                    ? <Ionicons name="lock-closed" size={18} color={theme.ink3} />
                    : t.value ? <Text style={[TYPE.title2, st.value, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.4}>{t.value}</Text> : null}
                  <Ionicons name="chevron-forward" size={18} color={theme.ink3} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <SafetyLine />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xxs, borderWidth: 2, borderRadius: 999, paddingHorizontal: SPACE.sm, minHeight: 44 },
  trial: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.m, paddingHorizontal: SPACE.md, minHeight: TOUCH.big },
  group: { borderRadius: RADIUS.l, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: TOUCH.huge + 8, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  icon: { width: 44, height: 44, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center' },
  value: { fontVariant: ['tabular-nums'], maxWidth: '42%' },
});
