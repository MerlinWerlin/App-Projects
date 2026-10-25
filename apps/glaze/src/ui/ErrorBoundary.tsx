// Friendly crash screen. `ErrorFallback` is used by expo-router's route-level ErrorBoundary
// export (app/_layout.tsx); `ErrorBoundary` wraps any subtree that should fail on its own.
// Design v2 (T83): grouped bg, peach pastel badge, title2, block pills.
import { Feather } from '@expo/vector-icons';
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FEEDBACK_ADDRESS } from '../config/feedback';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { t as tNow, useT } from '../i18n';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';
import { reportProblem } from './feedbackDevice';

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? tNow('ui.error.unknown');
  } catch {
    return tNow('ui.error.unknown');
  }
}

/** Full-screen fallback: what happened, a Try again button, and the message for feedback. */
export function ErrorFallback({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const title = [textV2.title2, textStyleFor(script, textV2.title2)];
  const body = [textV2.body, textStyleFor(script, textV2.body)];
  const foot = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const message = errorMessage(error);
  const [reportNote, setReportNote] = useState(null as 'opening' | 'failed' | null);
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.body}>
        <View style={[styles.badge, { backgroundColor: c.pastels.peach.fill }]}>
          <Feather name="alert-circle" size={28} color={c.pastels.peach.ink} />
        </View>
        <Text accessibilityRole="header" style={[...title, styles.center, { color: c.ink }]}>
          {t('common.error')}
        </Text>
        <Text style={[...body, styles.center, { color: c.inkSecondary }]}>
          {t('ui.error.body')}
        </Text>
        <PillButton label={t('common.retry')} icon="refresh-cw" block onPress={onRetry} haptic="light" accessibilityHint={t('ui.error.retryHint')} />
        <PillButton
          label={reportNote === 'opening' ? t('ui.error.opening') : t('ui.error.report')}
          icon="mail"
          variant="tinted"
          block
          haptic={false}
          disabled={reportNote === 'opening'}
          onPress={() => {
            // Works without the router: opens Mail (or a mailto: link) pre-filled as a Bug.
            setReportNote('opening');
            reportProblem(message)
              .then((r) => setReportNote(r === 'failed' ? 'failed' : null))
              .catch(() => setReportNote('failed'));
          }}
          accessibilityHint={t('ui.error.reportHint')}
        />
        {reportNote === 'failed' ? (
          <Text selectable style={[...foot, styles.center, { color: c.warn }]}>
            {t('ui.error.mailFailed', { address: FEEDBACK_ADDRESS })}
          </Text>
        ) : null}
        <Text
          selectable
          accessibilityLabel={t('ui.error.detailsA11y', { message })}
          style={[...foot, styles.center, styles.detail, { color: c.inkSecondary, borderColor: c.separator }]}
        >
          {message}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type Props = { children?: ReactNode; fallback?: (error: unknown, reset: () => void) => ReactNode };
type State = { error: unknown; failed: boolean };

/** Class boundary for subtrees; "Try again" clears the error and re-renders the children. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Local only: Glaze sends nothing off the device.
    if (__DEV__) console.warn('Glaze error boundary', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null, failed: false });
  };

  render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback
        ? this.props.fallback(this.state.error, this.reset)
        : <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', padding: spaceV2.xl, gap: spaceV2.lg },
  badge: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spaceV2.md },
});
