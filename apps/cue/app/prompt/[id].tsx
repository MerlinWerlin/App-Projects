/**
 * Full-screen prompter: countdown, steady / Voice Pace / Voice Follow, speed nudges, mirror & flip,
 * jump to section, resume where you left off, rehearsal timer, landscape, screen kept awake.
 * Controls fade away while reading and come back on tap.
 */
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Follower } from '../../src/core/follow';
import { recordTake } from '../../src/core/library';
import { nudgeSpeed, type PaceMode } from '../../src/core/pace';
import { formatDuration, parseScript } from '../../src/core/script';
import { getLocale, t } from '../../src/i18n';
import { success, tap, thud } from '../../src/native/haptics';
import { loadSpeech, type SpeechSession } from '../../src/native/speech';
import { useApp } from '../../src/state/AppState';
import { PROMPTER } from '../../src/theme/theme';
import { IconBtn } from '../../src/ui/kit';
import { Prompter, type PrompterHandle } from '../../src/ui/Prompter';
import { useVoiceGate } from '../../src/ui/useVoiceGate';

export default function PromptScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const { prefs } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const script = app.getScript(String(id));
  const parsed = useMemo(() => parseScript(script?.body ?? ''), [script?.body]);
  const palette = app.can('colors') ? PROMPTER[prefs.colors] : PROMPTER.classic;
  const ref = useRef<PrompterHandle>(null);

  const [mode, setMode] = useState<PaceMode>(prefs.pace === 'follow' && !loadSpeech() ? 'voice' : prefs.pace);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const [followWord, setFollowWord] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);
  const fromTop = useRef(true);
  const voiceCounted = useRef(false);
  const speech = useRef<SpeechSession | null>(null);

  const voiceOn = mode === 'voice' && running;
  const { gate, status, speaking } = useVoiceGate(voiceOn);

  // Landscape allowed while prompting (the rest of the app is portrait).
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  // Resume where you left off.
  useEffect(() => {
    const last = script?.lastWord ?? 0;
    if (last > 10 && last < parsed.words.length - 5) {
      Alert.alert(t('prompt.resume'), undefined, [
        { text: t('prompt.resumeNo'), style: 'cancel' },
        {
          text: t('prompt.resumeYes'),
          onPress: () => {
            fromTop.current = false;
            setTimeout(() => ref.current?.jumpToWord(last, false), 50);
          },
        },
      ]);
    }
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer.
  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const iv = setInterval(() => setElapsed(accumulated.current + (Date.now() - (startedAt.current ?? Date.now())) / 1000), 250);
    return () => {
      clearInterval(iv);
      if (startedAt.current) accumulated.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    };
  }, [running]);

  // Chrome auto-hide while running.
  useEffect(() => {
    if (!running || !chrome) return;
    const id2 = setTimeout(() => setChrome(false), 2500);
    return () => clearTimeout(id2);
  }, [running, chrome]);

  // Countdown.
  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      setCount(null);
      thud(prefs.haptics);
      setRunning(true);
      return;
    }
    tap(prefs.haptics);
    const id2 = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id2);
  }, [count, prefs.haptics]);

  // Voice Follow (dev/store build only).
  useEffect(() => {
    if (mode !== 'follow' || !running) {
      speech.current?.stop();
      speech.current = null;
      setFollowWord(null);
      return;
    }
    const engine = loadSpeech();
    if (!engine) return;
    const f = new Follower(parsed.words);
    f.jumpTo(ref.current?.currentWord() ?? 0);
    let alive = true;
    engine
      .start(getLocale(), (text) => alive && setFollowWord(f.hear(text)), (msg) => Alert.alert(msg))
      .then((s) => {
        if (alive) speech.current = s;
        else s.stop();
      })
      .catch(() => setMode('steady'));
    return () => {
      alive = false;
      speech.current?.stop();
      speech.current = null;
    };
  }, [mode, running, parsed.words]);

  const saveProgress = useCallback(() => {
    if (!script) return;
    const w = ref.current?.currentWord() ?? 0;
    app.saveScript({ ...script, lastWord: w >= parsed.words.length - 5 ? 0 : w });
  }, [script, app, parsed.words.length]);

  const start = () => {
    if (mode === 'voice' && !voiceCounted.current) {
      if (!app.consumeVoiceRead()) {
        Alert.alert(t('plus.voiceTrialDone'), undefined, [
          { text: t('prompt.mode.steady'), onPress: () => setMode('steady') },
          { text: t('plus.buyNoPrice'), onPress: () => router.push('/plus') },
        ]);
        return;
      }
      voiceCounted.current = true;
    }
    setDone(null);
    if (prefs.countdown > 0 && elapsed === 0) setCount(prefs.countdown);
    else setRunning(true);
  };

  const toggle = () => {
    setChrome(true);
    if (count !== null) {
      setCount(null);
      return;
    }
    if (running) {
      setRunning(false);
      saveProgress();
    } else start();
  };

  const onEnd = useCallback(() => {
    setRunning(false);
    const secs = accumulated.current + (startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0);
    setDone(secs);
    setChrome(true);
    success(prefs.haptics);
    if (script) app.saveScript({ ...(fromTop.current && secs > 5 ? recordTake(script, secs) : script), lastWord: 0 });
  }, [prefs.haptics, script, app]);

  const restart = () => {
    setRunning(false);
    setDone(null);
    accumulated.current = 0;
    setElapsed(0);
    fromTop.current = true;
    ref.current?.restart();
  };

  const close = () => {
    if (done === null) saveProgress();
    router.back();
  };

  const chooseMode = () => {
    const follow = !!loadSpeech();
    Alert.alert(t('prompt.modeTitle'), undefined, [
      { text: t('prompt.mode.steady'), onPress: () => setMode('steady') },
      {
        text: `${t('prompt.mode.voice')}${app.tier === 'plus' ? '' : ` (${t('plus.voiceTrial', { n: app.voiceReadsLeft })})`}`,
        onPress: () => setMode('voice'),
      },
      {
        text: t('prompt.mode.follow'),
        onPress: () => (follow ? (app.can('voice') ? setMode('follow') : router.push('/plus')) : Alert.alert(t('voice.followNeedsBuild'))),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const sections = () => {
    if (!parsed.sections.length) return;
    Alert.alert(t('prompt.sections'), undefined, [
      ...parsed.sections.map((s) => ({ text: s.title, onPress: () => ref.current?.jumpToWord(s.firstWord) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  if (!script) return null;
  const listening = mode === 'voice' && running && status === 'listening';

  return (
    <View style={[st.fill, { backgroundColor: palette.bg }]}>
      <StatusBar hidden />
      <Prompter
        ref={ref}
        parsed={parsed}
        prefs={prefs}
        palette={palette}
        wpm={script.wpm}
        speed={speed}
        running={running}
        gate={gate}
        followWord={mode === 'follow' ? followWord : null}
        reduceMotion={app.reduceMotion}
        onTap={toggle}
        onScrubStart={() => setChrome(true)}
        onFontSize={(fontSize) => app.setPrefs({ fontSize })}
        onEnd={onEnd}
      />

      {count !== null ? (
        <View pointerEvents="none" style={st.center}>
          <Text style={[st.count, { color: palette.ink }]} accessibilityLiveRegion="assertive">
            {count}
          </Text>
        </View>
      ) : null}

      {!running && count === null ? (
        <View pointerEvents="none" style={[st.center, { top: undefined, bottom: insets.bottom + 120 }]}>
          <Text style={[st.hint, { color: palette.dim }]}>
            {done !== null ? t('prompt.finished', { time: formatDuration(done) }) : elapsed > 0 ? t('prompt.paused') : t('prompt.tapToStart')}
          </Text>
        </View>
      ) : null}

      {chrome ? (
        <Animated.View entering={app.reduceMotion ? undefined : FadeIn.duration(180)} exiting={app.reduceMotion ? undefined : FadeOut.duration(250)} style={[st.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <IconBtn icon="close" label={t('prompt.close')} onPress={close} color={palette.ink} bg="rgba(0,0,0,0.35)" />
          <View style={{ flex: 1 }} />
          {prefs.showTimer ? <Text style={[st.timer, { color: palette.ink }]}>{formatDuration(elapsed)}</Text> : null}
          <Pressable onPress={chooseMode} accessibilityRole="button" accessibilityLabel={t(`prompt.mode.${mode}`)} style={st.modeChip}>
            <Ionicons name={mode === 'steady' ? 'speedometer-outline' : 'mic-outline'} size={16} color="#fff" />
            <Text style={st.modeText}>{t(`prompt.mode.${mode}`)}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {listening ? (
        <View pointerEvents="none" style={[st.listen, { top: insets.top + 60 }]}>
          <View style={[st.dot, { backgroundColor: speaking ? '#3DDC84' : '#888' }]} />
          <Text style={st.listenText}>{speaking ? t('prompt.listening') : t('prompt.waiting')}</Text>
        </View>
      ) : null}

      {chrome ? (
        <Animated.View entering={app.reduceMotion ? undefined : FadeIn.duration(180)} exiting={app.reduceMotion ? undefined : FadeOut.duration(250)} style={[st.bottom, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none">
          <View style={st.pill}>
            <IconBtn icon="play-skip-back" label={t('prompt.restart')} onPress={restart} color="#fff" />
            <IconBtn icon="list" label={t('prompt.sections')} onPress={sections} color="#fff" />
            <IconBtn icon="remove" label="Slower" onPress={() => setSpeed((s) => nudgeSpeed(s, -1))} color="#fff" />
            <Text style={st.speed} accessibilityLabel={t('prompt.speed', { pct: Math.round(speed * 100) })}>
              {Math.round(speed * 100)}%
            </Text>
            <IconBtn icon="add" label="Faster" onPress={() => setSpeed((s) => nudgeSpeed(s, 1))} color="#fff" />
            <IconBtn icon="swap-horizontal" label={t('prompt.mirror')} active={prefs.mirrorH} onPress={() => app.setPrefs({ mirrorH: !prefs.mirrorH })} color="#fff" />
            <IconBtn icon="swap-vertical" label={t('prompt.flip')} active={prefs.mirrorV} onPress={() => app.setPrefs({ mirrorV: !prefs.mirrorV })} color="#fff" />
            <IconBtn icon={running ? 'pause' : 'play'} label={running ? 'Pause' : 'Play'} onPress={toggle} color="#fff" active />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 140, fontWeight: '900', opacity: 0.9 },
  hint: { fontSize: 16, fontWeight: '600' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  timer: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'], opacity: 0.8 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 18, paddingHorizontal: 12, minHeight: 36 },
  modeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  listen: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  listenText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,20,22,0.8)', borderRadius: 28, paddingHorizontal: 6, paddingVertical: 4, flexWrap: 'wrap', justifyContent: 'center', marginHorizontal: 8 },
  speed: { color: '#fff', fontWeight: '700', minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
