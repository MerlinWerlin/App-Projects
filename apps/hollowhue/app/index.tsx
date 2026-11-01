import { useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { percent, started } from '../src/core/progress';
import { type Scene, type Theme, layout } from '../src/core/scene';
import { currentLanguage, languageName, t, tx } from '../src/i18n';
import { SCENES } from '../src/scenes';
import { getProgress, useProgressVersion } from '../src/store/progress';
import { updateSettings, useSettings } from '../src/store/settings';
import { radius, space, type as ty, useColors } from '../src/theme/tokens';
import { Button, Chip, IconButton, Meter } from '../src/ui/kit';
import { SceneThumb } from '../src/ui/SceneArt';

type Filter = 'all' | Theme;

const SceneCard = memo(function SceneCard({ scene, width, version }: { scene: Scene; width: number; version: number }) {
  const { c } = useColors();
  const router = useRouter();
  const L = layout(scene);
  const p = getProgress(scene);
  const pct = percent(scene, p);
  const name = tx(`scene.${scene.id}.title`);
  void version;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('gallery.open', { name })}
      onPress={() => router.push(`/scene/${scene.id}`)}
      style={({ pressed }) => ({
        width,
        borderRadius: radius.lg,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        overflow: 'hidden',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: c.line }}>
        <SceneThumb L={L} progress={p} width={width} />
      </View>
      <View style={{ padding: space.md, gap: space.xs }}>
        <Text style={[ty.h2, { color: c.ink, fontSize: 18 }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[ty.small, { color: c.ink2 }]} numberOfLines={2}>
          {tx(`scene.${scene.id}.blurb`)}
        </Text>
        <Text style={[ty.small, { color: c.accent, fontWeight: '700' }]}>
          {scene.levels.length > 1 ? t('gallery.levels', { n: scene.levels.length }) : t('gallery.single')}
        </Text>
        <View style={{ gap: 4, marginTop: space.xs }}>
          <Meter value={pct} label={started(p) ? t('gallery.done', { n: Math.round(pct * 100) }) : t('gallery.notStarted')} />
          <Text style={[ty.small, { color: c.ink3 }]}>
            {started(p) ? t('gallery.done', { n: Math.max(1, Math.round(pct * 100)) }) : t('gallery.notStarted')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export default function Gallery() {
  const { c } = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const settings = useSettings();
  const version = useProgressVersion();
  const [filter, setFilter] = useState<Filter>('all');

  const themes = useMemo(() => [...new Set(SCENES.map((s) => s.theme))], []);
  const shown = filter === 'all' ? SCENES : SCENES.filter((s) => s.theme === filter);
  const pad = space.lg;
  const maxW = Math.min(width, 1180);
  const cols = maxW >= 900 ? 3 : maxW >= 560 ? 2 : 1;
  const gap = space.lg;
  const cardW = Math.floor((maxW - pad * 2 - gap * (cols - 1)) / cols);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">
            {t('gallery.title')}
          </Text>
          <Text style={[ty.body, { color: c.ink2 }]}>{t('gallery.subtitle')}</Text>
        </View>
        <IconButton icon="cog-outline" label={t('gallery.settings')} onPress={() => router.push('/settings')} />
      </View>
      {!settings.langLineDone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('lang.line', { name: languageName(currentLanguage()) })}. ${t('lang.change')}`}
          onPress={() => {
            updateSettings({ langLineDone: true });
            router.push('/language');
          }}
          style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
        >
          <Text style={[ty.small, { color: c.ink3 }]}>
            {t('lang.line', { name: languageName(currentLanguage()) })} · <Text style={{ color: c.accent, fontWeight: '700' }}>{t('lang.change')}</Text>
          </Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label={t('gallery.filter.all')} on={filter === 'all'} onPress={() => setFilter('all')} />
        {themes.map((th) => (
          <Chip key={th} label={tx(`theme.${th}`)} on={filter === th} onPress={() => setFilter(th)} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        key={cols}
        data={shown}
        keyExtractor={(s) => s.id}
        numColumns={cols}
        style={{ alignSelf: 'center', width: maxW }}
        contentContainerStyle={{ padding: pad, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }}
        columnWrapperStyle={cols > 1 ? { gap } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: space.md, padding: space.xl }}>
            <Text style={[ty.body, { color: c.ink2 }]}>{t('gallery.empty')}</Text>
            <Button kind="soft" label={t('gallery.showAll')} onPress={() => setFilter('all')} />
          </View>
        }
        ListFooterComponent={<Text style={[ty.small, { color: c.ink3, textAlign: 'center', marginTop: space.xl }]}>{t('gallery.comingSoon')}</Text>}
        renderItem={({ item }) => <SceneCard scene={item} width={cardW} version={version} />}
      />
    </View>
  );
}
