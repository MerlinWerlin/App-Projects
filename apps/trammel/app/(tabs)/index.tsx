// Tools: every calculator as an iOS inset grouped list, grouped the way a job runs (frame, roof, trim, set-out),
// named in the chosen country's trade words. Paid tools show a lock until the trial starts; free ones never do.
// No paywall or prompt here; the trial line only appears while there is something to say.
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localTool, TOOLS } from '../../src/core/tools.ts';
import { stairCodesFor } from '../../src/core/stairCodes.ts';
import { useAccess } from '../../src/state/access.ts';
import { useSettings } from '../../src/state/settings.tsx';
import { fonts, radius, space, useTheme, sys } from '../../src/theme/theme.ts';
import { Icon, type IconName } from '../../src/ui/Icon.tsx';

const GROUPS = ['Frame', 'Roof', 'Trim', 'Set-out'] as const;

export default function Tools() {
  const t = useTheme();
  const a = useAccess();
  const { country, settings } = useSettings();
  const insets = useSafeAreaInsets();
  const code = stairCodesFor(country.code)[0];
  const status =
    a.state === 'trial'
      ? `Free trial: ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`
      : a.state === 'expired'
        ? 'Trial finished. Free tools stay open'
        : a.state === 'new'
          ? 'Try every tool free for 7 days'
          : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + space.l, paddingHorizontal: space.l, paddingBottom: space.xxl, gap: space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 11 }} accessibilityIgnoresInvertColors />
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 44, color: t.ink, letterSpacing: 0 }}>
          TRAMMEL
        </Text>
      </View>
      <Pressable onPress={() => router.push('/country')} accessibilityRole="button" accessibilityHint="Change country" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s, opacity: pressed ? 0.6 : 1, marginTop: -space.s })}>
        <Icon name="globe" size={16} color={t.muted} />
        <Text style={{ flexShrink: 1, ...sys.body, fontSize: 15, color: t.muted }}>
          {country.name} · {settings.units === 'metric' ? 'metric' : 'imperial'} · {code.binding ? code.source.split(/,| \(/)[0] : 'comfort guide, no code'}
        </Text>
      </Pressable>
      {status ? (
        <Pressable onPress={() => router.push('/paywall')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: t.blade, borderRadius: radius.m, minHeight: 52, paddingHorizontal: space.l, opacity: pressed ? 0.8 : 1 })}>
          <Icon name={a.state === 'trial' ? 'time' : 'unlock'} size={20} color={t.bladeInk} />
          <Text style={{ flex: 1, ...sys.bodyBold, fontSize: 17, color: t.bladeInk }}>{status}</Text>
          <Icon name="chevron" size={16} color={t.bladeInk} />
        </Pressable>
      ) : null}
      {GROUPS.map((g) => (
        <View key={g} style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={{ ...sys.bodyBold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted, paddingHorizontal: space.s }}>
            {g}
          </Text>
          <View style={{ backgroundColor: t.card, borderRadius: radius.l, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
            {TOOLS.filter((x) => x.group === g).map((tool, i) => {
              const lock = !tool.free && !a.canEdit;
              const { name, blurb } = localTool(tool, country.terms);
              return (
                <Pressable
                  key={tool.id}
                  onPress={() => router.push(`/${tool.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}. ${blurb}${lock ? '. Locked, part of Full Unlock' : ''}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 68, paddingHorizontal: space.l, paddingVertical: space.s, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.sunk : 'transparent' })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: t.blade, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={tool.id as IconName} size={22} color={t.bladeInk} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 21, lineHeight: 24, color: t.ink }}>{name}</Text>
                    <Text style={{ ...sys.body, fontSize: 15, lineHeight: 19, color: t.muted }}>{blurb}</Text>
                  </View>
                  {lock ? <Icon name="lock" size={15} color={t.muted} /> : tool.free ? <Text style={{ ...sys.bodyBold, fontSize: 12, letterSpacing: 0.4, color: t.ok }}>FREE</Text> : null}
                  <Icon name="chevron" size={14} color={t.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
