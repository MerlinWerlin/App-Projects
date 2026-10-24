import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useT } from '../src/i18n/react';
import { list, space, textStyle } from '../src/theme/design';
import { Text } from '../src/ui/Text';
import { Card, LargeTitleHeader, PillButton, useDesign } from '../src/ui/v2';

const STEPS = ['app.airplay.step1', 'app.airplay.step2', 'app.airplay.step3'] as const;

/**
 * Screen Mirroring guide (T92, cast-1024 phase B), free. Shown by the "AirPlay / Screen Mirroring"
 * button when the system route picker can't open (Expo Go, Android, or the native module failed).
 * One screen: three numbered steps (Control Centre, Screen Mirroring, choose the TV), the same
 * Wi-Fi rule, and a pointer to casting photos and videos from the Cast tab. Presented as a modal
 * when app/_layout.tsx registers it so; it draws its own large title either way. No brand names.
 */
export default function AirPlayGuideScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTitleHeader
        title={t('app.airplay.title')}
        trailing={<PillButton variant="plain" label={t('app.airplay.done')} onPress={() => router.back()} />}
      >
        <View style={styles.body}>
          <Text style={[textStyle('body'), { color: p.secondaryLabel }]}>{t('app.airplay.intro')}</Text>

          <Card>
            <View style={styles.steps}>
              {STEPS.map((key, i) => {
                const n = i + 1;
                const text = t(key);
                return (
                  <View
                    key={key}
                    accessible
                    accessibilityLabel={t('app.airplay.stepLabel', { n, total: STEPS.length, text })}
                    style={styles.step}
                  >
                    <View style={[styles.badge, { backgroundColor: p.tint }]}>
                      <Text style={[textStyle('headline'), { color: p.tintInk }]}>{String(n)}</Text>
                    </View>
                    <Text style={[textStyle('body'), styles.stepText, { color: p.label }]}>{text}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <Text style={[textStyle('subheadline'), { color: p.label }]}>{t('app.airplay.wifi')}</Text>
          <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{t('app.airplay.notOnTv')}</Text>
        </View>
      </LargeTitleHeader>
    </>
  );
}

const styles = StyleSheet.create({
  body: { marginHorizontal: list.inset, gap: space.md, paddingBottom: space.xl },
  steps: { gap: space.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, paddingTop: space.xs },
});
