import { StyleSheet, View } from 'react-native';
import { useT } from '../../i18n/react';
import { useCastRouting } from '../../state/cast';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { continuous, radii, space, textStyle } from '../../theme/design';
import { RemoteIcon } from '../icons/RemoteIcon';
import { Text } from '../Text';
import { RemoteDesignProvider, useDesign } from '../v2';
import { IconButton } from './IconButton';

/**
 * "Casting: <title>" with a stop button, shown on the remote while a cast is on (cast-1024). The
 * remote's Play/Pause controls the cast meanwhile (useCastRouting in src/state/cast.tsx).
 */
export function CastPill({ title, onStop }: { title: string; onStop: () => void }) {
  const p = useDesign();
  const t = useT();
  return (
    <View style={[styles.pill, continuous, { backgroundColor: p.tintedFill }]} accessibilityLiveRegion="polite">
      <View style={styles.copy} accessible accessibilityLabel={t('ui.cast.pill', { title })} accessibilityHint={t('ui.cast.pillHint')}>
        <Text scaleRole="label" style={[textStyle('subheadline'), { color: p.tintedLabel }]}>
          {t('ui.cast.pill', { title })}
        </Text>
      </View>
      <IconButton
        icon={<RemoteIcon name="close" size={20} color={p.tintedLabel} />}
        label={t('ui.cast.stop')}
        hint={t('ui.cast.stopHint')}
        onPress={onStop}
      />
    </View>
  );
}

/** The pill on the remote screen: only while a cast is on, in the remote theme's colours. */
export function RemoteCastPill() {
  const theme = useRemoteTheme();
  const routing = useCastRouting();
  if (!routing.active || routing.title === null) return null;
  return (
    <RemoteDesignProvider theme={theme}>
      <CastPill title={routing.title} onStop={routing.stop} />
    </RemoteDesignProvider>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingVertical: space.xs,
    paddingStart: space.lg,
    paddingEnd: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  copy: { flex: 1 },
});
