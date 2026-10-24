// One round of Backspin, in four steps on one screen: 1 say it, 2 hear it backwards, 3 copy it, 4 the flip.
// Used by quick play, packs, freestyle, the daily, challenge-a-friend and party "copy" turns.
// All sound work is pure JS (src/core): read the WAV, trim, normalise, reverse, score. iOS only in Expo Go.
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { applyEffect, buildShareClip, cleanTake, EFFECTS, FREE_EFFECTS, isSilent, reverse, waveformPeaks, type Effect } from '../core/dsp.ts';
import { maxTakeSeconds, verdict } from '../core/game.ts';
import { scoreTakes, starsFor, type ScoreBreakdown } from '../core/score.ts';
import type { Pcm } from '../core/wav.ts';
import { QUIPS } from '../content/index.ts';
import type { Key } from '../i18n/en.ts';
import { canReverseHere, play, stop } from '../native/audio.ts';
import { haptic, openSettings, shareFile } from '../native/device.ts';
import { readPcm, writeScratch, writeShareFile } from '../native/files.ts';
import { useApp } from '../state/app.tsx';
import { Button, Card, Chip, Disc, Press, T, Toastish, Wave } from './kit.tsx';
import { R, SP, TYPE } from './theme.ts';
import { useRecorder } from './useRecorder.ts';

export type RoundResult = { score: ScoreBreakdown; originalUri: string; copyUri: string };
type Step = 'say' | 'listen' | 'copy' | 'reveal';
type Take = { pcm: Pcm; uri: string; peaks: number[] };

