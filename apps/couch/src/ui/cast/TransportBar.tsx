import { StyleSheet, View } from 'react-native';
import { formatClock, type PlayAction } from '../../core/cast/castController';
import type { CastSnapshot } from '../../core/cast/session';
import { useT } from '../../i18n/react';
import { space, textStyle } from '../../theme/design';
import { RemoteIcon } from '../icons/RemoteIcon';
import { NeverMirror } from '../NeverMirror';
import { Text } from '../Text';
import { PillButton, useDesign } from '../v2';
import { IconButton } from './IconButton';

/** Seek step of the -10 s / +10 s buttons. */
export const SEEK_STEP_SEC = 10;

/**
 * Cast transport (cast-1024): previous, play/pause, next; for videos -10 s / position / +10 s; stop.
 * Previous / next and the seek buttons keep their physical sides in right-to-left languages, like
 * the remote's rewind / fast-forward (NeverMirror).
 */
export function TransportBar({
  cast,
  action,
  canPrev,
  canNext,
  active,
  onPrev,
  onNext,
  onToggle,
  onSeekBy,
  onStop,
}: {
  cast: CastSnapshot;
  action: PlayAction;
  canPrev: boolean;
  canNext: boolean;
  active: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onSeekBy: (deltaSec: number) => void;
  onStop: () => void;
}) {
  const p = useDesign();
  const t = useT();
  const playLabel =
    action === 'pause'
      ? t('ui.cast.pause')
      : action === 'pauseSlideshow'
        ? t('ui.cast.pauseSlideshow')
        : action === 'resumeSlideshow'
          ? t('ui.cast.resumeSlideshow')
          : t('ui.cast.play');
  const video = active && cast.media?.kind === 'video';
  const canSeek = video && (cast.state === 'playing' || cast.state === 'paused');
  const position = formatClock(cast.positionSec);
  const duration = cast.durationSec !== null && cast.durationSec > 0 ? formatClock(cast.durationSec) : null;
  return (
    <View style={styles.wrap}>
      <NeverMirror style={styles.row}>
        <IconButton
          icon={<RemoteIcon name="left" size={26} color={p.tintedLabel} />}
          label={t('ui.cast.prev')}
          hint={t('ui.cast.prevHint')}
          disabled={!canPrev}
          onPress={onPrev}
        />
        <IconButton
          icon={<RemoteIcon name="playPause" size={30} color={p.tintInk} />}
          label={playLabel}
          prominent
          disabled={action === 'none'}
          onPress={onToggle}
        />
        <IconButton
          icon={<RemoteIcon name="right" size={26} color={p.tintedLabel} />}
          label={t('ui.cast.next')}
          hint={t('ui.cast.nextHint')}
          disabled={!canNext}
          onPress={onNext}
        />
      </NeverMirror>
      {video ? (
        <NeverMirror style={styles.row}>
          <PillButton
            variant="tinted"
            haptic="selection"
            label={t('ui.cast.back10Short', { n: SEEK_STEP_SEC })}
            accessibilityLabel={t('ui.cast.back10', { n: SEEK_STEP_SEC })}
            disabled={!canSeek}
            onPress={() => onSeekBy(-SEEK_STEP_SEC)}
          />
          <Text
            scaleRole="meta"
            style={[textStyle('numeric'), styles.clock, { color: p.label }]}
            accessibilityLabel={
              duration ? t('ui.cast.positionLabel', { position, duration }) : t('ui.cast.positionOnly', { position })
            }
          >
            {duration ? t('ui.cast.position', { position, duration }) : position}
          </Text>
          <PillButton
            variant="tinted"
            haptic="selection"
            label={t('ui.cast.fwd10Short', { n: SEEK_STEP_SEC })}
            accessibilityLabel={t('ui.cast.fwd10', { n: SEEK_STEP_SEC })}
            disabled={!canSeek}
            onPress={() => onSeekBy(SEEK_STEP_SEC)}
          />
        </NeverMirror>
      ) : null}
      {active ? (
        <PillButton
          variant="tinted"
          tone="destructive"
          label={t('ui.cast.stop')}
          accessibilityHint={t('ui.cast.stopHint')}
          onPress={onStop}
          style={styles.stop}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', gap: space.md, flexWrap: 'wrap' },
  clock: { textAlign: 'center', flexShrink: 1 },
  stop: { alignSelf: 'center' },
});
