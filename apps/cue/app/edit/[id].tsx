/**
 * Script editor: title, body, markup toolbar, read time, WPM, "fit to time", live preview that matches the
 * prompter (competitor complaint: the editor never shows what the prompter will), captions export.
 * Autosaves (debounced) so nothing is ever lost.
 */
import { Ionicons } from '@expo/vector-icons';
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
import { Btn, Glass, IconBtn, Segmented, Txt, type IconName } from '../../src/ui/kit';
import { FONT, RADIUS, TYPE } from '../../src/theme/theme';
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
          selectionColor={theme.accent}
          accessibilityLabel={t('edit.titlePlaceholder')}
          returnKeyType="next"
        />
        <Segmented
          compact
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
          <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={st.tools} keyboardShouldPersistTaps="always">
            {(
              [
                ['edit.tool.heading', 'bookmark-outline', () => insert('\n# ', '\n', 'Section')],
                ['edit.tool.emph', 'color-wand-outline', () => insert('*', '*', 'word')],
                ['edit.tool.pause', 'pause-outline', () => insert(' [pause] ')],
                ['edit.tool.note', 'chatbubble-ellipses-outline', () => insert(' [[', ']] ', 'note')],
                ['edit.tool.break', 'cut-outline', () => insert('\n---\n')],
              ] as const
            ).map(([k, icon, fn]) => (
              <Pressable
                key={k}
                onPress={fn}
                accessibilityRole="button"
                accessibilityLabel={t(k)}
                style={({ pressed }) => [st.tool, { backgroundColor: theme.card, borderColor: theme.line, opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name={icon as IconName} size={15} color={theme.accentText} />
                <Text style={{ color: theme.ink, fontFamily: FONT.bodyBold, fontSize: 14 }}>{t(k)}</Text>
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
            placeholderTextColor={theme.faint}
            selectionColor={theme.accent}
            style={[st.body, { color: theme.ink }]}
            textAlignVertical="top"
            accessibilityLabel={t('edit.bodyPlaceholder')}
            autoFocus={!body}
          />
        </>
      ) : (
        <ScriptPreview parsed={parsed} palette={app.can('colors') ? PROMPTER[prefs.colors] : PROMPTER.classic} prefs={prefs} />
      )}

      <Glass style={[st.bar, { borderTopColor: theme.line, paddingBottom: insets.bottom + 10 }]}>
        <View style={st.meta}>
          <View accessible accessibilityLabel={t('edit.readTime', { time: formatDuration(readSeconds(parsed, wpm)), wpm })} accessibilityLiveRegion="polite">
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[TYPE.numeral, { color: theme.ink, fontSize: 28, lineHeight: 32 }]}>{formatDuration(readSeconds(parsed, wpm))}</Text>
              <Txt v="caption" tone="faint">{t('edit.toRead')}</Txt>
            </View>
            <Txt v="caption" tone="sub">{t('edit.wpm', { wpm })}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <View style={[st.stepper, { backgroundColor: theme.chip }]}>
              <IconBtn icon="remove" label="Slower" onPress={() => setWpm((w) => clampWpm(w - 5))} size={18} />
              <IconBtn icon="add" label="Faster" onPress={() => setWpm((w) => clampWpm(w + 5))} size={18} />
            </View>
            <Pressable onPress={fit} accessibilityRole="button" style={({ pressed }) => [st.fit, { borderColor: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="timer-outline" size={15} color={theme.accentText} />
              <Text style={{ color: theme.accentText, fontFamily: FONT.bodyBold, fontSize: 14 }}>{t('edit.fit')}</Text>
            </Pressable>
          </View>
        </View>
        {takes.length && app.can('stats') ? (
          <Txt v="caption" tone="sub" style={{ marginTop: 6 }}>
            {t('edit.takes', { count: takes.length, best: formatDuration(Math.min(...takes)) })}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Btn label={t('edit.prompt')} icon="play" onPress={() => go('/prompt/[id]')} style={{ flex: 1.3 }} disabled={!parsed.words.length} />
          <Btn label={t('edit.record')} icon="radio-button-on" kind="secondary" onPress={() => go('/record/[id]')} style={{ flex: 1 }} disabled={!parsed.words.length} />
        </View>
      </Glass>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  title: { ...TYPE.title, fontSize: 28, lineHeight: 34, paddingVertical: 2 },
  tools: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  tool: { minHeight: 36, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { flex: 1, fontFamily: FONT.body, fontSize: 19, lineHeight: 29, paddingHorizontal: 18, paddingTop: 8 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', borderRadius: RADIUS.pill },
  fit: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 6 },
});
