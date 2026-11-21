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
import { Bar, Btn, IconBtn, Txt } from '../src/ui/kit';
import { RADIUS, SPACE, TYPE, type Theme } from '../src/theme/theme';

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
          { title, options: [...actions.map((a) => a.label), t('common.cancel')], cancelButtonIndex: actions.length, destructiveButtonIndex: actions.findIndex((a) => a.destructive), tintColor: theme.goText },
          (i) => actions[i]?.run(),
        );
      } else {
        Alert.alert(title, undefined, [...actions.map((a) => ({ text: a.label, onPress: a.run, style: a.destructive ? ('destructive' as const) : ('default' as const) })), { text: t('common.cancel'), style: 'cancel' }]);
      }
    },
    [app, router, theme.goText],
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
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
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
        initialNumToRender={10}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        ListHeaderComponent={
          <View style={[st.search, { backgroundColor: theme.field }]}>
            <Ionicons name="search" size={17} color={theme.ink3} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('library.search')}
              placeholderTextColor={theme.ink3}
              selectionColor={theme.go}
              style={[TYPE.body, st.searchInput, { color: theme.ink }]}
              accessibilityLabel={t('library.search')}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          q ? (
            <Txt tone="ink2" style={st.empty}>
              {t('library.noMatches', { q })}
            </Txt>
          ) : (
            <View style={st.emptyBox}>
              <Txt v="scriptTitle" style={{ textAlign: 'center' }} accessibilityRole="header">
                {t('library.empty.title')}
              </Txt>
              <Txt tone="ink2" style={{ textAlign: 'center' }}>
                {t('library.empty.body')}
              </Txt>
            </View>
          )
        }
        renderItem={({ item, index }) => <ScriptRow script={item} theme={theme} first={index === 0} onOpen={open} onMenu={menu} />}
      />
      <Bar style={[st.footer, { paddingBottom: insets.bottom + SPACE.xs, borderTopColor: theme.rule }]}>
        <Txt v="footnote" tone="ink2" max={1.6} style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {scripts.length === 1 ? t('library.countOne') : t('library.count', { n: scripts.length })}
        </Txt>
        <Btn label={t('library.new')} icon="add" onPress={newScript} style={{ paddingHorizontal: SPACE.lg - 4 }} />
      </Bar>
    </View>
  );
}

/** One running-order line: the script on the left, its read time in the right-hand time column. */
const ScriptRow = memo(function ScriptRow({ script, theme, first, onOpen, onMenu }: { script: Script; theme: Theme; first: boolean; onOpen: (s: Script) => void; onMenu: (s: Script) => void }) {
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
      accessibilityHint={t('library.openHint')}
      style={({ pressed }) => [st.row, { backgroundColor: pressed ? theme.pressed : 'transparent' }]}
    >
      {first ? <View style={[st.rule, { top: 0, backgroundColor: theme.rule }]} /> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={st.titleLine}>
          {script.pinned ? <Ionicons name="pin" size={13} color={theme.ink2} /> : null}
          <Text style={[TYPE.scriptHeading, { color: theme.ink, flexShrink: 1 }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {preview ? (
          <Text style={[TYPE.subhead, { color: theme.ink2 }]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
      </View>
      <View style={st.timeCol}>
        <Text style={[TYPE.time, { color: theme.ink }]} maxFontSizeMultiplier={1.6}>{time}</Text>
        <Text style={[TYPE.footnote, { color: theme.ink3, fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={1.6}>{t('library.words', { n: words })}</Text>
      </View>
      <Pressable onPress={() => onMenu(script)} accessibilityRole="button" accessibilityLabel={t('library.more', { title })} hitSlop={6} style={({ pressed }) => [st.more, { opacity: pressed ? 0.5 : 1 }]}>
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.ink3} />
      </Pressable>
      <View style={[st.rule, { bottom: 0, left: SPACE.gutter, backgroundColor: theme.rule }]} />
    </Pressable>
  );
});

const st = StyleSheet.create({
  search: { marginHorizontal: SPACE.gutter, marginTop: SPACE.xxs, marginBottom: SPACE.sm, borderRadius: RADIUS.field, paddingHorizontal: 10, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchInput: { flex: 1, paddingVertical: 8 },
  row: { paddingVertical: SPACE.sm + 2, paddingLeft: SPACE.gutter, paddingRight: SPACE.xxs, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 72 },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeCol: { alignItems: 'flex-end', minWidth: 60, gap: 1 },
  more: { width: SPACE.touch, height: SPACE.touch, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 96, paddingHorizontal: 40, gap: SPACE.xs },
  empty: { textAlign: 'center', marginTop: SPACE.xl, paddingHorizontal: SPACE.lg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SPACE.gutter, paddingTop: SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
});
