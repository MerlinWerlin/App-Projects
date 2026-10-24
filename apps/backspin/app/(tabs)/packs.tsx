import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { PACKS } from '../../src/content/index.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { Card, Screen, T } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';

export default function Packs() {
  const { t, theme, plus } = useApp();
  const router = useRouter();
  return (
    <Screen>
      <T kind="hero">{t('packs.title')}</T>
      <View style={{ gap: SP(3), marginTop: SP(5) }}>
        {PACKS.map((p) => {
          const freeN = p.free === true ? p.lines.length : typeof p.free === 'number' ? Math.min(p.free, p.lines.length) : 0;
          const badge = plus || p.free === true ? t('packs.allFree') : t('packs.freeCount', { free: freeN, n: p.lines.length });
          return (
            <Card key={p.id} label={t(`pack.${p.id}` as Key)} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(4) }}>
              <View style={{ width: 56, height: 56, borderRadius: R.m, backgroundColor: theme.cardHi, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 30 }}>{p.emoji}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T kind="bodyB">{t(`pack.${p.id}` as Key)}</T>
                <T kind="small" color={theme.sub} lines={2}>
                  {t(`pack.${p.id}.sub` as Key)}
                </T>
                <T kind="small" color={plus || p.free === true ? theme.good : theme.gold} style={{ marginTop: SP(1), fontWeight: '700' }}>
                  {t('packs.count', { n: p.lines.length })} · {badge}
                </T>
              </View>
              <T color={theme.faint}>›</T>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
