import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { percent, started } from '../src/core/progress';
import { type Scene, type Theme, type Difficulty, layout } from '../src/core/scene';
import { browseScenes, type BrowseFilter } from '../src/core/catalog';
import { currentLanguage, languageName, t, tx } from '../src/i18n';
import { CATALOG_SCENES, SCENES } from '../src/scenes';
import { getProgress, useProgressVersion } from '../src/store/progress';
import { updateSettings, useSettings } from '../src/store/settings';
import { radius, space, type as ty, useColors } from '../src/theme/tokens';
import { Button, Chip, IconButton, Meter } from '../src/ui/kit';
import { SceneThumb } from '../src/ui/SceneArt';

type Filter = BrowseFilter;
const icons: Partial<Record<Theme, string>> = { animals: 'cat', flowers: 'flower-outline', sealife: 'fish', places: 'home-city-outline', patterns: 'flower-tulip-outline' };

function CategoryBubble({ label, icon, selected, onPress, testID }: { label: string; icon: string; selected: boolean; onPress: () => void; testID: string }) {
  const { c } = useColors();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={{ width: 84, minHeight: 100, alignItems: 'center', gap: space.sm }}>
    <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: selected ? 3 : 1, borderColor: selected ? c.accent : c.line, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={icon as never} size={30} color={c.accent} />
    </View>
    <Text style={[ty.small, { color: selected ? c.accent : c.ink2, textAlign: 'center' }]}>{label}</Text>
  </Pressable>;
}

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
          {scene.levels.length > 1 ? t('gallery.levels', { n: scene.levels.length - 1 }) : t('gallery.single')}
        </Text>
        {scene.difficulty ? <Text style={[ty.small, { color: c.ink2 }]}>{tx(`difficulty.${scene.difficulty}`)}</Text> : null}
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
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const list = useRef<FlatList<Scene>>(null);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filter, difficulty]);

  const themes = useMemo(() => (['animals', 'flowers', 'sealife', 'places', 'patterns'] as Theme[]).filter((theme) => CATALOG_SCENES.some((scene) => scene.theme === theme)), []);
  const shown = browseScenes(SCENES, filter, difficulty, (scene) => started(getProgress(scene)));
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
        </View>
        <IconButton icon="palette-outline" label={t('gallery.saved')} onPress={() => { setFilter('saved'); setDifficulty('all'); }} />
        <IconButton icon="cog-outline" label={t('gallery.settings')} onPress={() => router.push('/settings')} />
      </View>
      <Text style={[ty.body, { color: c.ink2 }]}>{t('gallery.subtitle')}</Text>
      {!settings.langLineDone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('lang.line', { name: languageName(currentLanguage()) })}. ${t('lang.change')}`}
          onPress={() => {
            updateSettings({ langLineDone: true });
            router.push('/language');
          }}
          style={{ alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={[ty.small, { color: c.ink3 }]}>
            {t('lang.line', { name: languageName(currentLanguage()) })} · <Text style={{ color: c.accent, fontWeight: '700' }}>{t('lang.change')}</Text>
          </Text>
        </Pressable>
      ) : null}
      <View style={{ backgroundColor: c.accentSoft, padding: space.lg, borderRadius: radius.md, gap: space.xs }}>
        <Text style={[ty.bodyBold, { color: c.accent }]}>{t('release.title')}</Text>
        <Text style={[ty.small, { color: c.ink2 }]}>{t('release.body')}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip testID="collection-all" label={t('gallery.filter.all')} on={filter !== 'mega' && filter !== 'saved'} onPress={() => setFilter('all')} />
        <Chip testID="collection-mega" label={t('gallery.mega')} on={filter === 'mega'} onPress={() => { setFilter('mega'); setDifficulty('all'); }} />
        <Chip testID="collection-saved" label={t('gallery.saved')} on={filter === 'saved'} onPress={() => { setFilter('saved'); setDifficulty('all'); }} />
      </View>
      {filter !== 'mega' && filter !== 'saved' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}>
        <CategoryBubble testID="category-all" label={t('gallery.filter.all')} icon="view-grid-outline" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {themes.map((theme) => <CategoryBubble key={theme} testID={`category-${theme}`} label={tx(`theme.${theme}`)} icon={icons[theme] ?? 'shape-outline'} selected={filter === theme} onPress={() => setFilter(theme)} />)}
      </ScrollView> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip testID="difficulty-all" label={t('gallery.allLevels')} on={difficulty === 'all'} onPress={() => setDifficulty('all')} />
        {(['beginner', 'intermediate', 'advanced'] as const).map((level) => <Chip key={level} testID={`difficulty-${level}`} label={tx(`difficulty.${level}`)} on={difficulty === level} onPress={() => setDifficulty(level)} />)}
      </ScrollView>
      <Text style={[ty.small, { color: c.ink2 }]}>{t('gallery.levelHint')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        ref={list}
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
            <Text style={[ty.body, { color: c.ink2 }]}>{filter === 'saved' ? t('gallery.noSaved') : t('gallery.empty')}</Text>
            <Button kind="soft" label={t('gallery.showAll')} onPress={() => { setFilter('all'); setDifficulty('all'); }} />
          </View>
        }
        ListFooterComponent={<Text style={[ty.small, { color: c.ink3, textAlign: 'center', marginTop: space.xl }]}>{t('gallery.comingSoon')}</Text>}
        renderItem={({ item }) => <SceneCard scene={item} width={cardW} version={version} />}
      />
    </View>
  );
}
