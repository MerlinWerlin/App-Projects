import { StyleSheet, View } from 'react-native';
import { SLIDESHOW_INTERVALS } from '../../core/cast/queueTypes';
import { useT } from '../../i18n/react';
import { space, textStyle } from '../../theme/design';
import { Text } from '../Text';
import { InsetGroupedList, PillButton, Row, useDesign } from '../v2';

/** Slideshow on/off, seconds per photo (SLIDESHOW_INTERVALS) and loop (cast-1024). */
export function SlideshowControls({
  slideshow,
  intervalSec,
  loop,
  onSlideshow,
  onInterval,
  onLoop,
}: {
  slideshow: boolean;
  intervalSec: number;
  loop: boolean;
  onSlideshow: (on: boolean) => void;
  onInterval: (sec: number) => void;
  onLoop: (on: boolean) => void;
}) {
  const p = useDesign();
  const t = useT();
  return (
    <View style={styles.wrap}>
      <InsetGroupedList header={t('ui.cast.slideshowHeader')}>
        <Row
          title={t('ui.cast.slideshow')}
          subtitle={t('ui.cast.slideshowHint')}
          accessory={{ type: 'switch', value: slideshow, onValueChange: onSlideshow }}
        />
        <Row title={t('ui.cast.loop')} accessory={{ type: 'switch', value: loop, onValueChange: onLoop }} />
      </InsetGroupedList>
      <Text style={[textStyle('footnote'), styles.label, { color: p.secondaryLabel }]}>{t('ui.cast.interval')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('ui.cast.interval')}>
        {SLIDESHOW_INTERVALS.map((sec) => {
          const on = sec === intervalSec;
          return (
            <PillButton
              key={sec}
              variant={on ? 'filled' : 'tinted'}
              haptic="selection"
              label={t('ui.cast.intervalOption', { n: sec })}
              accessibilityLabel={t(on ? 'ui.cast.intervalLabelOn' : 'ui.cast.intervalLabel', { n: sec })}
              onPress={() => onInterval(sec)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { paddingHorizontal: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
