/**
 * Script library: search, pin, long-press menu, import. The next script hangs as a yellow sign band with its
 * read time set like a gate number; the rest form the board below. Memoised rows (no lag in long lists).
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayTitle, duplicate, searchScripts, type Script } from '../src/core/library';
import { formatDuration, parseScript, readSeconds } from '../src/core/script';
import { t } from '../src/i18n';
import { tap, thud } from '../src/native/haptics';
import { reason } from '../src/native/errors';
import { importScriptFile } from '../src/native/importFile';
import { useApp } from '../src/state/AppState';
import { Bar, Btn, IconBtn, Txt, usePressStyle } from '../src/ui/kit';
import { RADIUS, SIGN, SIGN_INK, SPACE, TYPE, type Theme } from '../src/theme/theme';

export default function Library() {
  const app = useApp();
  const { scripts, theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const list = useMemo(() => searchScripts(scripts, q), [scripts, q]);
  // The next script leads as the sign band; while searching, every match sits on the board.
  const next = q ? null : (list[0] ?? null);
  const board = next ? list.slice(1) : list;

  const open = useCallback((s: Script) => router.push({ pathname: '/edit/[id]', params: { id: s.id } }), [router]);
  const prompt = useCallback((s: Script) => router.push({ pathname: '/prompt/[id]', params: { id: s.id } }), [router]);

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
          { title, options: [...actions.map((a) => a.label), t('common.cancel')], cancelButtonIndex: actions.length, destructiveButtonIndex: actions.findIndex((a) => a.destructive), tintColor: theme.dark ? SIGN : SIGN_INK },
          (i) => actions[i]?.run(),
        );
      } else {
        Alert.alert(title, undefined, [...actions.map((a) => ({ text: a.label, onPress: a.run, style: a.destructive ? ('destructive' as const) : ('default' as const) })), { text: t('common.cancel'), style: 'cancel' }]);
      }
    },
    [app, router, theme.dark],
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
      {/* A native large-title bar (not a drawn header): pushing into the editor keeps the same nav bar,
          so the editor's text view is not left scrolled by a safe-area inset change mid-transition. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn icon="download-outline" label={t('library.import')} onPress={doImport} square />
              <IconBtn icon="settings-outline" label={t('library.settings')} onPress={() => router.push('/settings')} square />
            </View>
          ),
        }}
      />
      <Animated.FlatList
        data={board}
        keyExtractor={(s) => s.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={7}
        itemLayoutAnimation={app.reduceMotion ? undefined : LinearTransition.duration(240)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 108 }}
        ListHeaderComponent={
          <View>
            <View style={[st.search, { backgroundColor: theme.field }]}>
              <Ionicons name="search" size={18} color={theme.ink3} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('library.search')}
                placeholderTextColor={theme.ink3}
                selectionColor={theme.ink}
                style={[TYPE.body, st.searchInput, { color: theme.ink }]}
                accessibilityLabel={t('library.search')}
                clearButtonMode="while-editing"
                returnKeyType="search"
                maxFontSizeMultiplier={1.6}
              />
            </View>
            {next ? <NextBand key={next.id} script={next} onOpen={open} onPrompt={prompt} onMenu={menu} /> : null}
          </View>
        }
        ListEmptyComponent={
          next ? undefined : q ? (
            <Txt tone="ink2" style={st.empty}>
              {t('library.noMatches', { q })}
            </Txt>
          ) : (
            <View style={st.emptyBox}>
              <Txt v="display" accessibilityRole="header">
                {t('library.empty.title')}
              </Txt>
              <Txt tone="ink2">{t('library.empty.body')}</Txt>
            </View>
          )
        }
        renderItem={({ item }) => <BoardRow script={item} theme={theme} onOpen={open} onMenu={menu} />}
      />
      <Bar style={[st.footer, { paddingBottom: insets.bottom + SPACE.xs, borderTopColor: theme.rule }]}>
        <Txt v="footnote" tone="ink2" max={1.6} style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {scripts.length === 1 ? t('library.countOne') : t('library.count', { n: scripts.length })}
        </Txt>
        <Btn label={t('library.new')} icon="add" kind="ink" onPress={newScript} style={{ paddingHorizontal: SPACE.lg - 4 }} />
      </Bar>
    </View>
  );
}

function useScriptMeta(script: Script) {
  return useMemo(() => {
    const p = parseScript(script.body);
    const preview = script.body
      .replace(/^#.*$/gm, '')
      .replace(/\[\[[^\]]*\]\]|\[[^\]]*\]|\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { words: p.words.length, time: formatDuration(readSeconds(p, script.wpm)), preview };
  }, [script.body, script.wpm]);
}

/**
 * The next script, hung as a full-width sign band: an arrow and the title, the read time at gate-number
 * scale, and the one forward action (Prompt) as a black button on the yellow.
 */
