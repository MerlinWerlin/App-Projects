// Shows children when the trial or the unlock is active. Otherwise the real tool still renders, with its example
// values and result, under a blur and an unlock card, so the person can see exactly what they would get. The preview
// takes no touches and is hidden from VoiceOver. PT lookup, the converter, refrigerant facts and saved jobs never sit
// behind this.
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useAccess } from '../state/access.ts';
import { SPACE } from '../theme/tokens.ts';
import { Body, Button, Card, Heading } from './kit.tsx';

export function Gate({ children, what }: { children: ReactNode; what: string }) {
  const a = useAccess();
  const scheme = useColorScheme();
  if (a.canCalc) return <>{children}</>;
  const expired = a.state === 'expired';
  return (
    <View style={{ minHeight: 420 }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: SPACE.lg }}>
        {children}
      </View>
      <BlurView intensity={28} tint={scheme === 'dark' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 22, overflow: 'hidden' }]} />
      <View style={{ position: 'absolute', top: SPACE.xl, left: 0, right: 0 }}>
        <Card>
          <Heading>{expired ? 'Your free week has ended' : `Free for 7 days: ${what}`}</Heading>
          <Body>{expired ? `Unlock Liquidline once to keep using ${what}. PT lookups, the converter, refrigerant facts and your saved jobs stay free.` : 'This is the real tool with example readings. Start the free trial to use it with yours. Nothing is charged and nothing renews.'}</Body>
          <Button testID="gate-open-paywall" title={expired ? 'See Full Unlock' : 'Start free trial'} onPress={() => router.push('/paywall')} />
        </Card>
      </View>
    </View>
  );
}
