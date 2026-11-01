import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REGIONS } from '../../src/core/region';
import { t } from '../../src/i18n';
import { type StepsStatus, stepsPermission } from '../../src/native/steps';
import { actions, useGame, useSettings } from '../../src/store/game';
import { radius, space, type as ty, useColors } from '../../src/theme/tokens';
import { Button, Card } from '../../src/ui/kit';

export default function Settings() {
  const g = useGame();
  const s = useSettings();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const [steps, setSteps] = useState<StepsStatus | null>(null);
  useEffect(() => {
    stepsPermission().then(setSteps).catch(() => setSteps('unavailable'));
  }, []);
  const version = Constants.expoConfig?.version ?? '0.1.0';
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.lg, paddingBottom: space.xxl }}>
      <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">{t('settings.title')}</Text>

      <Card style={{ gap: space.sm }}>
        <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.region')}</Text>
        <Text style={[ty.small, { color: c.ink3 }]}>{t('settings.regionHint')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
          {REGIONS.map((r) => {
            const on = g.region === r;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`region.${r}`)}
                onPress={() => actions.setRegion(r)}
                style={{ minHeight: 40, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}
              >
                <Text style={[ty.small, { color: on ? c.accent : c.ink2, fontWeight: on ? '700' : '500' }]}>{t(`region.${r}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
          <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.haptics')}</Text>
          <Switch value={s.haptics} onValueChange={actions.setHaptics} accessibilityLabel={t('settings.haptics')} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
          <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.steps')}</Text>
          <Text style={[ty.body, { color: c.ink2 }]}>{steps === 'ok' ? t('settings.stepsOn') : steps === null ? '…' : t('settings.stepsOff')}</Text>
        </View>
        {steps === 'denied' ? (
          <View style={{ gap: space.sm }}>
            <Text style={[ty.small, { color: c.ink2 }]}>{t('settings.stepsDenied')}</Text>
            <Button kind="soft" label={t('settings.openSettings')} onPress={() => Linking.openSettings().catch(() => {})} />
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.about')}</Text>
        <Text style={[ty.body, { color: c.ink2 }]}>{t('settings.aboutBody')}</Text>
        <Text style={[ty.small, { color: c.ink3 }]}>{t('settings.privacy')}</Text>
        <Text style={[ty.small, { color: c.ink3 }]}>{t('settings.version', { v: version })}</Text>
      </Card>
    </ScrollView>
  );
}
