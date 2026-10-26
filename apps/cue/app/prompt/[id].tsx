/**
 * Full-screen prompter: countdown, steady / Voice Pace / Voice Follow, speed nudges, mirror & flip,
 * jump to section, resume where you left off, rehearsal timer, landscape, screen kept awake.
 * Controls fade away while reading and come back on tap.
 */
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
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
import { t } from '../../src/i18n';
import { success, tap, thud } from '../../src/native/haptics';
import { loadSpeech, type SpeechSession } from '../../src/native/speech';
import { useApp } from '../../src/state/AppState';
import { Glass, IconBtn } from '../../src/ui/kit';
import { FONT, PROMPTER, RADIUS } from '../../src/theme/theme';
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

  // Voice Follow (TestFlight / store builds): on-device speech recognition moves the reading line word by word.
  // The prompter never auto-scrolls in this mode: followWord is set before anything is heard, so it waits for you.
  const follower = useRef<Follower | null>(null);
  const [followLive, setFollowLive] = useState(false);
  useEffect(() => {
    if (mode !== 'follow' || !running) {
      speech.current?.stop();
      speech.current = null;
      follower.current = null;
      setFollowLive(false);
      setFollowWord(null);
      return;
    }
    const engine = loadSpeech();
    if (!engine) return;
    const f = new Follower(parsed.words);
    f.jumpTo(ref.current?.currentWord() ?? 0);
    follower.current = f;
    setFollowWord(f.position);
    // Long, unusual words from the script help the recogniser hear names and jargon correctly.
    const hints = [...new Set(parsed.words.filter((w) => w.length > 6))].slice(0, 100);
    let alive = true;
    const controller = new AbortController();
    const fail = (msg: string) => {
      if (!alive) return;
      alive = false;
      controller.abort();
      setFollowLive(false);
      setRunning(false);
      setMode('voice');
      setChrome(true);
      Alert.alert(t('voice.followStopped'), msg);
    };
    engine
      .start(
        prefs.locale,
        (text) => {
          if (!alive || !follower.current) return;
          setFollowWord(follower.current.hear(text));
        },
        fail,
        hints,
        () => { if (alive) setFollowLive(true); },
        controller.signal,
      )
      .then((sess) => {
        if (alive) {
          speech.current = sess;
        } else sess.stop();
      })
      .catch((e: unknown) => {
        fail(e instanceof Error ? e.message : t('error.unknown'));
      });
    return () => {
      alive = false;
      controller.abort();
      speech.current?.stop();
      speech.current = null;
      setFollowLive(false);
    };
  }, [mode, running, parsed.words, prefs.locale]);

  // In Voice Follow the script ends when the last words are heard.
  useEffect(() => {
    if (mode === 'follow' && running && followWord !== null && followWord >= parsed.words.length) {
      const id2 = setTimeout(() => onEndRef.current(), 600);
      return () => clearTimeout(id2);
    }
  }, [mode, running, followWord, parsed.words.length]);

  const saveProgress = useCallback(() => {
    if (!script) return;
    const w = ref.current?.currentWord() ?? 0;
    app.saveScript({ ...script, lastWord: w >= parsed.words.length - 5 ? 0 : w });
  }, [script, app, parsed.words.length]);

  const start = () => {
    // Shown only when someone picks a voice mode after the 7-day trial: a choice, not a popup.
    if ((mode === 'voice' || mode === 'follow') && !app.can('voice')) {
      Alert.alert(t('plus.trial.voiceLocked'), undefined, [
        { text: t('prompt.mode.steady'), onPress: () => setMode('steady') },
        { text: t('plus.buyNoPrice'), onPress: () => router.push('/plus') },
      ]);
      return;
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
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

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
        text: t('prompt.mode.voice'),
        onPress: () => setMode('voice'),
      },
      {
        text: t('prompt.mode.follow'),
        onPress: () => (follow ? setMode('follow') : Alert.alert(t('voice.followNeedsBuild'))),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const sections = () => {
    if (!parsed.sections.length) return;
    Alert.alert(t('prompt.sections'), undefined, [
      ...parsed.sections.map((s) => ({
        text: s.title,
        onPress: () => {
          ref.current?.jumpToWord(s.firstWord);
          if (follower.current) {
            follower.current.jumpTo(s.firstWord);
            setFollowWord(s.firstWord);
          }
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  if (!script) return null;
  const listening = running && ((mode === 'voice' && status === 'listening') || (mode === 'follow' && followLive));
  const hearing = mode === 'follow' ? true : speaking;

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
          <Text style={[st.count, { color: palette.cue }]} accessibilityLiveRegion="assertive">
            {count}
          </Text>
        </View>
      ) : null}

      {!running && count === null ? (
        <View pointerEvents="none" style={[st.center, { top: undefined, bottom: insets.bottom + 168 }]}>
          <Glass tint="dark" style={st.hintChip}>
            <Text style={st.hint}>
              {done !== null ? t('prompt.finished', { time: formatDuration(done) }) : elapsed > 0 ? t('prompt.paused') : t('prompt.tapToStart')}
            </Text>
          </Glass>
        </View>
      ) : null}

      {chrome ? (
        <Animated.View entering={app.reduceMotion ? undefined : FadeIn.duration(200)} exiting={app.reduceMotion ? undefined : FadeOut.duration(260)} style={[st.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Glass tint="dark" style={st.round}>
            <IconBtn icon="close" label={t('prompt.close')} onPress={close} color="#F1EEE6" />
          </Glass>
          <View style={{ flex: 1 }} />
          {prefs.showTimer ? (
            <Glass tint="dark" style={st.chip}>
              <Text style={st.timer}>{formatDuration(elapsed)}</Text>
            </Glass>
          ) : null}
          <Pressable onPress={chooseMode} accessibilityRole="button" accessibilityLabel={t(`prompt.mode.${mode}`)}>
            <Glass tint="dark" style={[st.chip, { flexDirection: 'row', gap: 6 }]}>
              <Ionicons name={mode === 'steady' ? 'speedometer-outline' : 'mic-outline'} size={15} color={BRASS} />
              <Text style={st.chipText}>{t(`prompt.mode.${mode}`)}</Text>
            </Glass>
          </Pressable>
        </Animated.View>
      ) : null}

      {listening ? (
        <View pointerEvents="none" style={[st.listen, { top: insets.top + 64 }]}>
          <Glass tint="dark" style={[st.chip, { flexDirection: 'row', gap: 7 }]}>
            <View style={[st.dot, { backgroundColor: hearing ? BRASS : '#6E7486' }]} />
            <Text style={st.chipText}>{hearing ? t('prompt.listening') : t('prompt.waiting')}</Text>
          </Glass>
        </View>
      ) : null}

      {chrome ? (
        <Animated.View entering={app.reduceMotion ? undefined : FadeIn.duration(200)} exiting={app.reduceMotion ? undefined : FadeOut.duration(260)} style={[st.bottom, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <Glass tint="dark" style={st.dock}>
            <View style={st.dockRow}>
              <IconBtn icon="play-skip-back-outline" label={t('prompt.restart')} onPress={restart} color="#C9CCD6" />
              <IconBtn icon="list-outline" label={t('prompt.sections')} onPress={sections} color="#C9CCD6" />
              <View style={{ flex: 1 }} />
              <IconBtn icon="swap-horizontal" label={t('prompt.mirror')} active={prefs.mirrorH} onPress={() => app.setPrefs({ mirrorH: !prefs.mirrorH })} color="#C9CCD6" />
              <IconBtn icon="swap-vertical" label={t('prompt.flip')} active={prefs.mirrorV} onPress={() => app.setPrefs({ mirrorV: !prefs.mirrorV })} color="#C9CCD6" />
            </View>
            <View style={st.dockMain}>
              <IconBtn icon="remove" label="Slower" onPress={() => setSpeed((s) => nudgeSpeed(s, -1))} color="#F1EEE6" />
              <Text style={st.speed} accessibilityLabel={t('prompt.speed', { pct: Math.round(speed * 100) })}>
                {Math.round(speed * 100)}%
              </Text>
              <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={running ? 'Pause' : 'Play'} style={({ pressed }) => [st.play, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
                <LinearGradient colors={['#DDB063', '#C9973F', '#B4832F']} style={StyleSheet.absoluteFill} />
                <Ionicons name={running ? 'pause' : 'play'} size={28} color="#1A1408" style={running ? undefined : { marginLeft: 3 }} />
              </Pressable>
              <IconBtn icon="add" label="Faster" onPress={() => setSpeed((s) => nudgeSpeed(s, 1))} color="#F1EEE6" />
              <View style={{ width: 44 }} />
            </View>
          </Glass>
        </Animated.View>
      ) : null}
    </View>
  );
}

const BRASS = '#D9AD5E';

const st = StyleSheet.create({
  fill: { flex: 1 },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: FONT.display, fontSize: 168, lineHeight: 180, fontVariant: ['tabular-nums'] },
  hintChip: { borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 9 },
  hint: { fontFamily: FONT.bodyBold, fontSize: 15, color: '#F1EEE6' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  round: { borderRadius: 22 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONT.bodyBold, fontSize: 13.5, color: '#F1EEE6' },
  timer: { fontFamily: FONT.display, fontSize: 16, color: '#F1EEE6', fontVariant: ['tabular-nums'] },
  listen: { position: 'absolute', right: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 12 },
  dock: { borderRadius: 30, paddingHorizontal: 10, paddingVertical: 8, width: '100%', maxWidth: 460 },
  dockRow: { flexDirection: 'row', alignItems: 'center' },
  dockMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 2, paddingBottom: 4 },
  play: { width: 68, height: 68, borderRadius: 34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  speed: { fontFamily: FONT.display, fontSize: 17, color: '#F1EEE6', minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
