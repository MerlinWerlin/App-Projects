// T253 (owner-1101h #4): the Themes front page's category chip row. Content-sized pills in one
// horizontal row (scrolls sideways; long translations never clip): All themes, then every
// non-empty category in the fixed order with More last (src/core/themeBrowse.ts browseChips).
// Tapping a chip shows that category's grid; tapping the selected chip again goes back to the
// overview. Each chip is ≥ 48 pt, says its count to screen readers, and carries a hint.
import { memo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { browseCategoryLabelKey, type BrowseChip, type BrowseView } from '../core/themeBrowse';
import { useT } from '../i18n';
import { continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PressableScale } from './PressableScale';
import { textStyleFor } from './i18nLayout';

type Props = {
  chips: readonly BrowseChip[];
  view: BrowseView;
  onPick: (id: BrowseChip['id']) => void;
};

export const CategoryChipRow = memo(function CategoryChipRow({ chips, view, onPick }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <ScrollView
      bounces={false}
      overScrollMode="never"
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t('themes.browse.chipsLabel')}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => {
        const selected = chip.id === view;
        const label = chip.id === 'all' ? t('themes.browse.allThemes') : t(browseCategoryLabelKey(chip.id));
        return (
          <PressableScale
            key={chip.id}
            onPress={() => onPick(chip.id)}
            haptic="select"
            pressedScale={0.95}
            accessibilityRole="button"
            accessibilityLabel={t('themes.browse.chipA11y', { label, count: chip.count })}
            accessibilityHint={t('themes.browse.chipHint')}
            accessibilityState={{ selected }}
            style={[styles.chip, continuous, { backgroundColor: selected ? c.tint : c.fill }]}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaleCap('subhead')}
              style={[textV2.subhead, textStyleFor(script, textV2.subhead), styles.text, { color: selected ? c.onTint : c.ink }]}
            >
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  // Bleed to the screen edges so a scrolling row isn't cut at the content inset.
  scroller: { marginHorizontal: -spaceV2.lg, flexGrow: 0 },
  row: { paddingHorizontal: spaceV2.lg, gap: spaceV2.sm, alignItems: 'center' },
  chip: {
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontWeight: '600', textAlign: 'center' },
});
