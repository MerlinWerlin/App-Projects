import { StyleSheet, View } from 'react-native';
import type { CastTarget } from '../../core/cast/driver';
import { useT } from '../../i18n/react';
import { space, textStyle } from '../../theme/design';
import { Text } from '../Text';
import { PillButton, useDesign } from '../v2';

/** Name to show for a target ("Demo TV" in demo mode, translated). */
export function useTargetName(): (target: CastTarget | null) => string | null {
  const t = useT();
  return (target) => (target ? (target.kind === 'mock' ? t('ui.cast.demoTv') : target.name) : null);
}

/**
 * Where casts go (cast-1024): one chip per TV that accepts photos and videos, the chosen one
 * tinted. Searching / nothing found / search again below.
 */
export function TargetPicker({
  targets,
  selectedId,
  searching,
  demo,
  onSelect,
  onSearch,
}: {
  targets: readonly CastTarget[];
  selectedId: string | null;
  searching: boolean;
  demo: boolean;
  onSelect: (id: string) => void;
  onSearch: () => void;
}) {
  const p = useDesign();
  const t = useT();
  const nameOf = useTargetName();
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[textStyle('footnote'), { color: p.secondaryLabel }]}>
        {t('ui.cast.targetsHeader')}
      </Text>
      <View style={styles.chips}>
        {targets.map((target) => {
          const on = target.id === selectedId;
          const name = nameOf(target) ?? '';
          return (
            <PillButton
              key={target.id}
              variant={on ? 'filled' : 'tinted'}
              haptic="selection"
              label={name}
              accessibilityLabel={t(on ? 'ui.cast.targetSelected' : 'ui.cast.targetLabel', { name })}
              onPress={() => onSelect(target.id)}
            />
          );
        })}
        {!demo ? (
          <PillButton
            variant="plain"
            haptic="selection"
            label={t('ui.cast.searchAgain')}
            disabled={searching}
            onPress={onSearch}
          />
        ) : null}
      </View>
      {searching ? (
        <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]} accessibilityLiveRegion="polite">
          {t('ui.cast.searching')}
        </Text>
      ) : !demo && targets.length === 0 ? (
        <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]} accessibilityLiveRegion="polite">
          {t('ui.cast.noTargets')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
