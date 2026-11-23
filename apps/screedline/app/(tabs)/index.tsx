import { router } from 'expo-router';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/state/AppState';
import { CAPTURE } from '../../src/state/capture';
import { FONT, RADIUS, SPACE } from '../../src/theme/theme';
import { GROUPS, TOOLS, type Tool } from '../../src/tools/registry';
import { Button, Card, Icon, ScreedLine, T } from '../../src/ui/kit';

const WELCOME = require('../../assets/art/welcome.jpg');

export default function ToolsScreen() {
  const app = useApp();
  const { theme, prefs, trial, isUnlocked, access } = app;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const open = (t: Tool) => router.push(t.screen ? (t.screen as '/checklist') : { pathname: '/tool/[id]', params: { id: t.id } });
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.m, paddingHorizontal: SPACE.l, paddingBottom: SPACE.xxl }}>
      <View style={{ gap: SPACE.s, marginBottom: SPACE.l }} accessibilityRole="header">
        <ScreedLine theme={theme} width={56} />
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: FONT.numBold, fontSize: 44, lineHeight: 48, color: theme.ink }}>Screedline</Text>
        <T kind="small">Concrete and landscape quantities, with the working shown.</T>
      </View>

      {!prefs.welcomeDone ? (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: SPACE.l }}>
          <Image source={WELCOME} accessibilityIgnoresInvertColors style={{ width: width - 2 * SPACE.l, height: Math.round((width - 2 * SPACE.l) / 1.5), backgroundColor: theme.cardAlt }} resizeMode="cover" accessibilityLabel="Illustration of a crew screeding a fresh driveway" />
          <View style={{ padding: SPACE.l, gap: SPACE.m }}>
            <T kind="headline">Numbers you can check on site</T>
            <T>Every answer shows how it was worked out, with a waste allowance you set. Metric first; switch to feet and inches in Settings.</T>
            <Button kind="secondary" label="Got it" onPress={() => app.setPrefs({ welcomeDone: true })} />
          </View>
        </Card>
      ) : null}

      {!access.full && !CAPTURE ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/unlock')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.m, backgroundColor: theme.slab, borderRadius: RADIUS.m, padding: SPACE.l, opacity: pressed ? 0.9 : 1, marginBottom: SPACE.s })}>
          <Icon name={trial.active ? 'timer-sand' : 'lock-open-variant-outline'} size={28} color={theme.amber} />
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.bold, fontSize: 18, color: theme.onSlab }}>
              {trial.active ? `Trial: ${trial.daysLeft} ${trial.daysLeft === 1 ? 'day' : 'days'} left` : trial.started ? 'Trial ended' : 'Try every tool free for 7 days'}
            </Text>
            <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.body, fontSize: 15, color: theme.onSlab2 }}>{app.price ? `Full Unlock ${app.price}, once. No subscription.` : 'Full Unlock is one payment. No subscription.'}</Text>
          </View>
          <Icon name="chevron-right" size={26} color={theme.onSlab2} />
        </Pressable>
      ) : null}

      {GROUPS.map(g => (
        <View key={g.id}>
          <T kind="caps" style={{ marginTop: SPACE.xl, marginBottom: SPACE.m }}>{g.title}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.m }}>
            {TOOLS.filter(t => t.group === g.id).map(t => {
              const lock = !isUnlocked && !t.free;
              return (
                <Pressable
                  key={t.id}
                  testID={`tool-${t.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.title}. ${t.blurb}${lock ? '. Part of Full Unlock' : ''}`}
                  onPress={() => open(t)}
                  style={({ pressed }) => ({ width: '47.5%', flexGrow: 1, minHeight: 128, backgroundColor: theme.card, borderRadius: RADIUS.m, padding: SPACE.l, gap: SPACE.s, borderWidth: theme.name === 'sun' ? theme.borderWidth : 1, borderColor: theme.line, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: theme.amber, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={t.icon} size={28} color={theme.onAmber} />
                    </View>
                    {lock ? <Icon name="lock-outline" size={20} color={theme.ink2} /> : null}
                  </View>
                  <T kind="label">{t.title}</T>
                  <T kind="small" numberOfLines={3}>{t.blurb}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
