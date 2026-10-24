// Yarn stash (Plus): what you own, how much is left, which projects use it.
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { yarnMetres, type Yarn } from '../../src/core/model';
import { formatNumber, t } from '../../src/i18n';
import { usePlus } from '../../src/plus/entitlement';
import { useData } from '../../src/store/data';
import { font, radius, space, useColors } from '../../src/theme/tokens';
import { Body, Button, EmptyState, Field, IconButton, PressableScale, Title } from '../../src/ui/kit';

export default function StashScreen() {
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const data = useData();
  const plus = usePlus();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.yarns;
    return data.yarns.filter((y) => [y.brand, y.name, y.colour, y.fibre].join(' ').toLowerCase().includes(s));
  }, [data.yarns, q]);
  const total = data.yarns.reduce((a, y) => a + (yarnMetres(y) ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.s }}>
      <FlatList
        data={plus ? list : []}
        keyExtractor={(y) => y.id}
        contentContainerStyle={{ padding: space.l, paddingBottom: 120, gap: space.m }}
        ListHeaderComponent={
          <View style={{ gap: space.m, marginBottom: space.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Title>{t('stash.title')}</Title>
              {plus ? <IconButton icon="plus" tone="accent" label={t('stash.add')} onPress={() => router.push('/yarn/new')} /> : null}
            </View>
            {plus && data.yarns.length ? (
              <>
                <Body muted>{t('stash.summary', { count: data.yarns.length, metres: formatNumber(total) })}</Body>
                <Field label={t('stash.search')} value={q} onChangeText={setQ} placeholder={t('stash.searchPlaceholder')} />
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <YarnCard y={item} uses={data.projects.filter((p) => p.yarnIds.includes(item.id)).length} />}
        ListEmptyComponent={
          plus ? (
            <EmptyState icon="archive" title={t('stash.emptyTitle')} body={t('stash.emptyBody')} action={<Button title={t('stash.add')} icon="plus" onPress={() => router.push('/yarn/new')} />} />
          ) : (
            <EmptyState icon="star" title={t('stash.lockedTitle')} body={t('stash.lockedBody')} action={<Button title={t('plus.unlock')} icon="star" onPress={() => router.push('/plus')} />} />
          )
        }
      />
    </View>
  );
}

function YarnCard({ y, uses }: { y: Yarn; uses: number }) {
  const { c } = useColors();
  const m = yarnMetres(y);
  const title = [y.brand, y.name].filter(Boolean).join(' ') || t('stash.untitled');
  return (
    <PressableScale label={`${title} ${y.colour}`} onPress={() => router.push(`/yarn/${y.id}`)} style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.l, overflow: 'hidden', minHeight: 84 }}>
      {y.photo ? (
        <Image source={{ uri: y.photo }} style={{ width: 84 }} contentFit="cover" />
      ) : (
        <View style={{ width: 84, backgroundColor: y.swatch ?? c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          {!y.swatch ? <Feather name="package" size={26} color={c.ink3} /> : null}
        </View>
      )}
      <View style={{ flex: 1, padding: space.m, gap: 2, justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ fontFamily: font.bodyBold, fontSize: 16, color: c.ink }}>
          {title}
        </Text>
        {y.colour ? (
          <Body small muted numberOfLines={1}>
            {y.colour}
          </Body>
        ) : null}
        <Body small muted>
          {[t('stash.balls', { count: y.balls }), m ? `${formatNumber(m)} m` : null, uses ? t('stash.inProjects', { count: uses }) : null].filter(Boolean).join('  ·  ')}
        </Body>
      </View>
    </PressableScale>
  );
}
