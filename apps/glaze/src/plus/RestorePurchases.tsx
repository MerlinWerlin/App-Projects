import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { announce } from '../ui/announce';
import { haptic } from '../ui/haptics';
import { textStyleFor } from '../ui/i18nLayout';
import { PillButton } from '../ui/PillButton';
import { usePlus } from './entitlement';

type Props = {
  /** Called when a Glaze Plus purchase was found and restored. */
  onRestored?: () => void;
};

type Outcome = 'restored' | 'none' | 'failed';

/**
 * "Restore purchases", always shown (T63): in the Plus sheet and in Settings, whether or not the
 * person has Plus, so a new phone never re-locks what they paid for. Design v2 (T56): a tinted
 * pill with a spinner while busy.
 */
export function RestorePurchases({ onRestored }: Props) {
  const { c } = useColorsV2();
  const { restore } = usePlus();
  const { t, script } = useT();
  const [busy, setBusy] = useState<boolean>(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const onPress = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const found = await restore();
      setOutcome(found ? 'restored' : 'none');
      haptic(found ? 'success' : 'warning');
      // Spoken on every tap, even when the line below doesn't change (night 23 Oct; live regions are Android-only).
      announce(t(found ? 'plus.lock.restored' : 'plus.lock.restoreNone'));
      if (found) onRestored?.();
    } catch {
      setOutcome('failed');
      haptic('warning');
      announce(t('plus.lock.restoreFailed'));
    } finally {
      setBusy(false);
    }
  };

  const message =
    outcome === 'restored'
      ? t('plus.lock.restored')
      : outcome === 'none'
        ? t('plus.lock.restoreNone')
        : outcome === 'failed'
          ? t('plus.lock.restoreFailed')
          : '';

  return (
    <View style={styles.wrap}>
      <PillButton
        label={busy ? t('plus.lock.oneMoment') : t('plus.lock.restore')}
        icon="refresh-cw"
        variant="tinted"
        busy={busy}
        onPress={() => void onPress()}
        accessibilityHint={t('plus.lock.restoreHint')}
      />
      {outcome ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: outcome === 'restored' ? c.ok : c.inkSecondary }]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.xs },
});