export function RoundEngine(props: {
  line: string | null;
  note?: string;
  heading: string;
  friend?: boolean;
  onScored?: (r: RoundResult) => void;
  onSave?: (r: RoundResult) => void;
  saveDisabled?: boolean;
  savedNote?: string | null;
  onNext?: () => void;
  nextLabel?: string;
  extraReveal?: ReactNode;
  shareLabel?: string;
  onShareResult?: (score: number) => void;
}) {
  useKeepAwake();
  const { t, theme, prefs, plus, calm } = useApp();
  const [step, setStep] = useState<Step>('say');
  const [orig, setOrig] = useState<Take | null>(null);
  const [rev, setRev] = useState<Take | null>(null);
  const [copy, setCopy] = useState<Take | null>(null);
  const [flip, setFlip] = useState<Take | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [loop, setLoop] = useState(false);
  const [fx, setFx] = useState<Effect>('none');
  const [fxUri, setFxUri] = useState<string | null>(null);
  const loopRef = useRef(false);
  loopRef.current = loop;
  const rec = useRecorder(maxTakeSeconds(plus), prefs.countdown && !prefs.holdToRecord);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      stop();
    },
    [],
  );

  const say = (k: Key, v?: Record<string, string | number>) => setMsg(t(k, v));

  const playUri = async (id: string, uri: string, rate = 1) => {
    if (playing === id) {
      stop();
      setPlaying(null);
      return;
    }
    setPlaying(id);
    let r = await play(uri, rate);
    while (r.ok && alive.current && id === 'rev' && loopRef.current) r = await play(uri, rate);
    if (!alive.current) return;
    setPlaying((p) => (p === id ? null : p));
    if (!r.ok) say('round.playError', { detail: r.detail });
  };

  const takeFrom = async (uri: string, name: string): Promise<Take | null> => {
    let pcm: Pcm;
    try {
      pcm = await readPcm(uri);
    } catch (e) {
      say('round.notPlayable', { detail: e instanceof Error ? e.message : String(e) });
      return null;
    }
    const clean = cleanTake(pcm);
    if (isSilent(clean)) {
      say('round.tooQuiet');
      haptic.warn();
      return null;
    }
    if (clean.samples.length < clean.sampleRate * 0.25) {
      say('round.tooShort');
      return null;
    }
    const out = await writeScratch(clean, name);
    return { pcm: clean, uri: out, peaks: waveformPeaks(clean.samples, 48) };
  };

  const record = async (which: 'orig' | 'copy') => {
    setMsg(null);
    const r = await rec.start();
    if (!alive.current) return;
    if (r.denied) return say('mic.denied');
    if (r.error === 'permission-granted') return;
    if (r.error === 'short') return say('round.tooShort');
    if (!r.uri) return r.error ? say('round.recordError', { detail: r.error }) : undefined;
    setBusy(true);
    try {
      if (which === 'orig') {
        const o = await takeFrom(r.uri, 'original');
        if (!o) return;
        const back = reverse(o.pcm);
        const rv = { pcm: back, uri: await writeScratch(back, 'reversed'), peaks: [...o.peaks].reverse() };
        setOrig(o);
        setRev(rv);
        setCopy(null);
        setFlip(null);
        setScore(null);
        setStep('listen');
        if (prefs.autoplay && !props.friend) playUri('rev', rv.uri);
      } else {
        const c = await takeFrom(r.uri, 'copy');
        if (!c || !orig) return;
        const f = reverse(c.pcm);
        const fl = { pcm: f, uri: await writeScratch(f, 'flipped'), peaks: [...c.peaks].reverse() };
        const s = scoreTakes(orig.pcm, f);
        setCopy(c);
        setFlip(fl);
        setScore(s);
        setFx('none');
        setFxUri(null);
        setStep('reveal');
        haptic.success();
        props.onScored?.({ score: s, originalUri: orig.uri, copyUri: c.uri });
        playUri('flip', fl.uri);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const chooseFx = async (e: Effect) => {
    if (!flip) return;
    setFx(e);
    if (e === 'none') {
      setFxUri(null);
      return playUri('flip', flip.uri);
    }
    const uri = await writeScratch(applyEffect(flip.pcm, e), `fx-${e}`);
    setFxUri(uri);
    playUri('fx', uri);
  };

  const playAll = async () => {
    if (!orig || !rev || !copy || !flip) return;
    const parts = [orig, rev, copy, flip];
    const ids = ['orig', 'rev', 'copy', 'flip'];
    for (let i = 0; i < parts.length && alive.current; i++) {
      setPlaying(ids[i]);
      const r = await play(parts[i].uri);
      if (!r.ok) break;
    }
    if (alive.current) setPlaying(null);
  };

  const share = async () => {
    if (!orig || !rev || !copy || !flip) return;
    setBusy(true);
    try {
      const last = fx === 'none' ? flip.pcm : applyEffect(flip.pcm, fx);
      const clip = buildShareClip([orig.pcm, rev.pcm, copy.pcm, last]);
      const uri = await writeShareFile(clip, `Backspin ${score?.score ?? ''}`);
      const r = await shareFile(uri, 'Backspin');
      if (!r.ok) say(r.reason === 'unavailable' ? 'share.unavailable' : 'share.error', { detail: r.detail ?? '' });
    } finally {
      setBusy(false);
    }
  };

  if (!canReverseHere) {
    return (
      <Card>
        <T kind="h">Android</T>
        <T color={theme.sub} style={{ marginTop: SP(2) }}>
          {t('round.notPlayable', { detail: Platform.OS })}
        </T>
      </Card>
    );
  }

  const recording = rec.phase === 'recording' || rec.phase === 'countdown' || rec.phase === 'preparing';
  const stepLabel = (s: Step) => t(s === 'say' ? 'round.step1' : s === 'listen' ? 'round.step2' : s === 'copy' ? 'round.step3' : 'round.step4');
  const order: Step[] = ['say', 'listen', 'copy', 'reveal'];

  return (
    <View>
      <T kind="small" color={theme.sub}>
        {props.heading}
      </T>
      {/* Step dots */}
      <View style={{ flexDirection: 'row', gap: SP(1.5), marginTop: SP(3) }} accessible accessibilityLabel={stepLabel(step)}>
        {order.map((s) => (
          <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: order.indexOf(s) <= order.indexOf(step) ? (step === 'reveal' ? theme.gold : theme.rec) : theme.line }} />
        ))}
      </View>
      <T kind="h" style={{ marginTop: SP(3) }}>
        {stepLabel(step)}
      </T>

      {/* The line */}
      {step !== 'reveal' && (
        <Card style={{ marginTop: SP(3) }}>
          <T kind="small" color={theme.sub}>
            {props.line ? (props.friend && step === 'say' ? t('round.friendSay') : t('round.say')) : t('round.sayFree')}
          </T>
          {props.line ? (
            <T kind="line" style={{ marginTop: SP(2) }}>
              {props.line}
            </T>
          ) : null}
          {props.note ? (
            <T kind="small" color={theme.faint} style={{ marginTop: SP(1) }}>
              {props.note}
            </T>
          ) : null}
        </Card>
      )}

      {step === 'say' && (
        <RecordArea
          phase={rec.phase}
          count={rec.count}
          seconds={rec.seconds}
          levels={rec.levels}
          busy={busy}
          hold={prefs.holdToRecord}
          onStart={() => record('orig')}
          onStop={rec.finish}
        />
      )}

      {step === 'listen' && rev && (
        <View style={{ marginTop: SP(5) }}>
          <Disc size={150} spin={playing === 'rev' ? -1 : 0} label={t('round.playReversed')} />
          <Wave peaks={rev.peaks} color={theme.rew} dim={theme.line} />
          <T kind="small" color={theme.sub} center style={{ marginTop: SP(2) }}>
            {props.friend ? t('round.passBack') : t('round.listen')}
          </T>
          <View style={{ flexDirection: 'row', gap: SP(2), marginTop: SP(4), justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button kind="rewind" icon={playing === 'rev' ? '⏸' : '▶︎'} title={playing === 'rev' ? t('round.pause') : t('round.play')} onPress={() => playUri('rev', rev.uri, slow ? 0.75 : 1)} />
            <Chip label={t('round.slow')} on={slow} onPress={() => setSlow((s) => !s)} />
            <Chip label={t('round.loop')} on={loop} onPress={() => setLoop((s) => !s)} />
          </View>
          <Button title={t('round.copyNow')} icon="🎙" style={{ marginTop: SP(5) }} onPress={() => (stop(), setPlaying(null), setStep('copy'))} />
          <Button kind="ghost" small title={t('round.redoOriginal')} style={{ marginTop: SP(3), alignSelf: 'center' }} onPress={() => (stop(), setStep('say'))} />
        </View>
      )}

      {step === 'copy' && rev && (
        <View style={{ marginTop: SP(4) }}>
          <Press label={t('round.playReversed')} onPress={() => playUri('rev', rev.uri, slow ? 0.75 : 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(3), backgroundColor: theme.card, borderRadius: R.l, padding: SP(3) }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.rew, alignItems: 'center', justifyContent: 'center' }}>
              <T color={theme.rewInk}>{playing === 'rev' ? '⏸' : '▶︎'}</T>
            </View>
            <View style={{ flex: 1 }}>
              <Wave peaks={rev.peaks} color={theme.rew} dim={theme.line} height={36} />
            </View>
          </Press>
          <T kind="small" color={theme.sub} center style={{ marginTop: SP(3) }}>
            {t('round.copyHint')}
          </T>
          <RecordArea
            phase={rec.phase}
            count={rec.count}
            seconds={rec.seconds}
            levels={rec.levels}
            busy={busy}
            hold={prefs.holdToRecord}
            onStart={() => record('copy')}
            onStop={rec.finish}
          />
        </View>
      )}

      {step === 'reveal' && score && orig && rev && copy && flip && (
        <View style={{ marginTop: SP(3) }}>
          <ScoreCard score={score} calm={calm} quip={verdict(QUIPS, score.score, orig.pcm.samples.length)} line={props.line} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP(2), marginTop: SP(4) }}>
            {(
              [
                ['orig', 'round.playOriginal', orig, theme.rec],
                ['rev', 'round.playReversed', rev, theme.rew],
                ['copy', 'round.playCopy', copy, theme.rec],
                ['flip', 'round.playFlipped', flip, theme.gold],
              ] as const
            ).map(([id, k, take, col]) => (
              <Press key={id} label={t(k)} onPress={() => playUri(id, take.uri)} style={{ width: '48%', flexGrow: 1, backgroundColor: playing === id ? theme.cardHi : theme.card, borderRadius: R.m, padding: SP(3), borderWidth: 1.5, borderColor: playing === id ? col : theme.line }}>
                <T kind="small" style={{ fontWeight: '700' }}>
                  {playing === id ? '⏸ ' : '▶︎ '}
                  {t(k)}
                </T>
                <View style={{ marginTop: SP(2) }}>
                  <Wave peaks={take.peaks.filter((_, i) => i % 2 === 0)} color={col} dim={theme.line} height={24} />
                </View>
              </Press>
            ))}
          </View>
          <Button kind="quiet" small icon="🔁" title={t('round.playAll')} style={{ marginTop: SP(3) }} onPress={playAll} />

          <T kind="small" color={theme.sub} style={{ marginTop: SP(5), marginBottom: SP(2) }}>
            {t('round.effect')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP(2) }}>
            {EFFECTS.map((e) => {
              const locked = !plus && !FREE_EFFECTS.includes(e);
              return <Chip key={e} label={t(`fx.${e}` as Key)} on={fx === e} locked={locked} onPress={() => (locked ? say('round.locked') : chooseFx(e))} />;
            })}
          </View>

          {props.extraReveal}

          <View style={{ gap: SP(3), marginTop: SP(6) }}>
            {props.onNext ? <Button title={props.nextLabel ?? t('round.next')} icon="➜" onPress={() => (stop(), props.onNext?.())} /> : null}
            <View style={{ flexDirection: 'row', gap: SP(3) }}>
              <Button kind="rewind" icon="⤴︎" title={t('round.share')} style={{ flex: 1 }} busy={busy} onPress={share} />
              {props.onSave ? (
                <Button kind="quiet" icon="💾" title={t('round.save')} style={{ flex: 1 }} disabled={props.saveDisabled} onPress={() => props.onSave?.({ score, originalUri: orig.uri, copyUri: copy.uri })} />
              ) : null}
            </View>
            {props.onShareResult ? <Button kind="quiet" small icon="🟩" title={props.shareLabel ?? t('round.shareDaily')} onPress={() => props.onShareResult?.(score.score)} /> : null}
            <Button kind="ghost" small title={t('round.redoCopy')} onPress={() => (stop(), setStep('copy'))} />
          </View>
          <Toastish text={props.savedNote ?? null} />
        </View>
      )}

      <Toastish text={msg} />
      {msg === t('mic.denied') ? <Button kind="ghost" small title={t('mic.openSettings')} style={{ marginTop: SP(2) }} onPress={openSettings} /> : null}
    </View>
  );
}

