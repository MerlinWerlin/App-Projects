// Rowlight Plus: plain, honest paywall. One price, one time, no trial tricks, no countdowns.
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { t, type MessageKey } from '../src/i18n';
import { PLUS_PRICE, purchasePlus, restorePlus, usePlus } from '../src/plus/entitlement';
import { space, useColors } from '../src/theme/tokens';
import { haptic } from '../src/ui/haptics';
import { Body, Button, Card, H2, Label, ScreenScroll, Title } from '../src/ui/kit';
import { useToast } from '../src/ui/Toast';

const PERKS: ReadonlyArray<{ icon: React.ComponentProps<typeof Feather>['name']; key: string }> = [
  { icon: 'archive', key: 'stash' },
  { icon: 'tag', key: 'price' },
  { icon: 'heart', key: 'support' },
];

const FREE = ['projects', 'counters', 'patterns', 'pdf', 'tools', 'backup'] as const;

export default function PlusScreen() {
  const { c } = useColors();
  const plus = usePlus();
  const toast = useToast();

  const buy = async () => {
    const r = await purchasePlus();
    if (r === 'purchased') {
      haptic('success');
      toast(t('plus.thanks'));
      router.back();
    } else if (r === 'unavailable') {
      toast(t('plus.unavailable'));
    }
  };

  return (
    <ScreenScroll>
      <View style={{ alignItems: 'center', gap: space.s, marginBottom: space.l }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="star" size={32} color={c.accent} />
        </View>
        <Title style={{ textAlign: 'center' }}>{t('plus.name')}</Title>
        <Body muted style={{ textAlign: 'center' }}>
          {t('plus.pitch')}
        </Body>
      </View>
      <Card style={{ gap: space.m }}>
        {PERKS.map((p) => (
          <View key={p.key} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
            <Feather name={p.icon} size={20} color={c.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Body bold>{t(`plus.perk.${p.key}` as MessageKey)}</Body>
              <Body small muted>
                {t(`plus.perk.${p.key}.body` as MessageKey)}
              </Body>
            </View>
          </View>
        ))}
      </Card>
      <View style={{ marginTop: space.l, gap: 6 }}>
        <Label>{t('plus.alwaysFree')}</Label>
        {FREE.map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
            <Feather name="check" size={16} color={c.good} />
            <Body small>{t(`plus.free.${k}`)}</Body>
          </View>
        ))}
      </View>
      <View style={{ marginTop: space.xl, gap: space.s }}>
        {plus ? (
          <H2 style={{ textAlign: 'center' }}>{t('plus.active')}</H2>
        ) : (
          <Button title={t('plus.buy', { price: PLUS_PRICE })} icon="star" onPress={() => buy().catch(() => {})} />
        )}
        <Button title={t('plus.restore')} kind="ghost" onPress={() => restorePlus().then((v) => toast(v ? t('plus.restored') : t('plus.nothingToRestore')))} />
        <Body small muted style={{ textAlign: 'center' }}>
          {t('plus.fine')}
        </Body>
      </View>
    </ScreenScroll>
  );
}
