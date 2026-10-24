// The free-trial disclosure (App Store Review Guideline 3.1.1, docs/OWNER_1024.md): before the trial starts it says
// how long it lasts, what stays free forever, what locks when it ends, and what keeping it costs. Shown on the Plus
// screen above "Start free trial" and on the first-run offer card on Home.
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeV2 } from '../theme/useTheme';
import { maxFontScaleV2, spaceV2 } from '../theme/tokensV2';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n/en';
import { TRIAL_DAYS } from './access';
import { STARTER_TEMPLATE_COUNT } from './entitlement';

type Line = { icon: 'check' | 'lock' | 'tag'; key: MessageKey };
const LINES: readonly Line[] = [
  { icon: 'check', key: 'plus.offer.free' },
  { icon: 'lock', key: 'plus.offer.locks' },
  { icon: 'tag', key: 'plus.offer.price' },
];

export function TrialOfferText({ price }: { price: string }) {
  const { c, text } = useThemeV2();
  const { t } = useT();
  return (
    <View style={{ gap: spaceV2.x2 }}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={maxFontScaleV2} style={[text('title3'), { color: c.graphite }]}>
        {t('plus.offer.title', { days: TRIAL_DAYS })}
      </Text>
      {LINES.map((line) => (
        <View key={line.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.x2 }}>
          <Feather name={line.icon} size={16} color={c.ink} style={{ marginTop: 3 }} accessibilityElementsHidden importantForAccessibility="no" />
          <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.graphite, flex: 1 }]}>
            {t(line.key, { count: STARTER_TEMPLATE_COUNT, price, days: TRIAL_DAYS })}
          </Text>
        </View>
      ))}
    </View>
  );
}
