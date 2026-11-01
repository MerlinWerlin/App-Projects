// Offline banner on the Trips home (T10, expo-network): "Flight mode: tickets, cards and documents still work".
// Shows only when the phone says it has no connection; nothing when online or when the state can't be read.
// The status is said in words (not colour or the icon alone) and announced politely when it appears.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { showOfflineBanner } from '../../core/network.ts';
import { useNetworkStatus } from '../../native/network.ts';
import { useApp } from '../../state/app.tsx';
import { fonts, space } from '../../theme/tokens.ts';
import { Body, Card } from '../kit.tsx';

export function OfflineBannerSlot() {
  const { t, theme } = useApp();
  const status = useNetworkStatus();
  if (!showOfflineBanner(status)) return null;

  const title = t('offline.title');
  const body = t('offline.body');
  return (
    <Card style={{ borderWidth: 1, borderColor: theme.sea }}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${title}. ${body}`}
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}
      >
        <Ionicons name="airplane-outline" size={24} color={theme.sea} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>{title}</Text>
          <Body muted>{body}</Body>
        </View>
      </View>
    </Card>
  );
}