function NextBand({ script, onOpen, onPrompt, onMenu }: { script: Script; onOpen: (s: Script) => void; onPrompt: (s: Script) => void; onMenu: (s: Script) => void }) {
  const { reduceMotion } = useApp();
  const press = usePressStyle();
  const { words, time, preview } = useScriptMeta(script);
  const title = displayTitle(script, t('common.untitled'));
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(320)} style={[st.band, { backgroundColor: SIGN }]}>
      <Pressable
        onPress={() => onOpen(script)}
        onLongPress={() => onMenu(script)}
        accessibilityRole="button"
        accessibilityLabel={`${title}${script.pinned ? `, ${t('library.pinned')}` : ''}. ${t('library.meta', { words, time })}`}
        accessibilityHint={t('library.openHint')}
        style={({ pressed }) => [st.bandTap, press(pressed)]}
      >
        <View style={st.bandTitleRow}>
          <Ionicons name={script.pinned ? 'pin' : 'arrow-forward'} size={26} color={SIGN_INK} style={{ marginTop: 3 }} />
          <Text style={[TYPE.title, { color: SIGN_INK, flex: 1 }]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {title}
          </Text>
        </View>
        {preview ? (
          <Text style={[TYPE.subhead, st.bandPreview]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {preview}
          </Text>
        ) : null}
      </Pressable>
      <View style={st.bandFoot}>
        <View style={st.bandTime} accessible accessibilityLabel={t('library.meta', { words, time })}>
          <Text style={[TYPE.monument, { color: SIGN_INK }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
            {time}
          </Text>
          <Text style={[TYPE.footnote, st.bandPreview]} maxFontSizeMultiplier={1.5}>
            {t('library.words', { n: words })}
          </Text>
        </View>
        <View style={st.bandActions}>
          <Btn label={t('library.menu.prompt')} icon="play" kind="onSign" onPress={() => onPrompt(script)} style={{ paddingHorizontal: SPACE.md, flexShrink: 1 }} />
          <Pressable onPress={() => onMenu(script)} accessibilityRole="button" accessibilityLabel={t('library.more', { title })} hitSlop={6} style={({ pressed }) => [st.more, { opacity: pressed ? 0.5 : 1 }]}>
            <Ionicons name="ellipsis-horizontal" size={22} color={SIGN_INK} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/** A board line: the script on the left, its read time in the right-hand column. */
const BoardRow = memo(function BoardRow({ script, theme, onOpen, onMenu }: { script: Script; theme: Theme; onOpen: (s: Script) => void; onMenu: (s: Script) => void }) {
  const { words, time, preview } = useScriptMeta(script);
  const title = displayTitle(script, t('common.untitled'));
  return (
    <Pressable
      onPress={() => onOpen(script)}
      onLongPress={() => onMenu(script)}
      accessibilityRole="button"
      accessibilityLabel={`${title}${script.pinned ? `, ${t('library.pinned')}` : ''}. ${t('library.meta', { words, time })}`}
      accessibilityHint={t('library.openHint')}
      style={({ pressed }) => [st.row, { backgroundColor: pressed ? theme.pressed : 'transparent', borderBottomColor: theme.rule }]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <View style={st.titleLine}>
          {script.pinned ? <Ionicons name="pin" size={14} color={theme.ink2} /> : null}
          <Text style={[TYPE.headline, { color: theme.ink, flexShrink: 1, fontSize: 19, lineHeight: 24 }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {preview ? (
          <Text style={[TYPE.subhead, { color: theme.ink2 }]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
      <View style={st.timeCol}>
        <Text style={[TYPE.time, { color: theme.ink }]} maxFontSizeMultiplier={1.5}>
          {time}
        </Text>
        <Text style={[TYPE.caption, { color: theme.ink3 }]} maxFontSizeMultiplier={1.5}>
          {t('library.words', { n: words })}
        </Text>
      </View>
      <Pressable onPress={() => onMenu(script)} accessibilityRole="button" accessibilityLabel={t('library.more', { title })} hitSlop={6} style={({ pressed }) => [st.more, { opacity: pressed ? 0.5 : 1 }]}>
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.ink3} />
      </Pressable>
    </Pressable>
  );
});

const st = StyleSheet.create({
  search: { marginHorizontal: SPACE.gutter, marginTop: SPACE.xs, marginBottom: SPACE.lg, borderRadius: RADIUS.control, paddingHorizontal: SPACE.sm, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  searchInput: { flex: 1, paddingVertical: 10 },
  band: { paddingTop: SPACE.lg, paddingBottom: SPACE.md, marginBottom: SPACE.xs },
  bandTap: { paddingHorizontal: SPACE.gutter, gap: SPACE.xs },
  bandTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  bandPreview: { color: '#3D3A2E' },
  bandFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: SPACE.xs, rowGap: SPACE.sm, paddingLeft: SPACE.gutter, paddingRight: SPACE.sm, marginTop: SPACE.md },
  bandTime: { flexGrow: 1, flexShrink: 0 },
  bandActions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  row: { paddingVertical: SPACE.md, paddingLeft: SPACE.gutter, paddingRight: SPACE.xxs, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeCol: { alignItems: 'flex-end', minWidth: 64, gap: 1 },
  more: { width: SPACE.touch, height: SPACE.touch, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { paddingTop: SPACE.xl, paddingHorizontal: SPACE.gutter, gap: SPACE.sm },
  empty: { marginTop: SPACE.lg, paddingHorizontal: SPACE.gutter },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SPACE.gutter, paddingTop: SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
});