function RecordArea({ phase, count, seconds, levels, busy, hold, onStart, onStop }: {
  phase: string; count: number; seconds: number; levels: number[]; busy: boolean; hold: boolean; onStart: () => void; onStop: () => void;
}) {
  const { t, theme, calm } = useApp();
  const pulse = useRef(new Animated.Value(0)).current;
  const live = phase === 'recording';
  useEffect(() => {
    if (!live || calm) return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [live, calm, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const label = busy ? t('round.processing') : phase === 'countdown' ? t('round.countdown') : live ? (hold ? t('round.recording', { s: seconds }) : t('round.stop')) : hold ? t('round.hold') : t('round.tap');
  const bars = levels.length ? [...new Array(Math.max(0, 48 - levels.length)).fill(0.05), ...levels] : new Array(48).fill(0.05);
  return (
    <View style={{ alignItems: 'center', marginTop: SP(6) }}>
      <View style={{ width: '100%', marginBottom: SP(5) }}>
        <Wave peaks={bars} color={theme.rec} dim={theme.line} height={44} />
      </View>
      <Press
        label={label}
        hint={hold ? t('round.hold') : t('round.tap')}
        disabled={busy}
        onPressIn={hold ? () => phase === 'idle' && onStart() : undefined}
        onPressOut={hold ? onStop : undefined}
        onPress={hold ? undefined : () => (phase === 'idle' ? onStart() : onStop())}
      >
        <Animated.View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: theme.rec, alignItems: 'center', justifyContent: 'center', transform: [{ scale }], shadowColor: theme.glow, shadowOpacity: live ? 0.7 : 0.45, shadowRadius: live ? 28 : 14, shadowOffset: { width: 0, height: 6 } }}>
          <LinearGradient colors={(theme.recGradient?.length >= 2 ? theme.recGradient : [theme.rec, theme.rec]) as [string, string]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 66 }} />
          {phase === 'countdown' ? (
            <T style={[TYPE.num, { fontSize: 56 }]} color={theme.recInk}>{count}</T>
          ) : (
            <View style={{ width: live ? 40 : 50, height: live ? 40 : 50, borderRadius: live ? 8 : 25, backgroundColor: theme.recInk }} />
          )}
        </Animated.View>
      </Press>
      <T kind="bodyB" style={{ marginTop: SP(4) }} center>
        {label}
      </T>
    </View>
  );
}

