/** Script library: search, pin, long-press menu, import. FlatList with memoised rows (no lag in long lists). */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayTitle, duplicate, searchScripts, type Script } from '../src/core/library';
import { formatDuration, parseScript, readSeconds } from '../src/core/script';
import { t } from '../src/i18n';
import { tap, thud } from '../src/native/haptics';
import { reason } from '../src/native/errors';
import { importScriptFile } from '../src/native/importFile';
import { useApp } from '../src/state/AppState';
import { Btn, IconBtn } from '../src/ui/kit';
import type { Theme } from '../src/theme/theme';

export default function Library() {
  const app = useApp();
  const { scripts, theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const list = useMemo(() => searchScripts(scripts, q), [scripts, q]);

  const open = useCallback((s: Script) => router.push({ pathname: '/edit/[id]', params: { id: s.id } }), [router]);

  const menu = useCallback(
    (s: Script) => {
      thud(app.prefs.haptics);
      const title = displayTitle(s, t('common.untitled'));
      const actions: { label: string; run: () => void; destructive?: boolean }[] = [
        { label: t('library.menu.prompt'), run: () => router.push({ pathname: '/prompt/[id]', params: { id: s.id } }) },
        { label: t('library.menu.record'), run: () => router.push({ pathname: '/record/[id]', params: { id: s.id } }) },
        { label: s.pinned ? t('library.menu.unpin') : t('library.menu.pin'), run: () => app.saveScript({ ...s, pinned: !s.pinned }) },
        { label: t('library.menu.duplicate'), run: () => app.saveScript(duplicate(s, t('library.copySuffix'))) },
        {
          label: t('library.menu.share'),
          run: () => {
            Share.share({ title, message: s.body }).catch((e: unknown) => Alert.alert(t('error.share', { reason: reason(e) })));
          },
        },
        {
          label: t('library.menu.delete'),
          destructive: true,
          run: () =>
            Alert.alert(t('library.confirmDelete', { title }), undefined, [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: () => app.deleteScript(s.id) },
            ]),
        },
      ];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title, options: [...actions.map((a) => a.label), t('common.cancel')], cancelButtonIndex: actions.length, destructiveButtonIndex: actions.findIndex((a) => a.destructive) },
          (i) => actions[i]?.run(),
        );
      } else {
        Alert.alert(title, undefined, [...actions.map((a) => ({ text: a.label, onPress: a.run, style: a.destructive ? ('destructive' as const) : ('default' as const) })), { text: t('common.cancel'), style: 'cancel' }]);
      }
    },
    [app, router],
  );

  const newScript = () => {
    tap(app.prefs.haptics);
    open(app.createScript());
  };

  const doImport = async () => {
    try {
      const r = await importScriptFile(app.can('import'));
      if (r === 'locked') return router.push('/plus');
      if (r) open(app.createScript(r.body, r.title));
    } catch (e) {
      Alert.alert(t('error.import', { reason: reason(e) }));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn icon="download-outline" label={t('library.import')} onPress={doImport} />
              <IconBtn icon="settings-outline" label={t('library.settings')} onPress={() => router.push('/settings')} />
            </View>
          ),
        }}
      />
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        ListHeaderComponent={
          <View style={[st.search, { backgroundColor: theme.chip }]}>
            <Ionicons name="search" size={18} color={theme.sub} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('library.search')}
              placeholderTextColor={theme.sub}
              style={[st.searchInput, { color: theme.ink }]}
              accessibilityLabel={t('library.search')}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          q ? (
            <Text style={[st.empty, { color: theme.sub }]}>{t('library.noMatches', { q })}</Text>
          ) : (
            <View style={st.emptyBox}>
              <Ionicons name="document-text-outline" size={48} color={theme.sub} />
              <Text style={[st.emptyTitle, { color: theme.ink }]}>{t('library.empty.title')}</Text>
              <Text style={[st.empty, { color: theme.sub }]}>{t('library.empty.body')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => <ScriptRow script={item} theme={theme} onOpen={open} onMenu={menu} />}
      />
      <View style={[st.fab, { bottom: insets.bottom + 16 }]}>
        <Btn label={t('library.new')} icon="add" onPress={newScript} style={st.fabBtn} />
      </View>
    </View>
  );
}

const ScriptRow = memo(function ScriptRow({ script, theme, onOpen, onMenu }: { script: Script; theme: Theme; onOpen: (s: Script) => void; onMenu: (s: Script) => void }) {
  const meta = useMemo(() => {
    const p = parseScript(script.body);
    return t('library.meta', { words: p.words.length, time: formatDuration(readSeconds(p, script.wpm)) });
  }, [script.body, script.wpm]);
  const title = displayTitle(script, t('common.untitled'));
  const preview = script.body.replace(/^#.*$/gm, '').replace(/\[\[[^\]]*\]\]|\[[^\]]*\]|\*/g, '').replace(/\s+/g, ' ').trim();
  return (
    <Pressable
      onPress={() => onOpen(script)}
      onLongPress={() => onMenu(script)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}`}
      accessibilityHint="Opens the script. Long press for more."
      style={({ pressed }) => [st.row, { backgroundColor: theme.card, borderColor: theme.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {script.pinned ? <Ionicons name="pin" size={14} color={theme.accent} /> : null}
          <Text style={[st.rowTitle, { color: theme.ink }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {preview ? (
          <Text style={[st.rowPreview, { color: theme.sub }]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
        <Text style={[st.rowMeta, { color: theme.sub }]}>{meta}</Text>
      </View>
      <IconBtn icon="ellipsis-horizontal" label="More" onPress={() => onMenu(script)} color={theme.sub} />
    </Pressable>
  );
});

const st = StyleSheet.create({
  search: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  row: { marginHorizontal: 16, marginVertical: 5, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  rowPreview: { fontSize: 14, marginTop: 4, lineHeight: 19 },
  rowMeta: { fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  fab: { position: 'absolute', left: 16, right: 16 },
  fabBtn: { minHeight: 54 },
});
