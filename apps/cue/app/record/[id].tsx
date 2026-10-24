/**
 * Record with the script over the camera, pinned near the lens so your eyes stay up.
 * Each take saves to Photos straight away (no watermark, no export step). Pick a section to record
 * just that part: the take stops itself at the end of the section (take-per-section workflow).
 * Voice Pace is off here: the camera owns the microphone while recording.
 */
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration, parseScript } from '../../src/core/script';
import { t } from '../../src/i18n';
import { reason } from '../../src/native/errors';
import { success, thud } from '../../src/native/haptics';
import { useApp } from '../../src/state/AppState';
import { PROMPTER } from '../../src/theme/theme';
import { Btn, IconBtn } from '../../src/ui/kit';
import { Prompter, type PrompterHandle } from '../../src/ui/Prompter';

export default function RecordScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const { prefs } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const script = app.getScript(String(id));
  const parsed = useMemo(() => parseScript(script?.body ?? ''), [script?.body]);
  const palette = PROMPTER.classic;
  const cam = useRef<CameraView>(null);
  const prompter = useRef<PrompterHandle>(null);
  const gate = useSharedValue(1);
  const [camPerm, askCam] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [section, setSection] = useState<number | null>(null);
  const [takes, setTakes] = useState(0);
  const [secs, setSecs] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const facing = prefs.recordCamera;

  const range = useMemo(() => {
    if (section === null) return { from: 0, to: parsed.words.length };
    const s = parsed.sections[section];
    const next = parsed.sections[section + 1];
    return { from: s?.firstWord ?? 0, to: next?.firstWord ?? parsed.words.length };
  }, [section, parsed]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const iv = setInterval(() => {
      setSecs((Date.now() - started) / 1000);
      const w = prompter.current?.currentWord() ?? 0;
      if (section !== null && w >= range.to) cam.current?.stopRecording();
    }, 250);
    return () => clearInterval(iv);
  }, [recording, section, range.to]);

  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      setCount(null);
      void begin();
      return;
    }
    const id2 = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!script) return null;

  if (!camPerm?.granted || !micPerm?.granted) {
    const denied = (camPerm && !camPerm.granted && !camPerm.canAskAgain) || (micPerm && !micPerm.granted && !micPerm.canAskAgain);
    return (
      <ScrollView style={{ backgroundColor: app.theme.bg }} contentContainerStyle={[st.perm, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="videocam-outline" size={56} color={app.theme.accent} />
        <Text style={[st.permTitle, { color: app.theme.ink }]}>{t('perm.camera.title')}</Text>
        <Text style={[st.permBody, { color: app.theme.sub }]}>{t('perm.camera.body')}</Text>
        <Text style={[st.permTitle, { color: app.theme.ink, fontSize: 18 }]}>{t('perm.mic.title')}</Text>
        <Text style={[st.permBody, { color: app.theme.sub }]}>{t('perm.mic.body')}</Text>
        {denied ? <Text style={[st.permBody, { color: app.theme.danger }]}>{t('perm.denied')}</Text> : null}
        <Btn
          label={denied ? t('perm.openSettings') : t('perm.allow')}
          onPress={async () => {
            if (denied) return void Linking.openSettings();
            if (!camPerm?.granted) await askCam();
            if (!micPerm?.granted) await askMic();
          }}
          style={{ alignSelf: 'stretch', marginTop: 12 }}
        />
        <Btn label={t('common.cancel')} kind="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 10 }} />
      </ScrollView>
    );
  }

  async function begin() {
    if (!cam.current) return;
    prompter.current?.jumpToWord(range.from, false);
    setSecs(0);
    setRecording(true);
    thud(prefs.haptics);
    try {
      const res = await cam.current.recordAsync({ maxDuration: 60 * 30 });
      setRecording(false);
      if (!res?.uri) return;
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) throw new Error(t('perm.photos.body'));
      await MediaLibrary.saveToLibraryAsync(res.uri);
      const n = takes + 1;
      setTakes(n);
      success(prefs.haptics);
      Alert.alert(t('record.saved', { n }));
    } catch (e) {
      setRecording(false);
      Alert.alert(t('error.record', { reason: reason(e) }));
    }
  }

  const toggle = () => {
    if (count !== null) return setCount(null);
    if (recording) {
      cam.current?.stopRecording();
      return;
    }
    if (!ready) return;
    if (prefs.countdown > 0) setCount(prefs.countdown);
    else void begin();
  };

  const pickSection = () => {
    Alert.alert(t('record.section'), undefined, [
      { text: t('record.wholeScript'), onPress: () => setSection(null) },
      ...parsed.sections.map((s, i) => ({ text: s.title, onPress: () => { setSection(i); prompter.current?.jumpToWord(s.firstWord, false); } })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <View style={st.fill}>
      <StatusBar hidden />
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mode="video" onCameraReady={() => setReady(true)} />
      <View style={[st.scriptBox, { top: insets.top + 56, backgroundColor: `rgba(0,0,0,${prefs.scriptOpacity})` }]}>
        <Prompter
          ref={prompter}
          parsed={parsed}
          prefs={{ ...prefs, fontSize: Math.min(prefs.fontSize, 34), readingLine: 0.25, mirrorH: false, mirrorV: false }}
          palette={palette}
          wpm={script.wpm}
          speed={1}
          running={recording}
          gate={gate}
          followWord={null}
          transparent
          reduceMotion={app.reduceMotion}
          onTap={toggle}
          onScrubStart={() => undefined}
          onFontSize={(fontSize) => app.setPrefs({ fontSize })}
          onEnd={() => cam.current?.stopRecording()}
        />
      </View>
      {count !== null ? (
        <View pointerEvents="none" style={st.center}>
          <Text style={st.count}>{count}</Text>
        </View>
      ) : null}
      <View style={[st.top, { paddingTop: insets.top + 6 }]}>
        <IconBtn icon="close" label={t('prompt.close')} onPress={() => (recording ? cam.current?.stopRecording() : router.back())} color="#fff" bg="rgba(0,0,0,0.4)" />
        <View style={{ flex: 1 }} />
        {recording ? (
          <View style={st.rec}>
            <View style={st.recDot} />
            <Text style={st.recText}>{formatDuration(secs)}</Text>
          </View>
        ) : null}
        <IconBtn icon="camera-reverse-outline" label={t('record.flipCamera')} onPress={() => !recording && app.setPrefs({ recordCamera: facing === 'front' ? 'back' : 'front' })} color="#fff" bg="rgba(0,0,0,0.4)" />
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable onPress={pickSection} disabled={recording || !parsed.sections.length} accessibilityRole="button" accessibilityLabel={t('record.section')} style={st.sectionChip}>
          <Text style={st.sectionText} numberOfLines={1}>
            {section === null ? t('record.wholeScript') : parsed.sections[section]?.title}
          </Text>
        </Pressable>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={recording ? t('record.stop') : t('record.start')} style={st.shutter}>
          <View style={[st.shutterInner, recording && st.shutterStop]} />
        </Pressable>
        <View style={st.sectionChip}>
          <Text style={st.sectionText}>{takes ? `${takes} ✓` : ' '}</Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  perm: { padding: 28, alignItems: 'center', gap: 10 },
  permTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  permBody: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  scriptBox: { position: 'absolute', left: 10, right: 10, height: '38%', borderRadius: 16, overflow: 'hidden' },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 120, fontWeight: '900', color: '#fff' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30' },
  recText: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  sectionChip: { width: 110, minHeight: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  sectionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF3B30' },
  shutterStop: { width: 30, height: 30, borderRadius: 6 },
});
