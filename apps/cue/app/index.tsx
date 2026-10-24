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
import { Btn, Glass, IconBtn, Txt } from '../src/ui/kit';
import { FONT, RADIUS, TYPE, type Theme } from '../src/theme/theme';

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
          { title, options: [...actions.map((a) => a.label), t('common.cancel')], cancelButtonIndex: actions.length, destructiveButtonIndex: actions.findIndex((a) => a.destructive), tintColor: theme.accentText },
          (i) => actions[i]?.run(),
        );
      } else {
        Alert.alert(title, undefined, [...actions.map((a) => ({ text: a.label, onPress: a.run, style: a.destructive ? ('destructive' as const) : ('default' as const) })), { text: t('common.cancel'), style: 'cancel' }]);
      }
    },
    [app, router, theme.accentText],
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
              <IconBtn icon="download-outline" label={t('library.import')} onPress={doImport} color={theme.accentText} />
              <IconBtn icon="options-outline" label={t('library.settings')} onPress={() => router.push('/settings')} color={theme.accentText} />
            </View>
          ),
        }}
      />
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View>
            <View style={[st.search, { backgroundColor: theme.chip }]}>
              <Ionicons name="search" size={17} color={theme.faint} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('library.search')}
                placeholderTextColor={theme.faint}
                selectionColor={theme.accent}
                style={[st.searchInput, { color: theme.ink }]}
                accessibilityLabel={t('library.search')}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
            {scripts.length > 0 && !q ? (
              <Txt v="caption" tone="faint" style={st.count}>
                {t('library.count', { n: scripts.length })}
              </Txt>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q ? (
            <Txt tone="sub" style={st.empty}>
              {t('library.noMatches', { q })}
            </Txt>
          ) : (
            <View style={st.emptyBox}>
              <View style={[st.emptyMark, { backgroundColor: theme.accentWash }]}>
                <Ionicons name="reader-outline" size={30} color={theme.accentText} />
              </View>
              <Txt v="title">{t('library.empty.title')}</Txt>
              <Txt tone="sub" style={{ textAlign: 'center' }}>
                {t('library.empty.body')}
              </Txt>
            </View>
          )
        }
        renderItem={({ item }) => <ScriptCard script={item} theme={theme} onOpen={open} onMenu={menu} />}
      />
      <Glass style={[st.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.line }]}>
        <Btn label={t('library.new')} icon="add" onPress={newScript} />
      </Glass>
    </View>
  );
}

const ScriptCard = memo(function ScriptCard({ script, theme, onOpen, onMenu }: { script: Script; theme: Theme; onOpen: (s: Script) => void; onMenu: (s: Script) => void }) {
  const { words, time } = useMemo(() => {
    const p = parseScript(script.body);
    return { words: p.words.length, time: formatDuration(readSeconds(p, script.wpm)) };
  }, [script.body, script.wpm]);
  const title = displayTitle(script, t('common.untitled'));
  const preview = script.body
    .replace(/^#.*$/gm, '')
    .replace(/\[\[[^\]]*\]\]|\[[^\]]*\]|\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    <Pressable
      onPress={() => onOpen(script)}
      onLongPress={() => onMenu(script)}
      accessibilityRole="button"
      accessibilityLabel={`${title}${script.pinned ? `, ${t('library.pinned')}` : ''}. ${t('library.meta', { words, time })}`}
      accessibilityHint="Opens the script. Long press for more."
      style={({ pressed }) => [st.card, theme.shadow, { backgroundColor: theme.card, borderColor: theme.line, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      {script.pinned ? <View style={[st.pinEdge, { backgroundColor: theme.accent }]} /> : null}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[TYPE.headline, { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {preview ? (
          <Text style={[TYPE.callout, { color: theme.sub }]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
        <View style={st.metaRow}>
          {script.pinned ? <Ionicons name="pin" size={12} color={theme.accentText} /> : null}
          <Text style={[TYPE.caption, { color: theme.faint }]}>{t('library.words', { n: words })}</Text>
        </View>
      </View>
      <View style={st.timeCol}>
        <Text style={[TYPE.numeral, { color: theme.ink }]}>{time}</Text>
        <Text style={[TYPE.caption, { color: theme.faint }]}>{t('library.readTime')}</Text>
      </View>
      <Pressable onPress={() => onMenu(script)} accessibilityRole="button" accessibilityLabel={`More for ${title}`} hitSlop={10} style={st.more}>
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.faint} />
      </Pressable>
    </Pressable>
  );
});

const st = StyleSheet.create({
  search: { marginHorizontal: 16, marginTop: 6, borderRadius: RADIUS.chip + 2, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10, fontFamily: FONT.body },
  count: { marginHorizontal: 22, marginTop: 14, marginBottom: 2 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'visible',
  },
  pinEdge: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  timeCol: { alignItems: 'flex-end', minWidth: 56 },
  more: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 40, gap: 10 },
  emptyMark: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  empty: { textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
