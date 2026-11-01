// T222 (owner-1101e): small "Update" note on the theme page of a downloaded remote art pack whose
// catalogue entry is newer. The update runs by itself in the background; this shows it pending,
// in progress or failed (the old version keeps working) with a manual Update / Try again button.
// Renders nothing when the pack is up to date or not downloaded.
import { Feather } from '@expo/vector-icons';
import { AccessibilityInfo, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useT } from '../i18n';
import type { RemoteArtRef } from '../core/remoteCatalog';
import { usePackUpdate } from '../plus/usePackUpdate';
import { fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { ProgressBar } from './ProgressBar';
import { PillButton, SquircleCard } from './v2';

export function PackUpdateNote({ theme, packName, onLocked }: { theme: { remoteArt?: RemoteArtRef } | null | undefined; packName: string; onLocked: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const { view, update } = usePackUpdate(theme);
  if (view.kind === 'none') return null;
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const params = { pack: packName };
  const onUpdate = async () => {
    haptic('select');
    const r = await update();
    if (r === 'locked') onLocked();
    else if (r === 'ok') {
      haptic('light');
      AccessibilityInfo.announceForAccessibility(t('theme.update.doneA11y', params));
    } else if (r === 'error') haptic('warning');
  };
  const failed = view.kind === 'failed';
  return (
    <SquircleCard style={styles.side}>
      <View style={styles.stack}>
        <View style={styles.head}>
          <Feather name={failed ? 'alert-circle' : 'refresh-cw'} size={20} color={failed ? c.warn : c.tint} />
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} accessibilityRole="header" style={[...ts('headline'), styles.flex, { color: c.ink }]}>
            {t('theme.update.title')}
          </Text>
        </View>
        {view.kind === 'updating' ? (
          <ProgressBar progress={view.percent / 100} label={t('theme.update.updating', params)} />
        ) : (
          <>
            <Text maxFontSizeMultiplier={fontScaleCap('callout')} accessibilityLiveRegion="polite" style={[...ts('callout'), { color: failed ? c.warn : c.inkSecondary }]}>
              {failed ? t('theme.update.failed', params) : t('theme.update.pending', params)}
            </Text>
            <PillButton
              label={failed ? t('theme.update.retry') : t('theme.update.cta')}
              icon={failed ? 'refresh-cw' : 'download'}
              variant="tinted"
              onPress={onUpdate}
              accessibilityHint={t('theme.update.hint')}
            />
          </>
        )}
      </View>
    </SquircleCard>
  );
}

const styles = StyleSheet.create({
  side: { marginHorizontal: spaceV2.lg },
  stack: { gap: spaceV2.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  flex: { flex: 1 },
});