function ScoreCard({ score, quip, calm, line }: { score: ScoreBreakdown; quip: string; calm: boolean; line: string | null }) {
  const { t, theme } = useApp();
  const v = useRef(new Animated.Value(calm ? score.score : 0)).current;
  const [shown, setShown] = useState(calm ? score.score : 0);
  useEffect(() => {
    if (calm) return setShown(score.score);
    const id = v.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(v, { toValue: score.score, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [score.score, calm, v]);
  const stars = starsFor(score.score);
  return (
    <Card hi style={{ alignItems: 'center', paddingVertical: SP(6) }}>
      <T kind="small" color={theme.sub}>
        {t('round.score')}
      </T>
      <T kind="num" color={theme.score} center>
        {shown}
      </T>
      <View accessible accessibilityLabel={`${stars} / 5`} style={{ flexDirection: 'row' }}>
        <T kind="h" color={theme.gold}>{'★'.repeat(stars)}</T>
        <T kind="h" color={theme.line}>{'★'.repeat(5 - stars)}</T>
      </View>
      <T kind="bodyB" center style={{ marginTop: SP(3) }}>
        {quip}
      </T>
      {line ? (
        <T kind="small" color={theme.faint} center style={{ marginTop: SP(2) }} lines={2}>
          “{line}”
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', gap: SP(4), marginTop: SP(4) }}>
        {(
          [
            ['round.sound', score.sound],
            ['round.rhythm', score.rhythm],
            ['round.length', score.length],
          ] as const
        ).map(([k, n]) => (
          <View key={k} style={{ alignItems: 'center' }}>
            <T kind="bodyB">{n}</T>
            <T kind="small" color={theme.sub}>{t(k)}</T>
          </View>
        ))}
      </View>
    </Card>
  );
}
