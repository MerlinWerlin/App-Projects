// Shown instead of a new round once the 10 free goes are used (Jared 24 Oct 2026: "10 free goes and then it's 2 lifetime").
import { useRouter } from 'expo-router';
import { useApp } from '../state/app.tsx';
import { Button, Card, Disc, T } from './kit.tsx';
import { SP } from './theme.ts';

export function OutOfGoes() {
  const { t, theme, plusPrice } = useApp();
  const router = useRouter();
  return (
    <Card hi style={{ alignItems: 'center', paddingVertical: SP(8), marginTop: SP(4) }}>
      <Disc size={120} spin={-1} />
      <T kind="title" center style={{ marginTop: SP(5) }}>
        {t('round.outOfGoes')}
      </T>
      <T color={theme.sub} center style={{ marginTop: SP(2) }}>
        {t('plus.note')}
      </T>
      <Button
        title={plusPrice ? t('plus.buy', { price: plusPrice }) : t('plus.buyNoPrice')}
        style={{ marginTop: SP(6), alignSelf: 'stretch' }}
        onPress={() => router.push('/plus')}
      />
    </Card>
  );
}
