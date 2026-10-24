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
import { FONT, PROMPTER, RADIUS } from '../../src/theme/theme';
import { Btn, Glass, IconBtn, Txt } from '../../src/ui/kit';
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
    const th = app.theme;
    return (
      <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={[st.perm, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <View style={[st.permMark, { backgroundColor: th.accentWash }]}>
          <Ionicons name="videocam-outline" size={34} color={th.accentText} />
        </View>
        <Txt v="largeTitle" style={{ textAlign: 'center' }}>{t('perm.camera.title')}</Txt>
        <Txt tone="sub" style={st.permBody}>{t('perm.camera.body')}</Txt>
        <View style={[st.permCard, { backgroundColor: th.card, borderColor: th.line }]}>
          <View style={st.permRow}>
            <Ionicons name="mic-outline" size={20} color={th.accentText} />
            <View style={{ flex: 1 }}>
              <Txt v="headline">{t('perm.mic.title')}</Txt>
              <Txt v="callout" tone="sub">{t('perm.mic.body')}</Txt>
            </View>
          </View>
        </View>
        {denied ? <Txt v="callout" tone="danger" style={st.permBody}>{t('perm.denied')}</Txt> : null}
        <Btn
          label={denied ? t('perm.openSettings') : t('perm.allow')}
          onPress={async () => {
            if (denied) return void Linking.openSettings();
            if (!camPerm?.granted) await askCam();
            if (!micPerm?.granted) await askMic();
          }}
          style={{ alignSelf: 'stretch', marginTop: 20 }}
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
      <View style={[st.scriptBox, { top: insets.top + 60, backgroundColor: `rgba(7,8,12,${prefs.scriptOpacity})`, borderColor: recording ? TALLY : 'rgba(255,255,255,0.08)' }]}>
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
      <View style={[st.top, { paddingTop: insets.top + 8 }]}>
        <Glass tint="dark" style={st.round}>
          <IconBtn icon="close" label={t('prompt.close')} onPress={() => (recording ? cam.current?.stopRecording() : router.back())} color="#F1EEE6" />
        </Glass>
        <View style={{ flex: 1 }} />
        {recording ? (
          <Glass tint="dark" style={[st.chip, { flexDirection: 'row', gap: 7 }]}>
            <View style={st.recDot} />
            <Text style={st.recText}>{formatDuration(secs)}</Text>
          </Glass>
        ) : null}
        <Glass tint="dark" style={st.round}>
          <IconBtn icon="camera-reverse-outline" label={t('record.flipCamera')} onPress={() => !recording && app.setPrefs({ recordCamera: facing === 'front' ? 'back' : 'front' })} color="#F1EEE6" />
        </Glass>
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable onPress={pickSection} disabled={recording || !parsed.sections.length} accessibilityRole="button" accessibilityLabel={t('record.section')} style={{ width: 120 }}>
          <Glass tint="dark" style={[st.chip, { opacity: recording ? 0.5 : 1 }]}>
            <Text style={st.chipText} numberOfLines={1}>
              {section === null ? t('record.wholeScript') : parsed.sections[section]?.title}
            </Text>
          </Glass>
        </Pressable>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={recording ? t('record.stop') : t('record.start')} style={({ pressed }) => [st.shutter, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <View style={[st.shutterInner, recording && st.shutterStop]} />
        </Pressable>
        <View style={{ width: 120, alignItems: 'center' }}>
          {takes ? (
            <Glass tint="dark" style={[st.chip, { flexDirection: 'row', gap: 6 }]}>
              <Ionicons name="checkmark-circle" size={15} color="#D9AD5E" />
              <Text style={st.chipText}>{takes}</Text>
            </Glass>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const TALLY = '#E2463B';

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  perm: { paddingHorizontal: 28, alignItems: 'center', gap: 12 },
  permMark: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  permBody: { textAlign: 'center' },
  permCard: { alignSelf: 'stretch', borderRadius: RADIUS.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 10 },
  permRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  scriptBox: { position: 'absolute', left: 12, right: 12, height: '38%', borderRadius: RADIUS.card, overflow: 'hidden', borderWidth: 1.5 },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: FONT.display, fontSize: 150, color: '#F1EEE6', fontVariant: ['tabular-nums'] },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  round: { borderRadius: 22 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONT.bodyBold, fontSize: 13.5, color: '#F1EEE6' },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: TALLY },
  recText: { fontFamily: FONT.display, fontSize: 16, color: '#F1EEE6', fontVariant: ['tabular-nums'] },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: 'rgba(241,238,230,0.95)', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: TALLY },
  shutterStop: { width: 30, height: 30, borderRadius: 8 },
});
