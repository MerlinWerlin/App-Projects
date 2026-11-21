/**
 * Record with the script over the camera, pinned near the lens so your eyes stay up.
 * Each take saves to Photos straight away (no watermark, no export step). Pick a section to record
 * just that part: the take stops itself at the end of the section (take-per-section workflow).
 * Voice Pace is off here: the camera owns the microphone while recording.
 */
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration, parseScript } from '../../src/core/script';
import { t } from '../../src/i18n';
import { reason } from '../../src/native/errors';
import { success, thud } from '../../src/native/haptics';
import { useApp } from '../../src/state/AppState';
import { FONT, PROMPTER, RADIUS, SPACE, STAGE, TYPE } from '../../src/theme/theme';
import { Btn, Bar, IconBtn, Txt } from '../../src/ui/kit';
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
      <ScrollView style={{ backgroundColor: th.ground }} contentContainerStyle={[st.perm, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <Txt v="display" accessibilityRole="header">{t('perm.camera.title')}</Txt>
        <Txt tone="ink2">{t('perm.camera.body')}</Txt>
        <View style={[st.permCard, { backgroundColor: th.sheet }]}>
          <Txt v="headline">{t('perm.mic.title')}</Txt>
          <Txt v="subhead" tone="ink2">{t('perm.mic.body')}</Txt>
        </View>
        {denied ? <Txt v="subhead" tone="danger">{t('perm.denied')}</Txt> : null}
        <Btn
          label={denied ? t('perm.openSettings') : t('perm.allow')}
          onPress={async () => {
            if (denied) return void Linking.openSettings();
            if (!camPerm?.granted) await askCam();
            if (!micPerm?.granted) await askMic();
          }}
          style={{ alignSelf: 'stretch', marginTop: SPACE.md }}
        />
        <Btn label={t('common.cancel')} kind="plain" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
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
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mode="video" onCameraReady={() => setReady(true)} />
      <View style={[st.scriptBox, { top: insets.top + 60, backgroundColor: `rgba(${STAGE.scrim},${prefs.scriptOpacity})`, borderColor: recording ? STAGE.onAir : STAGE.hairline }]}>
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
          <Text maxFontSizeMultiplier={1} style={st.count}>{count}</Text>
        </View>
      ) : null}
      <View style={[st.top, { paddingTop: insets.top + 8 }]}>
        <Bar tint="dark" style={st.round}>
          <IconBtn icon="close" label={t('prompt.close')} onPress={() => (recording ? cam.current?.stopRecording() : router.back())} color={STAGE.ink} />
        </Bar>
        <View style={{ flex: 1 }} />
        {recording ? (
          <Bar tint="dark" style={[st.chip, { flexDirection: 'row', gap: 7 }]}>
            <View style={st.recDot} />
            <Text maxFontSizeMultiplier={1.4} style={st.recText}>{formatDuration(secs)}</Text>
          </Bar>
        ) : null}
        <Bar tint="dark" style={[st.round, { opacity: recording ? 0.4 : 1 }]}>
          <IconBtn icon="camera-reverse-outline" label={t('record.flipCamera')} onPress={() => !recording && app.setPrefs({ recordCamera: facing === 'front' ? 'back' : 'front' })} color={STAGE.ink} />
        </Bar>
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable onPress={pickSection} disabled={recording || !parsed.sections.length} accessibilityRole="button" accessibilityLabel={`${t('record.section')}: ${section === null ? t('record.wholeScript') : parsed.sections[section]?.title ?? ''}`} style={{ width: 120 }}>
          <Bar tint="dark" style={[st.chip, { flexDirection: 'row', gap: 4, opacity: recording ? 0.5 : 1 }]}>
            <Text maxFontSizeMultiplier={1.4} style={[st.chipText, { flexShrink: 1 }]} numberOfLines={1}>
              {section === null ? t('record.wholeScript') : parsed.sections[section]?.title}
            </Text>
            {parsed.sections.length ? <Ionicons name="chevron-down" size={13} color={STAGE.ink2} /> : null}
          </Bar>
        </Pressable>
        <Pressable onPress={toggle} disabled={!ready} accessibilityRole="button" accessibilityLabel={recording ? t('record.stop') : t('record.start')} style={({ pressed }) => [st.shutter, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <View style={[st.shutterInner, recording && st.shutterStop]} />
        </Pressable>
        <View style={{ width: 120, alignItems: 'center' }}>
          {takes ? (
            <Bar tint="dark" style={[st.chip, { flexDirection: 'row', gap: 6 }]}>
              <Ionicons name="checkmark" size={15} color={STAGE.sign} />
              <Text maxFontSizeMultiplier={1.4} style={st.chipText} accessibilityLiveRegion="polite">{takes === 1 ? t('record.takesOne') : t('record.takes', { n: takes })}</Text>
            </Bar>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  perm: { paddingHorizontal: SPACE.lg, gap: SPACE.sm },
  permCard: { alignSelf: 'stretch', borderRadius: RADIUS.panel, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, marginTop: SPACE.xs, gap: 2 },
  scriptBox: { position: 'absolute', left: SPACE.sm, right: SPACE.sm, height: '38%', borderRadius: RADIUS.panel, overflow: 'hidden', borderWidth: 1.5 },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: FONT.scriptBold, fontSize: 150, color: STAGE.ink, fontVariant: ['tabular-nums'] },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: SPACE.xs },
  round: { borderRadius: RADIUS.control },
  chip: { borderRadius: RADIUS.control, paddingHorizontal: 14, minHeight: SPACE.touch, alignItems: 'center', justifyContent: 'center' },
  chipText: { ...TYPE.footnote, fontWeight: '600', color: STAGE.ink },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: STAGE.onAir },
  recText: { ...TYPE.time, color: STAGE.ink },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: STAGE.ink, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: STAGE.onAir },
  shutterStop: { width: 30, height: 30, borderRadius: 8 },
});
