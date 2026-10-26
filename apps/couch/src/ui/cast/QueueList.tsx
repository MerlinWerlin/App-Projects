import { Image, Pressable, StyleSheet, View } from 'react-native';
import { formatClock } from '../../core/cast/castController';
import type { QueueItem } from '../../core/cast/queueTypes';
import { useT } from '../../i18n/react';
import { isWidelySupported } from '../../native/mediaPicker';
import { continuous, radii, space, textStyle } from '../../theme/design';
import { RemoteIcon } from '../icons/RemoteIcon';
import { haptic } from '../remote/haptics';
import { Text } from '../Text';
import { useDesign } from '../v2';
import { IconButton } from './IconButton';

const ACTION_EARLIER = 'moveEarlier';
const ACTION_LATER = 'moveLater';
const ACTION_REMOVE = 'remove';

/**
 * The cast queue (cast-1024): one row per picked item with its thumbnail (the local file), title,
 * kind and length; the item on the TV is highlighted. Tap a row to show it; move earlier / later
 * and remove are labelled buttons and screen-reader actions (no drag gesture).
 */
export function QueueList({
  items,
  index,
  onShow,
  onMove,
  onRemove,
  confirmed = true,
  failed = false,
}: {
  items: readonly QueueItem[];
  index: number;
  onShow: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  /** False while the TV has not confirmed the current item: its row says "Sent, waiting" instead of "On the TV now". */
  confirmed?: boolean;
  /** The current item failed on the TV: its row shows no "on the TV" claim at all. */
  failed?: boolean;
}) {
  const p = useDesign();
  const t = useT();
  return (
    <View style={styles.list}>
      {items.map((item, i) => {
        const current = i === index;
        const total = items.length;
        const kind = item.kind === 'video' ? t('ui.cast.video') : t('ui.cast.photo');
        const meta =
          item.kind === 'video' && item.durationSec ? t('ui.cast.videoLength', { time: formatClock(item.durationSec) }) : kind;
        const flagged = !isWidelySupported(item.mime);
        const label = t(current && confirmed && !failed ? 'ui.cast.itemLabelCurrent' : 'ui.cast.itemLabel', { title: item.title, n: i + 1, total });
        const actions: { name: string; label: string }[] = [];
        if (i > 0) actions.push({ name: ACTION_EARLIER, label: t('ui.cast.moveUp', { title: item.title }) });
        if (i < total - 1) actions.push({ name: ACTION_LATER, label: t('ui.cast.moveDown', { title: item.title }) });
        actions.push({ name: ACTION_REMOVE, label: t('ui.cast.remove', { title: item.title }) });
        return (
          <View
            key={item.id}
            style={[
              styles.row,
              continuous,
              { backgroundColor: current ? p.tintedFill : p.surface, borderColor: current ? p.tint : 'transparent' },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={t('ui.cast.itemHint')}
              accessibilityState={{ selected: current }}
              accessibilityActions={actions}
              onAccessibilityAction={(e) => {
                const name = e.nativeEvent.actionName;
                if (name === ACTION_EARLIER) onMove(i, i - 1);
                else if (name === ACTION_LATER) onMove(i, i + 1);
                else if (name === ACTION_REMOVE) onRemove(item.id);
              }}
              onPress={() => {
                haptic('light');
                onShow(i);
              }}
              style={styles.main}
            >
              <Image source={{ uri: item.uri }} resizeMode="cover" style={[styles.thumb, continuous, { backgroundColor: p.fill }]} />
              <View style={styles.copy}>
                <Text style={[textStyle('subheadline'), { color: p.label }]}>
                  {item.title}
                </Text>
                <Text style={[textStyle('caption1'), { color: current ? p.tintedLabel : p.secondaryLabel }]}>
                  {current && !failed ? t(confirmed ? 'ui.cast.onTv' : 'ui.cast.sentWaiting', { meta }) : meta}
                </Text>
                {flagged ? (
                  <Text style={[textStyle('caption1'), { color: p.warning }]}>{t('ui.cast.mayNotPlay')}</Text>
                ) : null}
              </View>
            </Pressable>
            <View style={styles.tools}>
              <IconButton
                icon={<RemoteIcon name="up" size={20} color={p.tintedLabel} />}
                label={t('ui.cast.moveUp', { title: item.title })}
                haptic="selection"
                disabled={i === 0}
                onPress={() => onMove(i, i - 1)}
              />
              <IconButton
                icon={<RemoteIcon name="down" size={20} color={p.tintedLabel} />}
                label={t('ui.cast.moveDown', { title: item.title })}
                haptic="selection"
                disabled={i === total - 1}
                onPress={() => onMove(i, i + 1)}
              />
              <IconButton
                icon={<RemoteIcon name="close" size={20} color={p.tintedLabel} />}
                label={t('ui.cast.remove', { title: item.title })}
                haptic="warning"
                onPress={() => onRemove(item.id)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    borderRadius: radii.md,
    borderWidth: 2,
    padding: space.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexGrow: 1, flexShrink: 1, flexBasis: 200, minHeight: 56 },
  // Thumbnail art only (no text inside), so a fixed size is fine at every text size.
  thumb: { width: 56, height: 56, borderRadius: radii.sm },
  copy: { flex: 1, gap: space.xxs },
  tools: { flexDirection: 'row', gap: space.xs, marginStart: 'auto' },
});
