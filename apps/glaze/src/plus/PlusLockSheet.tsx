import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { PLUS_PACKS, PLUS_THEMES } from '../core/plusThemes';
import { THEMES } from '../core/themes';
import { useT } from '../i18n';
import { continuous, radiusV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from '../ui/featherName';
import { announce } from '../ui/announce';
import { haptic } from '../ui/haptics';
import { textStyleFor } from '../ui/i18nLayout';
import { PillButton } from '../ui/PillButton';
import { Sheet } from '../ui/Sheet';
import { PLUS_PRICE, plusStore, usePlus } from './entitlement';
import { RestorePurchases } from './RestorePurchases';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** What the person tried to open, already translated, e.g. "the Tenmoku theme". */
  subject?: string;
  /** Called after a successful (dev) unlock. */
  onUnlocked?: () => void;
};

const BRAND = 'Glaze Plus'; // i18n-ignore (product name)

// Counts come from the catalogues so the copy never goes stale (32 themes in four packs today).
// Release standard §2: only what this build has. "Theme clips for Live Photos" (plus.lock.loops) is off the list
// until theme clips exist (the Live tab only makes Live Photos from the person's own video, which stays free).
const INCLUDED: readonly { icon: FeatherName; key: 'plus.lock.widgets' | 'plus.lock.symbols' }[] = [
  { icon: 'grid', key: 'plus.lock.widgets' },
  { icon: 'feather', key: 'plus.lock.symbols' },
];

const FREE = ['plus.lock.freeIcons', 'plus.lock.freeInstall', 'plus.lock.freeLive'] as const;

/**
 * Explains Glaze Plus: one-time price, no subscription, what's included and what stays free.
 * Honest paywall (T63): a large labelled close always in view, Restore purchases always shown,
 * opened only when the person taps something Plus (never at launch). Design v2 (T56): system type,
 * berry tint glyphs, "always free" on a mint card, filled Unlock pill beside a plain Not now.
 */
export function PlusLockSheet({ visible, onClose, subject, onUnlocked }: Props) {
  const { c } = useColorsV2();
  const { purchase } = usePlus();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const tt = { body: ts('body'), heading: ts('headline'), label: ts('headline'), small: ts('subhead') };
  const mint = c.pastels.mint;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const close = () => {
    setMessage(null);
    onClose();
  };

  const onUnlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await purchase();
      if (res === 'purchased') {
        haptic('success');
        setMessage(null);
        onUnlocked?.();
        onClose();
      } else if (res === 'failed') {
        // T140 prep: real store failure says nothing was charged and shows the store code.
        const code = plusStore.lastFailureCode?.() ?? 'unknown';
        haptic('warning');
        setMessage(t('plus.lock.failed', { code }));
        announce(t('plus.lock.failed', { code }));
      } else if (res === 'unavailable') {
        // Never silent (night 23 Oct, from Linework fb-1023 "Unlock Plus did nothing"): felt, shown and spoken on every tap.
        haptic('warning');
        setMessage(t('plus.lock.unavailable'));
        announce(t('plus.lock.unavailable'));
      }
    } catch {
      haptic('warning');
      setMessage(t('plus.lock.unavailable'));
      announce(t('plus.lock.unavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title={BRAND} closeLabel={t('plus.lock.close')}>
      <Text style={[...tt.body, { color: c.ink }]}>
        {subject ? `${t('plus.lock.subjectIntro', { subject })} ` : ''}
        {t('plus.lock.price', { price: PLUS_PRICE })}
      </Text>

      <View style={styles.list}>
        <Text accessibilityRole="header" style={[...tt.heading, { color: c.ink }]}>
          {t('plus.lock.included')}
        </Text>
        <View style={styles.row}>
          <Feather name="layers" size={18} color={c.tint} />
          <Text style={[...tt.body, styles.flex, { color: c.ink }]}>
            {t('plus.lock.themes', { count: PLUS_THEMES.length, packs: PLUS_PACKS.length })}
          </Text>
        </View>
        {INCLUDED.map((i) => (
          <View key={i.key} style={styles.row}>
            <Feather name={i.icon} size={18} color={c.tint} />
            <Text style={[...tt.body, styles.flex, { color: c.ink }]}>{t(i.key)}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.free, continuous, { backgroundColor: mint.fill }]}>
        <Text accessibilityRole="header" style={[...tt.label, { color: mint.ink }]}>
          {t('plus.lock.free')}
        </Text>
        {FREE.map((f) => (
          <View key={f} style={styles.row}>
            <Feather name="check" size={16} color={mint.ink} />
            <Text style={[...tt.small, styles.flex, { color: mint.ink }]}>{t(f)}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Feather name="check" size={16} color={mint.ink} />
          <Text style={[...tt.small, styles.flex, { color: mint.ink }]}>{t('plus.lock.freeThemes', { count: THEMES.length })}</Text>
        </View>
      </View>

      {message ? (
        <Text accessibilityLiveRegion="polite" style={[...tt.body, { color: c.warn }]}>
          {message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label={t('plus.lock.notNow')} variant="plain" onPress={close} style={styles.flex} />
        <PillButton
          label={busy ? t('plus.lock.oneMoment') : t('plus.lock.unlock')}
          icon="star"
          busy={busy}
          onPress={() => void onUnlock()}
          accessibilityHint={t('plus.lock.unlockHint')}
          style={styles.flex}
        />
      </View>

      <RestorePurchases
        onRestored={() => {
          setMessage(null);
          onUnlocked?.();
          onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spaceV2.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  free: { borderRadius: radiusV2.card, padding: spaceV2.lg, gap: spaceV2.xs },
  actions: { flexDirection: 'row', gap: spaceV2.sm },
  flex: { flex: 1 },
});
