import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { PACKS } from '../../src/content/index.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { Divider, Icon, Press, Screen, T } from '../../src/ui/kit.tsx';
import { SP } from '../../src/ui/theme.ts';

// Packs as a printed contents list: each pack's name set in the display face, its blurb and count under it.
export default function Packs() {
  const { t, theme, plus } = useApp();
  const router = useRouter();
  return (
    <Screen>
      <T kind="hero">{t('packs.title')}</T>
      <View style={{ marginTop: SP(6) }}>
        <Divider />
        {PACKS.map((p) => {
          const freeN = p.free === true ? p.lines.length : typeof p.free === 'number' ? Math.min(p.free, p.lines.length) : 0;
          const open = plus || p.free === true;
          const badge = open ? t('packs.allFree') : t('packs.freeCount', { free: freeN, n: p.lines.length });
          return (
            <View key={p.id}>
              <Press label={t(`pack.${p.id}` as Key)} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(3), paddingVertical: SP(4) }}>
                <View style={{ flex: 1 }}>
                  <T kind="h">{t(`pack.${p.id}` as Key)}</T>
                  <T kind="small" color={theme.sub} lines={2} style={{ marginTop: SP(1) }}>
                    {t(`pack.${p.id}.sub` as Key)}
                  </T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP(1.5), marginTop: SP(2) }}>
                    {!open ? <Icon name="lock" size={14} color={theme.sub} /> : null}
                    <T kind="small" color={open ? theme.good : theme.sub} style={{ fontWeight: '600' }}>
                      {t('packs.count', { n: p.lines.length })} · {badge}
                    </T>
                  </View>
                </View>
                <Icon name="chevron" size={18} color={theme.sub} />
              </Press>
              <Divider />
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
