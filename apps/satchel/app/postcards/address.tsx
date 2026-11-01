// T147 big address: one person's postal address, large, to show at a post office counter or copy onto a card. The
// address lines as typed, then the country line in capitals (as postal services ask). Copy puts the plain text on
// the clipboard (src/native/clipboard.ts); the text is also selectable for press-and-hold copy.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addressLines, addressText, findPerson, hasAddress } from '../../src/core/postcards.ts';
import { copyText } from '../../src/native/clipboard.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePostcards } from '../../src/state/postcards.ts';
import { radius, space, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView } from '../../src/ui/hero.tsx';
import { Body, Button, EmptyState, Screen } from '../../src/ui/kit.tsx';
import { StampMark } from '../../src/ui/postcardArt.tsx';

export default function BigAddressScreen() {
  const { tripId, personId } = useLocalSearchParams<{ tripId: string; personId: string }>();
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [book, loaded] = usePostcards(tripId ?? '');
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const person = findPerson(book, personId ?? '');
  if (!person) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('postcards.bigRoute') }} />
        {loaded ? <EmptyState art="magnifier" title={t('postcards.bigRoute')} body={t('postcards.bigMissing')} /> : null}
      </Screen>
    );
  }
  const a = addressLines(person);
  const copy = async () => {
    const ok = await copyText(addressText(person));
    setCopied(ok ? 'yes' : 'no');
    AccessibilityInfo.announceForAccessibility(ok ? t('postcards.copied') : t('postcards.copyFailed'));
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.l }}>
      <Stack.Screen options={{ title: t('postcards.bigRoute') }} />
      <FadeInView>
        <View
          accessible
          accessibilityLabel={t('postcards.bigA11yCard', { address: [...a.lines, a.country].filter(Boolean).join(', ') })}
          style={{ borderRadius: radius.l, padding: space.xl, gap: space.s, backgroundColor: theme.cardRaised, borderWidth: 1, borderColor: theme.line }}
        >
          <View style={{ alignSelf: 'flex-end' }}>
            <StampMark sent={!!person.sent} size={44} />
          </View>
          {a.lines.map((l, i) => (
            <Text key={`${i}${l}`} selectable style={[i === 0 ? typeScale.displayL : typeScale.displayM, { color: theme.ink }]}>
              {l}
            </Text>
          ))}
          {a.country ? (
            <Text selectable style={[typeScale.displayL, { color: theme.ink, letterSpacing: 1.5, marginTop: space.s }]}>
              {a.country}
            </Text>
          ) : null}
        </View>
      </FadeInView>
      {hasAddress(person) ? null : <Body muted>{t('postcards.bigNoAddress')}</Body>}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('postcards.bigNote')}</Text>
      <Button label={t('postcards.copy')} hint={t('postcards.copyHint')} icon="copy-outline" onPress={() => void copy()} />
      {copied ? (
        <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: copied === 'yes' ? theme.ok : theme.muted }]}>
          {copied === 'yes' ? t('postcards.copied') : t('postcards.copyFailed')}
        </Text>
      ) : null}
      <Button label={t('postcards.back')} hint={t('postcards.backHint')} kind="quiet" onPress={() => router.back()} />
    </ScrollView>
  );
}
