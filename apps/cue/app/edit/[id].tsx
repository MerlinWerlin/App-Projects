/**
 * Script editor: title, body, markup toolbar, read time, WPM, "fit to time", live preview that matches the
 * prompter (competitor complaint: the editor never shows what the prompter will), captions export.
 * Autosaves (debounced) so nothing is ever lost.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildCaptions, toSrt, toVtt } from '../../src/core/captions';
import { clampWpm, formatDuration, parseScript, readSeconds, wpmForTarget } from '../../src/core/script';
import { displayTitle } from '../../src/core/library';
import { t } from '../../src/i18n';
import { reason } from '../../src/native/errors';
import { success, tap } from '../../src/native/haptics';
import { useApp } from '../../src/state/AppState';
import { PROMPTER } from '../../src/theme/theme';
import { Btn, IconBtn, Segmented } from '../../src/ui/kit';
import { ScriptPreview } from '../../src/ui/ScriptPreview';

export default function Edit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const { theme, prefs } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const script = app.getScript(String(id));
  const [title, setTitle] = useState(script?.title ?? '');
  const [body, setBody] = useState(script?.body ?? '');
  const [wpm, setWpm] = useState(script?.wpm ?? 140);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const sel = useRef({ start: body.length, end: body.length });
  const parsed = useMemo(() => parseScript(body), [body]);

  // Debounced autosave.
  useEffect(() => {
    if (!script) return;
    if (title === script.title && body === script.body && wpm === script.wpm) return;
    const id2 = setTimeout(() => app.saveScript({ ...script, title, body, wpm }), 400);
    return () => clearTimeout(id2);
  }, [title, body, wpm, script, app]);

  if (!script) {
    return (
      <View style={[st.missing, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.sub }}>{t('common.untitled')}</Text>
      </View>
    );
  }

  const flush = () => app.saveScript({ ...script, title, body, wpm });

  const insert = (before: string, after = '', placeholder = '') => {
    tap(prefs.haptics);
    const { start, end } = sel.current;
    const chosen = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + chosen + after + body.slice(end);
    setBody(next);
    const caret = start + before.length + chosen.length + after.length;
    sel.current = { start: caret, end: caret };
  };

  const fit = () => {
    const options = [30, 60, 90, 120, 180];
    Alert.alert(t('edit.fitTitle'), undefined, [
      ...options.map((s) => ({
        text: formatDuration(s),
        onPress: () => {
          const w = wpmForTarget(parsed, s);
          setWpm(w);
          success(prefs.haptics);
          Alert.alert(t('edit.fitDone', { wpm: w }));
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const exportCaptions = () => {
    if (!app.can('captions')) return router.push('/plus');
    const caps = buildCaptions(parsed, wpm);
    const name = displayTitle({ title, body }, 'script').replace(/[^\w\- ]+/g, '').trim() || 'script';
    const share = async (ext: 'srt' | 'vtt') => {
      try {
        const f = new File(Paths.cache, `${name}.${ext}`);
        if (f.exists) f.delete();
        f.create();
        f.write(ext === 'srt' ? toSrt(caps) : toVtt(caps));
        if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
        await Sharing.shareAsync(f.uri, { mimeType: ext === 'srt' ? 'application/x-subrip' : 'text/vtt', dialogTitle: t('edit.exportTitle') });
      } catch (e) {
        Alert.alert(t('error.share', { reason: reason(e) }));
      }
    };
    Alert.alert(t('edit.exportTitle'), t('edit.exportBody'), [
      { text: '.srt', onPress: () => void share('srt') },
      { text: '.vtt', onPress: () => void share('vtt') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const takes = script.takes ?? [];
  const go = (path: '/prompt/[id]' | '/record/[id]') => {
    flush();
    router.push({ pathname: path, params: { id: script.id } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          headerRight: () => <IconBtn icon="document-text-outline" label={t('edit.export')} onPress={exportCaptions} />,
        }}
      />
      <View style={st.top}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('edit.titlePlaceholder')}
          placeholderTextColor={theme.sub}
          style={[st.title, { color: theme.ink }]}
          accessibilityLabel={t('edit.titlePlaceholder')}
          returnKeyType="next"
        />
        <Segmented
          label={t('edit.preview')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: t('edit.write') },
            { value: 'preview', label: t('edit.preview') },
          ]}
        />
      </View>

      {mode === 'write' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tools} keyboardShouldPersistTaps="always">
            {(
              [
                ['edit.tool.heading', () => insert('\n# ', '\n', 'Section')],
                ['edit.tool.emph', () => insert('*', '*', 'word')],
                ['edit.tool.pause', () => insert(' [pause] ')],
                ['edit.tool.note', () => insert(' [[', ']] ', 'note')],
                ['edit.tool.break', () => insert('\n---\n')],
              ] as const
            ).map(([k, fn]) => (
              <Pressable key={k} onPress={fn} accessibilityRole="button" accessibilityLabel={t(k)} style={[st.tool, { backgroundColor: theme.chip }]}>
                <Text style={{ color: theme.ink, fontWeight: '600' }}>{t(k)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={body}
            onChangeText={setBody}
            onSelectionChange={(e) => {
              sel.current = e.nativeEvent.selection;
            }}
            multiline
            placeholder={t('edit.bodyPlaceholder')}
            placeholderTextColor={theme.sub}
            style={[st.body, { color: theme.ink }]}
            textAlignVertical="top"
            accessibilityLabel={t('edit.bodyPlaceholder')}
            autoFocus={!body}
          />
        </>
      ) : (
        <ScriptPreview parsed={parsed} palette={app.can('colors') ? PROMPTER[prefs.colors] : PROMPTER.classic} prefs={prefs} />
      )}

      <View style={[st.bar, { borderTopColor: theme.line, paddingBottom: insets.bottom + 8, backgroundColor: theme.bg }]}>
        <View style={st.meta}>
          <Text style={{ color: theme.sub, fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="polite">
            {t('edit.readTime', { time: formatDuration(readSeconds(parsed, wpm)), wpm })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconBtn icon="remove" label="Slower" onPress={() => setWpm((w) => clampWpm(w - 5))} size={18} />
            <IconBtn icon="add" label="Faster" onPress={() => setWpm((w) => clampWpm(w + 5))} size={18} />
            <Pressable onPress={fit} accessibilityRole="button" style={[st.fit, { borderColor: theme.line }]}>
              <Text style={{ color: theme.ink, fontWeight: '600' }}>{t('edit.fit')}</Text>
            </Pressable>
          </View>
        </View>
        {takes.length && app.can('stats') ? (
          <Text style={{ color: theme.sub, marginBottom: 6 }}>{t('edit.takes', { count: takes.length, best: formatDuration(Math.min(...takes)) })}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label={t('edit.prompt')} icon="play" onPress={() => go('/prompt/[id]')} style={{ flex: 1 }} disabled={!parsed.words.length} />
          <Btn label={t('edit.record')} icon="videocam" kind="secondary" onPress={() => go('/record/[id]')} style={{ flex: 1 }} disabled={!parsed.words.length} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: 16, gap: 10, paddingBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', paddingVertical: 4 },
  tools: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  tool: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center' },
  body: { flex: 1, fontSize: 18, lineHeight: 26, paddingHorizontal: 16, paddingTop: 8 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fit: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, minHeight: 34, justifyContent: 'center', marginLeft: 4 },
});
