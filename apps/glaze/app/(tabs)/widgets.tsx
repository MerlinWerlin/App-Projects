import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { widgetTabSizeKey } from '../../src/core/tabNav';
import { THEMES } from '../../src/core/themes';
import type { HomeOptionSize } from '../../src/core/widgetOptions';
import { useT } from '../../src/i18n';
import { useAnyTheme } from '../../src/native/useAnyTheme';
import { useActiveThemeId } from '../../src/store/activeTheme';
import { spaceV2 } from '../../src/theme/tokensV2';
import { ThemeWidgetArt } from '../../src/ui/ThemeWidgetArt';
import { LargeTitleScrollView } from '../../src/ui/LargeTitleHeader';
import { withScreenBoundary } from '../../src/ui/ScreenBoundary';
import { Segmented } from '../../src/ui/Segmented';

const SIZES = ['small', 'medium', 'large'] as const;

function WidgetsTab() {
  const { t } = useT();
  const tl = t as (key: string) => string;
  const { width } = useWindowDimensions();
  const activeId = useActiveThemeId();
  const theme = useAnyTheme(activeId) ?? THEMES[0];
  const [size, setSize] = useState<HomeOptionSize>('small');

  return (
    <LargeTitleScrollView title={t('tabs.widgets')}>
      <View style={styles.previews}>
        <Segmented<HomeOptionSize> label={t('tabs.widgetsTab.sizes')} value={size} onChange={setSize}
          options={SIZES.map(value => ({ value, label: tl(widgetTabSizeKey(value)) }))} />
        <ThemeWidgetArt theme={theme} size={size} width={width - spaceV2.lg * 2} />
      </View>
    </LargeTitleScrollView>
  );
}

const styles = StyleSheet.create({
  previews: { paddingHorizontal: spaceV2.lg, gap: spaceV2.md },
});

export default withScreenBoundary(WidgetsTab, 'widgets');
