// T16: shown in place of Download on a city beyond the free one-per-trip allowance, only while Plus is locked.
// A quiet inline note with one button to Settings > Satchel Plus; never an alert, a timer or a repeated prompt.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { PressableScale } from '../ui/kit.tsx';
import { cityDownloadGate, type CityGate } from './entitlement.ts';
import { usePlus } from './usePlus.ts';

/** The gate for downloading one more city now (see entitlement.ts). */
export function useCityGate(installedCount: number, tripCount: number): CityGate {
  const { unlocked } = usePlus();
  return cityDownloadGate({ unlocked, installedCount, tripCount });
}

export function PlusCityNote({ city }: { city: string }) {
  const { t, theme } = useApp();
  const router = useRouter();
  return (
    <View style={{ gap: space.s }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{t('plus.cityLimit')}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('plus.cityLimitA11y', { city })}
        accessibilityHint={t('plus.cityLimitHint')}
        onPress={() => router.push('/settings')}
        style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft, alignSelf: 'flex-start' }}
      >
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.sea }}>{t('plus.cityLimitAction')}</Text>
      </PressableScale>
    </View>
  );
}
