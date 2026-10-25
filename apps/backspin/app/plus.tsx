// The paywall. No dark patterns: the close button is always visible, the price is the store's own,
// nothing is pre-ticked, there is no timer, and the free game stays complete without it.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { haptic } from '../src/native/device.ts';
import { useApp } from '../src/state/app.tsx';
import { Button, Card, Disc, Screen, T, Toastish } from '../src/ui/kit.tsx';
import { SP } from '../src/ui/theme.ts';

export default function Plus() {
  const { t, theme, owned: plus, freeLeft, plusPrice, plusKind, buyPlus, restorePlus } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const buy = async () => {
    setBusy(true);
    const r = await buyPlus();
    setBusy(false);
    if (r.status === 'owned') {
      haptic.success();
      setMsg(t('plus.owned'));
    } else if (r.status === 'cancelled') setMsg(t('plus.cancelled'));
    else if (r.status === 'unavailable') setMsg(t('plus.unavailable'));
    else setMsg(t('plus.failed', { detail: r.detail || 'E_UNKNOWN' }));
  };

  return (
    <Screen>
      <Disc size={120} spin={1} />
      <T kind="title" center style={{ marginTop: SP(5) }}>
        {t('plus.headline')}
      </T>
      <T color={theme.sub} center style={{ marginTop: SP(2) }}>
        {t('plus.body')}
      </T>
      {freeLeft != null ? (
        <T kind="bodyB" color={freeLeft > 0 ? theme.rew : theme.rec} center style={{ marginTop: SP(2) }}>
          {freeLeft > 0 ? t('home.freeLeft', { n: freeLeft }) : t('home.freeDone')}
        </T>
      ) : null}
      <Card style={{ marginTop: SP(5), gap: SP(3) }}>
        {(['plus.f1', 'plus.f2', 'plus.f3', 'plus.f4', 'plus.f5'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: SP(3) }}>
            <T color={theme.good}>✓</T>
            <T style={{ flex: 1 }}>{t(k)}</T>
          </View>
        ))}
      </Card>
      {plus ? (
        <T kind="bodyB" color={theme.good} center style={{ marginTop: SP(6) }}>
          ✓ {t('plus.owned')}
        </T>
      ) : (
        <Button title={plusPrice ? t('plus.buy', { price: plusPrice }) : t('plus.buyNoPrice')} style={{ marginTop: SP(6) }} busy={busy} onPress={buy} />
      )}
      <T kind="small" color={theme.sub} center style={{ marginTop: SP(3) }}>
        {t('plus.note')}
      </T>
      {plusKind === 'test' ? (
        <T kind="small" color={theme.gold} center style={{ marginTop: SP(2) }}>
          {t('plus.expoGo')}
        </T>
      ) : null}
      <Button kind="ghost" small title={t('plus.restore')} style={{ marginTop: SP(5) }} onPress={async () => setMsg((await restorePlus()) ? t('settings.restored') : t('settings.nothingToRestore'))} />
      <Button kind="quiet" small title={t('common.close')} style={{ marginTop: SP(3) }} onPress={() => router.back()} />
      <Toastish text={msg} />
    </Screen>
  );
}
