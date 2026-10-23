import { I18nManager, StyleSheet, View } from 'react-native';
import type { TvApp } from '../../core/types';
import { useT } from '../../i18n/react';
import { RemoteIcon } from '../icons/RemoteIcon';
import type { IconName } from '../icons/names';
import { continuous } from '../../theme/design';
import { PressableScale } from '../motion/PressableScale';
import { useDesign } from '../v2/useDesign';

export interface FavouriteControlsProps {
  app: TvApp;
  /** The app is a favourite (move / remove) or not (add). */
  favourite: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  /** Below the favourites cap (only matters for add). */
  canAdd: boolean;
  onMove: (app: TvApp, by: -1 | 1) => void;
  onToggle: (app: TvApp) => void;
}

/**
 * Edit-mode buttons under an app tile (T73). Favourites get move earlier, remove and move later;
 * other apps get add. Plain buttons with labels, so VoiceOver / TalkBack and switch users can
 * reorder without any drag gesture. "Earlier" points to the start side of the grid, which is the
 * right in right-to-left languages.
 */
export function FavouriteControls({
  app,
  favourite,
  canMoveEarlier,
  canMoveLater,
  canAdd,
  onMove,
  onToggle,
}: FavouriteControlsProps) {
  const t = useT();
  const p = useDesign();
  const earlierIcon: IconName = I18nManager.isRTL ? 'right' : 'left';
  const laterIcon: IconName = I18nManager.isRTL ? 'left' : 'right';

  if (!favourite) {
    return (
      <View style={styles.row}>
        <IconButton
          icon="plus"
          label={t('ui.apps.fav.add', { name: app.name })}
          hint={canAdd ? undefined : t('ui.apps.fav.full')}
          disabled={!canAdd}
          onPress={() => onToggle(app)}
          color={p.tintedLabel}
          bg={p.tintedFill}
        />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <IconButton
        icon={earlierIcon}
        label={t('ui.apps.fav.moveEarlier', { name: app.name })}
        disabled={!canMoveEarlier}
        onPress={() => onMove(app, -1)}
        color={p.label}
        bg={p.fill}
      />
      <IconButton
        icon="close"
        label={t('ui.apps.fav.remove', { name: app.name })}
        onPress={() => onToggle(app)}
        color={p.label}
        bg={p.fill}
      />
      <IconButton
        icon={laterIcon}
        label={t('ui.apps.fav.moveLater', { name: app.name })}
        disabled={!canMoveLater}
        onPress={() => onMove(app, 1)}
        color={p.label}
        bg={p.fill}
      />
    </View>
  );
}

function IconButton({
  icon,
  label,
  hint,
  disabled,
  onPress,
  color,
  bg,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
  color: string;
  bg: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={7}
      style={[styles.btn, continuous, { backgroundColor: bg, opacity: disabled ? 0.35 : 1 }]}
    >
      <RemoteIcon name={icon} size={18} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingTop: 6 },
  // Three fit under a ~104pt phone tile; 30pt buttons + 7pt hit slop each side give a 44pt target.
  btn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
