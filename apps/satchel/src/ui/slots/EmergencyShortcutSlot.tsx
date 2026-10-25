// One-tap emergency card shortcut on the Trips home (FLOWS §6.1): opens the Emergency tab, where the local numbers,
// insurance, contacts and medical notes are. Works with no signal (everything is on the phone). Owned by T27.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../../state/app.tsx';
import { fonts, radius, space } from '../../theme/tokens.ts';
import { PressableScale } from '../kit.tsx';

export function EmergencyShortcutSlot() {
  const { t, theme } = useApp();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('emergencyShortcut.label')}
      accessibilityHint={t('emergencyShortcut.hint')}
      onPress={() => router.navigate('/emergency')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.danger,
        borderRadius: radius.m,
        paddingHorizontal: space.l,
        paddingVertical: space.s,
      }}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Ionicons name="medkit-outline" size={22} color={theme.danger} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('emergencyShortcut.label')}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{t('emergencyShortcut.body')}</Text>
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </View>
    </PressableScale>
  );
}
