import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { PACKS } from '../../src/content/index.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { Enter, Icon, Press, Screen, T } from '../../src/ui/kit.tsx';
import { SP } from '../../src/ui/theme.ts';

// Packs as a pile of flyers: each pack is a slip printed in one of the two ink tints (or plain stock), its name set
// big in the display face, laid down at a slight angle like flyers on a table.
export default function Packs() {
  const { t, theme, plus } = useApp();
  const router = useRouter();
  return (
    <Screen>
      <T kind="hero">{t('packs.title')}</T>
      <View style={{ marginTop: SP(6), gap: SP(3) }}>
        {PACKS.map((p, i) => {
          const freeN = p.free === true ? p.lines.length : typeof p.free === 'number' ? Math.min(p.free, p.lines.length) : 0;
          const open = plus || p.free === true;
          const badge = open ? t('packs.allFree') : t('packs.freeCount', { free: freeN, n: p.lines.length });
          const stock = [theme.recTint, theme.rewTint, theme.card][i % 3];
          const tilt = ['-0.8deg', '0.6deg', '-0.3deg', '0.9deg'][i % 4];
          return (
            <Enter key={p.id} delay={i * 40}>
              <Press label={t(`pack.${p.id}` as Key)} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: p.id } })} style={{ backgroundColor: stock, borderRadius: theme.radius.l, padding: SP(5), transform: [{ rotate: tilt }] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP(3) }}>
                  <T kind="title" style={{ flex: 1 }}>{t(`pack.${p.id}` as Key)}</T>
                  <Icon name="chevron" size={20} color={theme.ink} />
                </View>
                <T color={theme.ink} lines={2} style={{ marginTop: SP(2) }}>
                  {t(`pack.${p.id}.sub` as Key)}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP(1.5), marginTop: SP(3) }}>
                  {!open ? <Icon name="lock" size={14} color={theme.ink} /> : null}
                  <T kind="small" color={theme.ink} style={{ fontWeight: '600' }}>
                    {t('packs.count', { n: p.lines.length })} · {badge}
                  </T>
                </View>
              </Press>
            </Enter>
          );
        })}
      </View>
    </Screen>
  );
}
