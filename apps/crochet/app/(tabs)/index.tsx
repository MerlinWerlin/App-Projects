// Projects: your works in progress, newest first, with the live row count on each card.
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SAMPLE_BALL } from '../../src/content/samples';
import { formatDuration, mainCounter, sortProjects, stats, timeWorked, type Project, type ProjectStatus } from '../../src/core/model';
import { t } from '../../src/i18n';
import { addProject, deleteProject, duplicateProject, restoreProject, updateProject, useData } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { font, radius, space, useColors, yarnColour } from '../../src/theme/tokens';
import { haptic } from '../../src/ui/haptics';
import { Body, Button, Chip, EmptyState, FadeIn, IconButton, PressableScale, Title } from '../../src/ui/kit';
import { useToast } from '../../src/ui/Toast';

type Filter = 'active' | 'planned' | 'finished' | 'all';

export default function ProjectsScreen() {
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const data = useData();
  const toast = useToast();
  const { terms } = useSettings();
  const [filter, setFilter] = useState<Filter>('active');

  const list = useMemo(() => {
    const all = sortProjects(data.projects);
    if (filter === 'all') return all;
    if (filter === 'finished') return all.filter((p) => p.status === 'finished' || p.status === 'frogged');
    return all.filter((p) => p.status === filter);
  }, [data.projects, filter]);
  const s = stats(data.projects);

  const startSample = () => {
    const p = addProject(SAMPLE_BALL.name, {
      designer: SAMPLE_BALL.designer,
      hookMm: SAMPLE_BALL.hookMm,
      pattern: { text: SAMPLE_BALL.text, terms: 'US', step: 0, done: [] },
      tags: ['amigurumi'],
    });
    haptic('success');
    router.push(`/project/${p.id}`);
  };

  const remove = (p: Project) => {
    const gone = deleteProject(p.id);
    if (gone) toast({ text: t('projects.deleted', { name: gone.name }), action: { label: t('common.undo'), run: () => restoreProject(gone) } });
  };

  const menu = (p: Project) => {
    haptic('heavy');
    const opts = [
      p.pinned ? t('projects.unpin') : t('projects.pin'),
      t('projects.duplicate'),
      p.status === 'finished' ? t('projects.markActive') : t('projects.markFinished'),
      t('common.delete'),
      t('common.cancel'),
    ];
    const run = (i: number) => {
      if (i === 0) updateProject(p.id, (q) => ({ ...q, pinned: !q.pinned }), false);
      if (i === 1) {
        const d = duplicateProject(p.id);
        if (d) toast(t('projects.duplicated'));
      }
      if (i === 2) {
        const next: ProjectStatus = p.status === 'finished' ? 'active' : 'finished';
        updateProject(p.id, (q) => ({ ...q, status: next, finishedAt: next === 'finished' ? Date.now() : undefined, timeMs: timeWorked(q), timerStart: undefined }));
        if (next === 'finished') {
          haptic('success');
          toast(t('projects.finishedToast'));
        }
      }
      if (i === 3) remove(p);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: opts, destructiveButtonIndex: 3, cancelButtonIndex: 4, title: p.name }, run);
    } else {
      Alert.alert(p.name, undefined, [
        { text: opts[0], onPress: () => run(0) },
        { text: opts[1], onPress: () => run(1) },
        { text: opts[2], onPress: () => run(2) },
        { text: opts[3], style: 'destructive', onPress: () => run(3) },
        { text: opts[4], style: 'cancel' },
      ]);
    }
  };

  const header = (
    <View style={{ gap: space.m, marginBottom: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title>{t('projects.title')}</Title>
        <IconButton icon="plus" tone="accent" label={t('project.new')} onPress={() => router.push('/project/new')} />
      </View>
      {data.projects.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Stat value={String(s.active)} label={t('projects.statActive')} />
          <Stat value={String(s.thisYearFinished)} label={t('projects.statFinishedYear')} />
          <Stat value={s.totalMs > 0 ? formatDuration(s.totalMs) : '0 min'} label={t('projects.statTime')} />
        </View>
      ) : null}
      {data.projects.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
          {(['active', 'planned', 'finished', 'all'] as const).map((f) => (
            <Chip key={f} label={t(`projects.filter.${f}`)} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.s }}>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.l, paddingBottom: 120, gap: space.m }}
        ListHeaderComponent={header}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item, index }) => (
          <FadeIn delay={index * 30}>
            <ProjectCard p={item} onPress={() => router.push(`/project/${item.id}`)} onLongPress={() => menu(item)} terms={terms} />
          </FadeIn>
        )}
        ListEmptyComponent={
          data.projects.length === 0 ? (
            <EmptyState
              icon="feather"
              title={t('projects.emptyTitle')}
              body={t('projects.emptyBody')}
              action={
                <View style={{ gap: space.s, alignSelf: 'stretch' }}>
                  <Button title={t('projects.startFirst')} icon="plus" onPress={() => router.push('/project/new')} />
                  <Button title={t('projects.trySample')} kind="secondary" icon="play" onPress={startSample} />
                </View>
              }
            />
          ) : (
            <Body muted style={{ textAlign: 'center', marginTop: space.xl }}>
              {t('projects.noneInFilter')}
            </Body>
          )
        }
      />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { c } = useColors();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.m, padding: space.m, gap: 2 }}>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.heavy, fontSize: 18, color: c.ink }}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 12, color: c.ink2 }}>
        {label}
      </Text>
    </View>
  );
}

function ProjectCard({ p, onPress, onLongPress }: { p: Project; onPress: () => void; onLongPress: () => void; terms: string }) {
  const { c, dark } = useColors();
  const col = yarnColour(p.colour, dark);
  const m = mainCounter(p);
  const pct = m?.target ? Math.min(1, m.value / m.target) : undefined;
  const timer = !!p.timerStart;
  const statusText = t(`status.${p.status}`);
  const rowWord = m?.label || t('counter.row');
  return (
    <PressableScale
      label={`${p.name}, ${rowWord} ${m?.value ?? 0}, ${statusText}`}
      hint={t('projects.cardHint')}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{ backgroundColor: col.bg, borderRadius: radius.l, overflow: 'hidden', flexDirection: 'row', minHeight: 104 }}
    >
      {p.cover ? (
        <Image source={{ uri: p.cover }} style={{ width: 96 }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ width: 96, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="circle" size={34} color={col.ink} style={{ opacity: 0.5 }} />
        </View>
      )}
      <View style={{ flex: 1, padding: space.m, gap: 4, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {p.pinned ? <Feather name="bookmark" size={14} color={col.ink} /> : null}
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ flex: 1, fontFamily: font.displayMed, fontSize: 19, color: dark ? c.ink : c.ink }}>
            {p.name}
          </Text>
          {timer ? <Feather name="clock" size={14} color={col.ink} /> : null}
        </View>
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.heavy, fontSize: 15, color: col.ink }}>
          {rowWord} {m?.value ?? 0}
          {m?.target ? ` / ${m.target}` : ''}
          {p.status !== 'active' ? `  ·  ${statusText}` : ''}
        </Text>
        {pct != null ? (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', overflow: 'hidden', marginTop: 4 }}>
            <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: col.ink }} />
          </View>
        ) : null}
        {p.timeMs > 0 || p.timerStart ? (
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bodySemi, fontSize: 12, color: c.ink2 }}>
            {formatDuration(timeWorked(p))}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}
