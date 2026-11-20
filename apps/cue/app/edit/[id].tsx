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
import { PROMPTER, RADIUS, SPACE, TYPE } from '../../src/theme/theme';
import { Bar, Btn, IconBtn, Segmented, Txt, usePressStyle } from '../../src/ui/kit';
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
  const press = usePressStyle();
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
      <View style={[st.missing, { backgroundColor: theme.ground }]}>
        <Text style={[TYPE.body, { color: theme.ink2 }]}>{t('common.untitled')}</Text>
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          headerRight: () => <IconBtn icon="share-outline" label={t('edit.export')} onPress={exportCaptions} />,
        }}
      />
      <View style={st.top}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={displayTitle({ title: '', body }, t('edit.titlePlaceholder'))}
          placeholderTextColor={theme.ink3}
          style={[TYPE.scriptTitle, st.title, { color: theme.ink }]}
          selectionColor={theme.go}
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
                ['edit.tool.heading', '#', () => insert('\n# ', '\n', 'Section')],
                ['edit.tool.emph', '*', () => insert('*', '*', 'word')],
                ['edit.tool.pause', '[ ]', () => insert(' [pause] ')],
                ['edit.tool.note', '[[ ]]', () => insert(' [[', ']] ', 'note')],
                ['edit.tool.break', '---', () => insert('\n---\n')],
              ] as const
            ).map(([k, token, fn]) => (
              <Pressable
                key={k}
                onPress={fn}
                accessibilityRole="button"
                accessibilityLabel={t(k)}
                hitSlop={{ top: 4, bottom: 4 }}
                style={({ pressed }) => [st.tool, { backgroundColor: pressed ? theme.pressed : theme.field }]}
              >
                <Text style={[TYPE.subhead, st.token, { color: theme.ink2 }]}>{token}</Text>
                <Text style={[TYPE.subhead, { color: theme.ink, fontWeight: '500' }]}>{t(k)}</Text>
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
            placeholderTextColor={theme.ink3}
            selectionColor={theme.go}
            style={[TYPE.scriptBody, st.body, { color: theme.ink }]}
            textAlignVertical="top"
            accessibilityLabel={t('edit.bodyPlaceholder')}
            autoFocus={!body}
          />
        </>
      ) : (
        <ScriptPreview parsed={parsed} palette={app.can('colors') ? PROMPTER[prefs.colors] : PROMPTER.classic} prefs={prefs} />
      )}

      <Bar style={[st.bar, { borderTopColor: theme.rule, paddingBottom: insets.bottom + SPACE.xs }]}>
        <View style={st.meta}>
          <View style={{ flex: 1 }} accessible accessibilityLabel={t('edit.readTime', { time: formatDuration(readSeconds(parsed, wpm)), wpm })} accessibilityLiveRegion="polite">
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[TYPE.timeLarge, { color: theme.ink }]}>{formatDuration(readSeconds(parsed, wpm))}</Text>
              <Txt v="footnote" tone="ink2">{t('edit.toRead')}</Txt>
            </View>
            <Txt v="footnote" tone="ink3" style={{ fontVariant: ['tabular-nums'] }}>{t('edit.wpm', { wpm })}</Txt>
          </View>
          <View style={[st.stepper, { backgroundColor: theme.field }]}>
            <IconBtn icon="remove" label={t('edit.slower')} onPress={() => setWpm((w) => clampWpm(w - 5))} size={18} color={theme.ink} />
            <View style={[st.stepRule, { backgroundColor: theme.rule }]} />
            <IconBtn icon="add" label={t('edit.faster')} onPress={() => setWpm((w) => clampWpm(w + 5))} size={18} color={theme.ink} />
          </View>
          <Pressable onPress={fit} accessibilityRole="button" accessibilityLabel={t('edit.fit')} hitSlop={4} style={({ pressed }) => [st.fit, press(pressed)]}>
            <Text style={[TYPE.subhead, { color: theme.goText, fontWeight: '600' }]}>{t('edit.fit')}</Text>
          </Pressable>
        </View>
        {takes.length && app.can('stats') ? (
          <Txt v="footnote" tone="ink2" style={{ marginTop: SPACE.xxs, fontVariant: ['tabular-nums'] }}>
            {t('edit.takes', { count: takes.length, best: formatDuration(Math.min(...takes)) })}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: SPACE.xs, marginTop: SPACE.sm }}>
          <Btn label={t('edit.prompt')} icon="play" onPress={() => go('/prompt/[id]')} style={{ flex: 1.4 }} disabled={!parsed.words.length} />
          <RecordBtn label={t('edit.record')} onPress={() => go('/record/[id]')} disabled={!parsed.words.length} />
        </View>
      </Bar>
    </KeyboardAvoidingView>
  );
}

/** Record: a plain button whose dot is the on-air red, the only red before recording starts. */
function RecordBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme, prefs } = useApp();
  const press = usePressStyle();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap(prefs.haptics);
        onPress();
      }}
      style={({ pressed }) => [st.record, { backgroundColor: theme.field }, press(pressed), disabled && { opacity: 0.4 }]}
    >
      <View style={[st.recDot, { backgroundColor: theme.onAir }]} />
      <Text style={[TYPE.headline, { color: theme.ink }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: SPACE.gutter, gap: SPACE.sm, paddingBottom: SPACE.xxs },
  title: { paddingVertical: 2 },
  tools: { paddingHorizontal: SPACE.gutter, gap: SPACE.xs, paddingVertical: SPACE.xs },
  tool: { minHeight: 36, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.chip, flexDirection: 'row', alignItems: 'center', gap: 6 },
  token: { fontWeight: '600' },
  body: { flex: 1, paddingHorizontal: SPACE.gutter + 2, paddingTop: SPACE.xs },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.round },
  stepRule: { width: StyleSheet.hairlineWidth, height: 18 },
  fit: { minHeight: SPACE.touch, paddingHorizontal: SPACE.xs, justifyContent: 'center' },
  record: { flex: 1, minHeight: 50, borderRadius: RADIUS.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  recDot: { width: 12, height: 12, borderRadius: 6 },
});
