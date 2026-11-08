// T264 (owner-1101i #2, docs/CRASH_1101I.md): one error boundary per tab screen and the theme
// detail. A render error inside the screen shows a calm card ("Something went wrong" + Retry) in
// place of that screen instead of closing the app; Retry remounts the screen by bumping its key,
// so its state starts fresh. The other tabs keep working. Nothing is sent off the phone.
import { Feather } from '@expo/vector-icons';
import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { circleRadius, fontScaleCap, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { ErrorBoundary } from './ErrorBoundary';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';
import { SquircleCard } from './SquircleCard';

/** The calm in-place card a failed screen shows. Retry remounts the screen. */
export function ScreenErrorCard({ onRetry }: { onRetry: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const title = t('ui.error.screenTitle');
  const body = t('ui.error.screenBody');
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <SquircleCard accessibilityLabel={[title, body].join(' ')}>
        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: c.pastels.peach.fill }]}>
            <Feather name="alert-circle" size={24} color={c.pastels.peach.ink} />
          </View>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleCap('headline')}
            style={[textV2.headline, textStyleFor(script, textV2.headline), styles.center, { color: c.ink }]}
          >
            {title}
          </Text>
          <Text
            maxFontSizeMultiplier={fontScaleCap('footnote')}
            style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.center, { color: c.inkSecondary }]}
          >
            {body}
          </Text>
          <PillButton
            label={t('ui.error.retry')}
            icon="refresh-cw"
            onPress={onRetry}
            haptic="light"
            accessibilityLabel={t('ui.error.retry')}
            accessibilityHint={t('ui.error.retryHint')}
            style={styles.selfCenter}
          />
        </View>
      </SquircleCard>
    </View>
  );
}

/** Wraps a screen in its own boundary; Retry clears the error and remounts the screen (new key). */
export function ScreenBoundary({ name, children }: { name: string; children: (epoch: number) => ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  const fallback = useCallback((_error: unknown, reset: () => void) => {
    const retry = () => {
      setEpoch((e) => e + 1);
      reset();
    };
    return <ScreenErrorCard onRetry={retry} />;
  }, []);
  return (
    <ErrorBoundary key={name} fallback={fallback}>
      {children(epoch)}
    </ErrorBoundary>
  );
}

/** `export default withScreenBoundary(MyScreen, 'name')`: the screen, failing on its own. */
export function withScreenBoundary<P extends object>(Screen: ComponentType<P>, name: string): ComponentType<P> {
  function Bounded(props: P) {
    return <ScreenBoundary name={name}>{(epoch) => <Screen key={epoch} {...props} />}</ScreenBoundary>;
  }
  Bounded.displayName = `ScreenBoundary(${name})`;
  return Bounded;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spaceV2.lg },
  card: { alignItems: 'center', gap: spaceV2.md, paddingVertical: spaceV2.lg },
  badge: { width: 48, height: 48, borderRadius: circleRadius(48), alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  selfCenter: { alignSelf: 'center' },
});
