import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { fontScaleCap, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { announce } from '../ui/announce';
import type { FeatherName } from '../ui/featherName';
import { haptic } from '../ui/haptics';
import { textStyleFor } from '../ui/i18nLayout';
import { InsetRow } from '../ui/InsetGroup';
import { PressableScale } from '../ui/PressableScale';
import { usePlus } from './entitlement';

type Props = {
  /** Called when a Glaze Plus purchase was found and restored. */
  onRestored?: () => void;
  /**
   * `link` (the Plus sheet): a plain centred text link under the one primary pill.
   * `row` (Settings): an inset row with a pastel circle icon, the outcome as its subtitle.
   */
  variant?: 'link' | 'row';
  /** Row icon (variant `row`); also tells InsetGroup where the separator starts. */
  icon?: FeatherName;
};

type Outcome = 'restored' | 'none' | 'failed';

/**
 * "Restore purchases", always shown (T63): in the Plus sheet and in Settings, whether or not the
 * person has Plus, so a new phone never re-locks what they paid for. T173 (docs/PREMIUM_UI.md §3.6,
 * §3.7): a plain text link in the sheet and an inset row in Settings; no spinner while busy, the
 * label itself says "One moment…".
 */
export function RestorePurchases({ onRestored, variant = 'link', icon = 'refresh-cw' }: Props) {
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
  const label = busy ? t('plus.lock.oneMoment') : t('plus.lock.restore');

  if (variant === 'row') {
    return (
      <InsetRow
        icon={icon}
        iconTone="sky"
        title={label}
        subtitle={message || undefined}
        accessory="none"
        haptic={false}
        disabled={busy}
        accessibilityLabel={message ? `${label}. ${message}` : label}
        accessibilityHint={t('plus.lock.restoreHint')}
        onPress={() => void onPress()}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={() => void onPress()}
        disabled={busy}
        haptic="select"
        pressedScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('plus.lock.restoreHint')}
        accessibilityState={{ disabled: busy, busy }}
        style={styles.link}
      >
        <Text
          maxFontSizeMultiplier={fontScaleCap('subhead')}
          style={[textV2.subhead, textStyleFor(script, textV2.subhead), styles.linkText, { color: c.tint }]}
        >
          {label}
        </Text>
      </PressableScale>
      {outcome ? (
        <Text
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={fontScaleCap('footnote')}
          style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.center, { color: outcome === 'restored' ? c.ok : c.inkSecondary }]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.xxs, alignItems: 'center' },
  link: { minHeight: sizeV2.touch, paddingHorizontal: spaceV2.lg, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontWeight: '600', textAlign: 'center' },
  center: { textAlign: 'center' },
});
