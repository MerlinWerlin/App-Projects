/** First launch: pick the country (device region pre-selected), confirm units, read the safety note. */
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryFor, countryList, flag } from '../src/data';
import { useApp } from '../src/state/AppState';
import { regionGuess, withCountry } from '../src/state/model';
import { RADIUS, SPACE, TOUCH, TYPE } from '../src/theme/theme';
import { Btn, Segmented, tap, Txt } from '../src/ui/kit';

const HERO = require('../assets/illustrations/onboarding.png');

function deviceRegion(): string | null {
  try {
    return regionGuess(Localization.getLocales()[0]?.regionCode ?? null);
  } catch {
    return null;
  }
}

export default function Onboarding() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [region] = useState(deviceRegion);
  const [code, setCode] = useState<string | null>(app.prefs.country ?? region);
  const [step, setStep] = useState<'country' | 'units'>('country');
  const [q, setQ] = useState('');
  const [sys, setSys] = useState(app.prefs.sys);
  const [pitch, setPitch] = useState(app.prefs.pitchStyle);
  const list = useMemo(() => {
    const all = countryList();
    const needle = q.trim().toLowerCase();
    const filtered = needle ? all.filter(c => c.name.toLowerCase().includes(needle) || c.code.toLowerCase() === needle) : all;
    // Device region on top so it's one tap.
    return region && !needle ? [...filtered.filter(c => c.code === region), ...filtered.filter(c => c.code !== region)] : filtered;
  }, [q, region]);

  const toUnits = () => {
    if (!code) return;
    const c = countryFor(code);
    setSys(c.sys);
    setPitch(c.pitchStyle);
    setStep('units');
  };
  const finish = () => {
    if (!code) return;
    app.setPrefs({ ...withCountry(app.prefs, code), sys, pitchStyle: pitch, safetySeen: true });
    tap(app.prefs.haptics, 'success');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (step === 'units' && code) {
    const c = countryFor(code);
    return (
      <View style={[st.wrap, { backgroundColor: theme.ground, paddingTop: insets.top + SPACE.md, paddingBottom: insets.bottom + SPACE.md }]}>
        <View style={{ gap: SPACE.lg, flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to countries" onPress={() => setStep('country')} style={st.back} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={theme.ink} />
          </Pressable>
          <Txt v="display" accessibilityRole="header">{flag(c.code)} {c.name}</Txt>
          {c.guided ? (
            <Txt v="body" tone="ink2">Eaveline will use {c.name}’s standards, trade words ({c.terms.gutter}, {c.terms.downpipe}, {c.terms.barge}) and a catalogue of the sheet profiles, tiles and {c.terms.gutters} local suppliers stock.</Txt>
          ) : (
            <Txt v="body" tone="ink2">There’s no local catalogue for {c.name} yet, so Eaveline works in metric with general guidance. You enter profiles, tiles and stock lengths from your supplier.</Txt>
          )}
          <Segmented label="Lengths" value={sys} onChange={setSys} options={[{ value: 'metric', label: 'Metric (mm, m)' }, { value: 'imperial', label: 'Feet & inches' }]} />
          <Segmented label="Pitch" value={pitch} onChange={setPitch} options={[{ value: 'deg', label: 'Degrees (°)' }, { value: 'x12', label: 'Rise : 12' }]} />
          <View style={[st.safety, { borderColor: theme.ink }]}>
            <View style={[st.stripe, { backgroundColor: theme.accent }]}><Ionicons name="warning" size={24} color={theme.onAccent} /></View>
            <View style={{ flex: 1, gap: SPACE.xxs, padding: SPACE.sm }}>
              <Txt v="headline">Before you go up</Txt>
              <Txt v="subhead" tone="ink2">{c.safety.text}</Txt>
              <Txt v="footnote" tone="ink3">Eaveline’s figures are estimates to plan and order with. Check them against the maker’s data and your local code.</Txt>
            </View>
          </View>
        </View>
        <Btn testID="onboarding-done" label="Start using Eaveline" onPress={finish} />
        <Txt v="footnote" tone="ink3" style={{ textAlign: 'center' }}>You can change the country and units any time in Settings.</Txt>
      </View>
    );
  }

  return (
    <View style={[st.wrap, { backgroundColor: theme.ground, paddingTop: insets.top + SPACE.sm, paddingBottom: insets.bottom + SPACE.md }]}>
      <View style={{ gap: SPACE.sm }}>
        <Image source={HERO} style={st.hero} resizeMode="cover" accessibilityIgnoresInvertColors accessible={false} />
        <Txt v="display" accessibilityRole="header">Where do you work?</Txt>
        <Txt v="body" tone="ink2">Your country sets the units, the standards and the materials Eaveline suggests.</Txt>
        <View style={[st.search, { backgroundColor: theme.field, borderColor: theme.fieldLine }]}>
          <Ionicons name="search" size={20} color={theme.ink3} />
          <TextInput testID="country-search" value={q} onChangeText={setQ} placeholder="Search countries" placeholderTextColor={theme.ink3}
            accessibilityLabel="Search countries" autoCorrect={false} style={[TYPE.body, { flex: 1, color: theme.ink, minHeight: TOUCH.min }]} />
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={c => c.code}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginTop: SPACE.sm }}
        contentContainerStyle={{ gap: SPACE.xs, paddingBottom: SPACE.md }}
        renderItem={({ item }) => {
          const on = item.code === code;
          return (
            <Pressable testID={`country-${item.code}`} accessibilityRole="radio" accessibilityState={{ selected: on }}
              accessibilityLabel={`${item.name}${item.guided ? ', fully guided' : ''}${item.code === region ? ', this phone’s region' : ''}`}
              onPress={() => { tap(app.prefs.haptics); setCode(item.code); }}
              style={({ pressed }) => [st.country, { backgroundColor: on ? theme.ink : theme.sheet, borderColor: on ? theme.ink : theme.line, opacity: pressed ? 0.85 : 1 }]}>
              <Txt v="title2" style={{ width: 40 }}>{flag(item.code)}</Txt>
              <View style={{ flex: 1 }}>
                <Txt v="headline" style={{ color: on ? theme.ground : theme.ink }}>{item.name}</Txt>
                {item.guided || item.code === region ? (
                  <Txt v="footnote" style={{ color: on ? theme.ground : theme.ink3 }}>
                    {[item.guided ? 'Fully guided: local standards and materials' : null, item.code === region ? 'This phone’s region' : null].filter(Boolean).join(' · ')}
                  </Txt>
                ) : null}
              </View>
              {on ? <Ionicons name="checkmark-circle" size={26} color={theme.dark ? theme.ground : theme.accent} /> : null}
            </Pressable>
          );
        }}
      />
      <Btn testID="onboarding-next" label={code ? `Continue with ${countryFor(code).name}` : 'Pick your country'} onPress={toUnits} disabled={!code} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: SPACE.gutter, gap: SPACE.sm },
  hero: { width: '100%', height: 150, borderRadius: RADIUS.l },
  search: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, borderRadius: RADIUS.s, borderWidth: 1.5, paddingHorizontal: SPACE.sm },
  country: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.m, borderWidth: 1, paddingHorizontal: SPACE.md, minHeight: TOUCH.big, paddingVertical: SPACE.xs },
  back: { width: TOUCH.min, height: TOUCH.min, justifyContent: 'center', marginLeft: -SPACE.xs },
  safety: { flexDirection: 'row', borderRadius: RADIUS.m, borderWidth: 2, overflow: 'hidden' },
  stripe: { width: 48, alignItems: 'center', justifyContent: 'center' },
});
