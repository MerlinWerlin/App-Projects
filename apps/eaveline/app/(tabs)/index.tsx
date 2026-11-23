/** Tools: the roof you're on, then every calculator as a big tile. */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flag } from '../../src/data';
import { CAPTURE, useApp } from '../../src/state/AppState';
import { isFreeTool as isFree, type ToolId } from '../../src/state/model';
import { RADIUS, SPACE, TYPE } from '../../src/theme/theme';
import { tap, Txt } from '../../src/ui/kit';
import { RoofCard, SafetyLine } from '../../src/ui/parts';

interface Tile { id: ToolId; title: string; sub: string; icon: keyof typeof Ionicons.glyphMap }

export default function Tools() {
  const app = useApp();
  const { theme, country, prefs } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const w = country.terms;
  const big = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const tiles: Tile[] = [
    { id: 'pitch', title: 'Pitch', sub: prefs.pitchStyle === 'x12' ? 'Rise/run, x:12, degrees' : 'Rise/run, degrees, ratio', icon: 'triangle-outline' },
    { id: 'level', title: 'Phone level', sub: 'Lay it on a rafter', icon: 'phone-portrait-outline' },
    { id: 'roof', title: 'Roof area', sub: 'Gable, hip, skillion', icon: 'home-outline' },
    { id: 'rafter', title: 'Rafters & hips', sub: 'True lengths, valleys', icon: 'git-merge-outline' },
    ...(country.sheets.length || !country.guided ? [{ id: 'sheets' as const, title: 'Sheets', sub: 'Count and cut lengths', icon: 'reorder-four-outline' as const }] : []),
    ...(country.tiles.length || !country.guided ? [{ id: 'tiles' as const, title: `Tiles & ${w.battens}`, sub: 'Gauge, counts', icon: 'apps-outline' as const }] : []),
    ...(country.shingles.length ? [{ id: 'shingles' as const, title: 'Shingles', sub: 'Squares, bundles, nails', icon: 'layers-outline' as const }] : []),
    { id: 'flashings', title: 'Flashings', sub: `${big(w.ridge)}, ${w.barge}, ${w.valley}`, icon: 'analytics-outline' },
    { id: 'fall', title: `${big(w.gutter)} fall`, sub: `Fall over a run at 1:${country.drainage.fallRatio}`, icon: 'trending-down-outline' },
    { id: 'downpipes', title: big(w.downpipes), sub: 'How many (estimate)', icon: 'rainy-outline' },
    { id: 'fixings', title: 'Fixings', sub: 'Screws, clips, nails', icon: 'construct-outline' },
  ];
  const trialText = app.owned || CAPTURE ? null : app.trial.active ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : app.trial.started ? 'Trial ended · Unlock to keep every tool' : 'Try every tool free for 7 days';
  return (
    <ScrollView style={{ backgroundColor: theme.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xxl, gap: SPACE.md }}>
      <View style={st.head}>
        <Text style={[TYPE.display, { color: theme.ink, flex: 1 }]} accessibilityRole="header">Eaveline</Text>
        <Pressable testID="country-chip" accessibilityRole="button" accessibilityLabel={`Country: ${country.name}. Change`} onPress={() => router.push('/onboarding')}
          style={({ pressed }) => [st.chip, { borderColor: theme.ink, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={TYPE.headline}>{flag(country.code)}</Text>
          <Txt v="headline">{country.code === 'XX' ? 'Country' : country.code}</Txt>
        </Pressable>
      </View>
      <RoofCard />
      {trialText ? (
        <Pressable testID="trial-banner" accessibilityRole="button" onPress={() => router.push('/unlock')}
          style={({ pressed }) => [st.trial, { backgroundColor: theme.ink, opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name={app.trial.active ? 'time-outline' : 'lock-open-outline'} size={22} color={theme.accent} />
          <Txt v="headline" style={{ color: theme.ground, flex: 1 }}>{trialText}</Txt>
          <Ionicons name="chevron-forward" size={20} color={theme.ground} />
        </Pressable>
      ) : null}
      <View style={st.grid}>
        {tiles.map(t => {
          const locked = !app.can(t.id);
          return (
            <Pressable key={t.id} testID={`tool-${t.id}`} accessibilityRole="button" accessibilityLabel={`${t.title}. ${t.sub}${locked ? '. Part of the Full Unlock' : ''}`}
              onPress={() => { tap(prefs.haptics); router.push(`/${t.id}` as Href); }}
              style={({ pressed }) => [st.tile, { backgroundColor: theme.sheet, borderColor: theme.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <View style={[st.icon, { backgroundColor: isFree(t.id) ? theme.accent : theme.sheet2 }]}>
                <Ionicons name={t.icon} size={28} color={isFree(t.id) ? theme.onAccent : theme.ink} />
              </View>
              <View style={{ gap: 2 }}>
                <Txt v="title2" numberOfLines={2}>{t.title}</Txt>
                <Txt v="footnote" tone="ink3" numberOfLines={2}>{t.sub}</Txt>
              </View>
              {locked ? <Ionicons name="lock-closed" size={16} color={theme.ink3} style={st.lock} /> : null}
            </Pressable>
          );
        })}
      </View>
      <SafetyLine />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xxs, borderWidth: 2, borderRadius: 999, paddingHorizontal: SPACE.sm, minHeight: 44 },
  trial: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.m, paddingHorizontal: SPACE.md, minHeight: 56 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  tile: { width: '48.5%', flexGrow: 1, flexBasis: '45%', minHeight: 150, borderRadius: RADIUS.l, borderWidth: StyleSheet.hairlineWidth, padding: SPACE.md, gap: SPACE.sm, justifyContent: 'space-between' },
  icon: { width: 52, height: 52, borderRadius: RADIUS.m, alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: SPACE.md, right: SPACE.md },
});
