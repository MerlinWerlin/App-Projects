/**
 * First launch: "Where do you work?" Device region preselected; one tap to confirm. Also used from Settings.
 * Inset grouped list with large rows (gloves), a check on the chosen row, one primary action at thumb height.
 */
import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES, COUNTRY_ORDER, countryFromRegion, type CountryCode } from '../core/country';
import { useApp } from '../state/AppState';
import { BOLD, FONT, RADIUS, SPACE, TARGET } from '../theme/theme';
import { Button, Icon, ScreedLine, T } from './kit';

function deviceCountry(): CountryCode {
  try { return countryFromRegion(getLocales()[0]?.regionCode); } catch { return 'XX'; }
}

const detail = (c: CountryCode) => {
  const p = COUNTRIES[c];
  const units = p.units === 'imperial' ? 'ft, in, yd³' : 'm, mm, m³';
  if (!p.verified) return `${units} · generic sizes`;
  const mesh = p.mesh.slice(0, 2).map(m => m.id.replace(/-.*/, '')).join(', ');
  const bars = p.bars.map(b => b.label.split(' ')[0]).join(', ');
  return `${units} · ${mesh} mesh · ${bars} bar`;
};

export function CountryPicker({ onDone, firstRun }: { onDone: (c: CountryCode) => void; firstRun?: boolean }) {
  const { theme, prefs } = useApp();
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<CountryCode>(prefs.country ?? deviceCountry());
  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
      <ScrollView contentContainerStyle={{ paddingTop: firstRun ? insets.top + SPACE.xl : SPACE.l, paddingHorizontal: SPACE.l, paddingBottom: SPACE.xl }}>
        {firstRun ? (
          <View style={{ gap: SPACE.s, marginBottom: SPACE.xl }}>
            <ScreedLine theme={theme} width={56} />
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontFamily: FONT.numBold, fontSize: 44, lineHeight: 48, color: theme.ink }}>Where do you work?</Text>
            <T>Units, the sizes you can buy and the rules in notes follow your country. You can change it in Settings.</T>
          </View>
        ) : (
          <T style={{ marginBottom: SPACE.l }}>Units, product sizes and notes follow your country. Changing it resets unsaved tool inputs; saved jobs stay as they are.</T>
        )}
        <View accessibilityRole="radiogroup" style={{ borderRadius: RADIUS.m, overflow: 'hidden', borderWidth: theme.name === 'sun' ? theme.borderWidth : StyleSheet.hairlineWidth, borderColor: theme.line }}>
          {COUNTRY_ORDER.map((c, i) => {
            const on = c === chosen;
            return (
              <Pressable
                key={c}
                testID={`country-${c}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${COUNTRIES[c].name}. ${detail(c)}`}
                onPress={() => setChosen(c)}
                style={({ pressed }) => ({ minHeight: TARGET + 16, flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, backgroundColor: pressed ? theme.cardAlt : theme.card, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: theme.line })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text maxFontSizeMultiplier={1.8} style={{ ...BOLD, fontSize: 19, color: theme.ink }}>{COUNTRIES[c].name}</Text>
                  <T kind="small">{detail(c)}</T>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: on ? 0 : 2, borderColor: theme.fieldLine, backgroundColor: on ? theme.amber : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="check-bold" size={18} color={theme.onAmber} weight="bold" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: SPACE.l, paddingTop: SPACE.m, paddingBottom: insets.bottom + SPACE.m, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line, backgroundColor: theme.ground }}>
        <Button testID="country-continue" label={firstRun ? `Continue with ${COUNTRIES[chosen].name}` : 'Use this country'} onPress={() => onDone(chosen)} />
      </View>
    </View>
  );
}
