import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { usePlus } from './entitlement';

const PLUS_LABEL = 'Plus'; // i18n-ignore (product name)

type Props = {
  /** Show a lock while the person does not have Plus. */
  showLock?: boolean;
};

/** Small "Plus" pill for Plus-only content (v2 tint capsule). Decorative: the parent's label says "Plus". */
export function PlusBadge({ showLock = true }: Props) {
  const { c } = useColorsV2();
  const { plus } = usePlus();
  const locked = showLock && plus !== true;
  return (
    <View
      style={[styles.pill, { backgroundColor: c.tint }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Feather name={locked ? 'lock' : 'star'} size={11} color={c.onTint} />
      <Text style={[textV2.caption1, styles.text, { color: c.onTint }]}>{PLUS_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    alignSelf: 'flex-start',
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
  },
  text: { fontWeight: '600' },
});
