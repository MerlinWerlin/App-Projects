// A pack's lines. FlatList with fixed-height rows so long packs scroll without lag (App Factory lesson).
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { canPlayLine, rng } from '../../src/core/game.ts';
import { PACKS } from '../../src/content/index.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { Button, Chip, Press, T } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';

const ROW = 76;

export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme, plus } = useApp();
  const router = useRouter();
  const pack = PACKS.find((p) => p.id === id) ?? PACKS[0];
  const [d, setD] = useState<0 | 1 | 2 | 3>(0);
  const rows = useMemo(() => pack.lines.map((l, i) => ({ l, i, ok: canPlayLine(pack, i, plus) })).filter((r) => !d || r.l.d === d), [pack, plus, d]);
  const go = (lineId: string, ok: boolean) => (ok ? router.push({ pathname: '/round', params: { mode: 'pack', line: lineId } }) : router.push('/plus'));
  const random = () => {
    const ok = rows.filter((r) => r.ok);
    if (ok.length) go(ok[Math.floor(rng(Date.now())() * ok.length)].l.id, true);
  };
  const dots = (n: number) => '●'.repeat(n) + '○'.repeat(3 - n);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: t(`pack.${pack.id}` as Key) }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.l.id}
        getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
        initialNumToRender={14}
        windowSize={7}
        contentContainerStyle={{ padding: SP(5), paddingBottom: SP(12) }}
        ListHeaderComponent={
          <View style={{ marginBottom: SP(4) }}>
            <T color={theme.sub}>{t(`pack.${pack.id}.sub` as Key)}</T>
            <Button title={t('packs.shuffle')} icon="🎲" style={{ marginTop: SP(4) }} onPress={random} />
            <View style={{ flexDirection: 'row', gap: SP(2), marginTop: SP(4), flexWrap: 'wrap' }}>
              {(['packs.all', 'packs.easy', 'packs.medium', 'packs.hard'] as const).map((k, i) => (
                <Chip key={k} label={t(k)} on={d === i} onPress={() => setD(i as 0 | 1 | 2 | 3)} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          // Release standard §1: a filtered list that comes out empty says why and offers "Show all".
          d ? (
            <View style={{ alignItems: 'center', paddingVertical: SP(6), gap: SP(3) }}>
              <T color={theme.sub} center>
                {t('packs.emptyLevel')}
              </T>
              <Button kind="ghost" small title={t('common.showAll')} onPress={() => setD(0)} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Press label={item.l.t} onPress={() => go(item.l.id, item.ok)} style={{ height: ROW - SP(2), marginBottom: SP(2), backgroundColor: theme.card, borderRadius: R.m, paddingHorizontal: SP(4), flexDirection: 'row', alignItems: 'center', gap: SP(3) }}>
            <View style={{ flex: 1 }}>
              <T kind="bodyB" lines={2} color={item.ok ? theme.ink : theme.faint}>
                {item.l.t}
              </T>
              {item.l.n && (pack.id === 'songs' || pack.id === 'aussie') ? (
                <T kind="small" color={theme.faint} lines={1}>
                  {item.l.n}
                </T>
              ) : null}
            </View>
            <T kind="small" color={theme.sub}>
              {item.ok ? dots(item.l.d) : '🔒'}
            </T>
          </Press>
        )}
      />
    </View>
  );
}
