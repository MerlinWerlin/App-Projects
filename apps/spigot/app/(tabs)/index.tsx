import React from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CAPTURE, useApp } from '../../src/state/AppState';
import { TOOLS, isLocked, toolHref, toolInfo, toolTitle } from '../../src/ui/tools';
import { useCountry } from '../../src/country/useCountry';
import { Button, H, useTap } from '../../src/ui/kit';
import { font, radius, space, usePalette } from '../../src/ui/theme';
import { ART } from '../../src/ui/art';
import { ToolArt } from '../../src/ui/ToolArt';

function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function ToolsHome() {
  const c = usePalette();
  const app = useApp();
  const country = useCountry();
  const insets = useSafeAreaInsets();
  const tap = useTap();
  const { width, fontScale } = useWindowDimensions();
  const cols = width / fontScale < 330 ? 1 : 2;
  const recents = app.records.filter(r => r.jobId === null).slice(0, 6);
  const status = app.owned || CAPTURE ? null : app.trial.active ? (app.trial.daysLeft === 1 ? 'Last day of your free trial' : `Free trial: ${app.trial.daysLeft} days left`) : app.trial.started ? 'Trial ended. Offset, Fall and Reference stay free' : 'Try every tool free for 7 days';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + space.m, paddingHorizontal: space.l, paddingBottom: space.xxl, gap: space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Image source={ART.mark} style={{ width: 44, height: 44, borderRadius: 10 }} accessibilityIgnoresInvertColors accessible={false} />
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: font.displayHeavy, fontSize: 40, letterSpacing: 1, color: c.ink }}>SPIGOT</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Units: ${app.prefs.unit === 'metric' ? 'millimetres' : 'inches'}. Tap to switch`} onPress={() => { tap(); app.setPrefs({ unit: app.prefs.unit === 'metric' ? 'imperial' : 'metric' }); }}
          style={{ minHeight: 44, minWidth: 64, paddingHorizontal: space.m, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.display, fontSize: 20, color: c.bg }}>{app.prefs.unit === 'metric' ? 'MM' : 'INCH'}</Text>
        </Pressable>
      </View>

      {!app.prefs.onboarded ? (
        <View style={{ backgroundColor: c.panel, borderRadius: radius.l, overflow: 'hidden' }}>
          <Image source={ART.welcome} style={{ width: width - space.l * 2, height: Math.round(((width - space.l * 2) * 9) / 16) }} resizeMode="cover" accessible={false} />
          <View style={{ padding: space.l, gap: space.s }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 30, color: c.vis }}>MEASURE ONCE. CUT ONCE.</Text>
            <Text style={{ fontSize: 16, lineHeight: 22, color: c.onPanel2 }}>Offsets, cut lengths, fall, flow and cut lists, with the working shown. Everything stays on your phone.</Text>
            <Button label="Got it" onPress={() => app.setPrefs({ onboarded: true })} style={{ marginTop: space.s }} />
          </View>
        </View>
      ) : null}

      {status ? (
        <Pressable accessibilityRole="button" accessibilityLabel={status} onPress={() => router.push('/unlock')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: c.surface2, borderRadius: radius.m, padding: space.m, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name={app.trial.active ? 'time-outline' : 'lock-open-outline'} size={22} color={c.copper} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: c.ink }}>{status}</Text>
          <Ionicons name="chevron-forward" size={20} color={c.ink3} />
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m }}>
        {TOOLS.map(t => {
          const locked = isLocked(t.id, app.unlocked);
          return (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`${toolTitle(t.id, country)}. ${t.blurb}${locked ? '. Shows a sample; needs the free trial or Full Unlock' : ''}`}
              onPress={() => { tap(); router.push(toolHref(t.id)); }}
              style={({ pressed }) => ({ width: cols === 1 ? '100%' : '47.9%', flexGrow: 1, minHeight: 150, borderRadius: radius.l, padding: space.l, backgroundColor: t.free ? c.vis : c.surface, borderWidth: t.free ? 0 : 1, borderColor: c.line, gap: space.s, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ToolArt id={t.id} size={62} ink={t.free ? '#121417' : c.ink} />
                {locked ? <Ionicons name="lock-closed" size={20} color={c.ink3} /> : null}
              </View>
              <Text style={{ fontFamily: font.displayHeavy, fontSize: 28, lineHeight: 30, color: t.free ? c.onVis : c.ink, textTransform: 'uppercase' }}>{toolTitle(t.id, country)}</Text>
              <Text style={{ fontSize: 14, lineHeight: 19, color: t.free ? c.onVis : c.ink3 }}>{t.blurb}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H>Recent</H>
          {recents.length ? <Pressable accessibilityRole="button" hitSlop={12} onPress={() => app.clearRecents()}><Text style={{ color: c.copper, fontSize: 16, fontWeight: '600' }}>Clear</Text></Pressable> : null}
        </View>
        {recents.length ? recents.map(r => (
          <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${toolTitle(r.tool, country)}: ${r.summary}`} accessibilityHint="Opens this calculation again" onPress={() => router.push({ pathname: toolHref(r.tool), params: { record: r.id } })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: c.surface, borderRadius: radius.m, padding: space.m, minHeight: 60, opacity: pressed ? 0.8 : 1 })}>
            <Ionicons name={toolInfo(r.tool).icon} size={24} color={c.copper} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: c.ink }} numberOfLines={2}>{r.summary}</Text>
              <Text style={{ fontSize: 13, color: c.ink3 }}>{toolTitle(r.tool, country)} · {ago(r.createdAt)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.ink3} />
          </Pressable>
        )) : (
          <View style={{ alignItems: 'center', padding: space.l, gap: space.s }}>
            <Image source={ART.empty} style={{ width: 160, height: 120 }} resizeMode="contain" accessible={false} />
            <Text style={{ fontSize: 16, color: c.ink3, textAlign: 'center' }}>Your last calculations show up here, ready to reopen.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
