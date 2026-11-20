// One round of Backspin, in four steps on one screen: 1 say it, 2 hear it backwards, 3 copy it, 4 the flip.
// Used by quick play, packs, freestyle, the daily, challenge-a-friend and party "copy" turns.
// All sound work is pure JS (src/core): read the WAV, trim, normalise, reverse, score. iOS only in Expo Go.
import { useKeepAwake } from 'expo-keep-awake';
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
import { Button, Card, Chip, Disc, Icon, Press, T, Toastish, Wave } from './kit.tsx';
import { MOTION, R, SP } from './theme.ts';
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

  const stepLabel = (s: Step) => t(s === 'say' ? 'round.step1' : s === 'listen' ? 'round.step2' : s === 'copy' ? 'round.step3' : 'round.step4');
  const order: Step[] = ['say', 'listen', 'copy', 'reveal'];
  const at = order.indexOf(step);

  return (
    <View>
      {/* Where you are in the round: four rules, done ones in ink, the current one in the step's own ink. */}
      <View style={{ flexDirection: 'row', gap: SP(1.5) }} accessible accessibilityLabel={stepLabel(step)}>
        {order.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < at ? theme.ink : i === at ? (step === 'listen' ? theme.rew : theme.rec) : theme.line }} />
        ))}
      </View>
      <T kind="h" style={{ marginTop: SP(4) }}>
        {stepLabel(step)}
      </T>

      {/* The line, printed big. No box around it: it is the page. */}
      {step !== 'reveal' && (
        <View style={{ marginTop: SP(5) }}>
          <T color={theme.sub}>
            {props.line ? (props.friend && step === 'say' ? t('round.friendSay') : t('round.say')) : t('round.sayFree')}
          </T>
          {props.line ? (
            <T kind="line" style={{ marginTop: SP(2) }}>
              {props.line}
            </T>
          ) : null}
          {props.note ? (
            <T kind="small" color={theme.sub} style={{ marginTop: SP(2) }}>
              {props.note}
            </T>
          ) : null}
        </View>
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
        <View style={{ marginTop: SP(8) }}>
          <Disc size={156} spin={playing === 'rev' ? -1 : 0} label={t('round.playReversed')} />
          <View style={{ marginTop: SP(6) }}>
            <Wave peaks={rev.peaks} color={theme.rew} dim={theme.line} height={48} />
          </View>
          <T kind="small" color={theme.sub} center style={{ marginTop: SP(3) }}>
            {props.friend ? t('round.passBack') : t('round.listen')}
          </T>
          <View style={{ flexDirection: 'row', gap: SP(2), marginTop: SP(5), justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button kind="rewind" icon={playing === 'rev' ? 'pause' : 'play'} title={playing === 'rev' ? t('round.pause') : t('round.play')} onPress={() => playUri('rev', rev.uri, slow ? 0.75 : 1)} />
            <Chip label={t('round.slow')} on={slow} onPress={() => setSlow((s) => !s)} />
            <Chip label={t('round.loop')} icon="loop" on={loop} onPress={() => setLoop((s) => !s)} />
          </View>
          <Button title={t('round.copyNow')} icon="mic" style={{ marginTop: SP(8) }} onPress={() => (stop(), setPlaying(null), setStep('copy'))} />
          <Button kind="ghost" small title={t('round.redoOriginal')} style={{ marginTop: SP(3), alignSelf: 'center' }} onPress={() => (stop(), setStep('say'))} />
        </View>
      )}

      {step === 'copy' && rev && (
        <View style={{ marginTop: SP(5) }}>
          <Press label={t('round.playReversed')} onPress={() => playUri('rev', rev.uri, slow ? 0.75 : 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(3), backgroundColor: theme.rewTint, borderRadius: R.pill, padding: SP(2), paddingRight: SP(5) }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.rew, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={playing === 'rev' ? 'pause' : 'play'} size={18} color={theme.rewInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Wave peaks={rev.peaks} color={theme.rew} dim={theme.line} height={32} />
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
        <View style={{ marginTop: SP(4) }}>
          <ScoreCard score={score} calm={calm} quip={verdict(QUIPS, score.score, orig.pcm.samples.length)} line={props.line} original={orig.peaks} flipped={flip.peaks} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP(2), marginTop: SP(6) }}>
            {(
              [
                ['orig', 'round.playOriginal', orig, theme.rec],
                ['rev', 'round.playReversed', rev, theme.rew],
                ['copy', 'round.playCopy', copy, theme.rec],
                ['flip', 'round.playFlipped', flip, theme.overprint],
              ] as const
            ).map(([id, k, take, col]) => (
              <Press key={id} label={t(k)} onPress={() => playUri(id, take.uri)} style={{ width: '48%', flexGrow: 1, backgroundColor: theme.card, borderRadius: R.m, padding: SP(3), borderWidth: 2, borderColor: playing === id ? col : theme.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP(1.5) }}>
                  <Icon name={playing === id ? 'pause' : 'play'} size={14} color={theme.ink} />
                  <T kind="small" style={{ fontWeight: '600' }}>
                    {t(k)}
                  </T>
                </View>
                <View style={{ marginTop: SP(2) }}>
                  <Wave peaks={take.peaks.filter((_, i) => i % 2 === 0)} color={col} dim={theme.line} height={24} />
                </View>
              </Press>
            ))}
          </View>
          <Button kind="quiet" small icon="play" title={t('round.playAll')} style={{ marginTop: SP(2) }} onPress={playAll} />

          <T kind="h" style={{ marginTop: SP(8), marginBottom: SP(3) }}>
            {t('round.effect')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP(2) }}>
            {EFFECTS.map((e) => {
              const locked = !plus && !FREE_EFFECTS.includes(e);
              return <Chip key={e} label={t(`fx.${e}` as Key)} on={fx === e} locked={locked} onPress={() => (locked ? say('round.locked') : chooseFx(e))} />;
            })}
          </View>

          {props.extraReveal}

          <View style={{ gap: SP(3), marginTop: SP(8) }}>
            {props.onNext ? <Button title={props.nextLabel ?? t('round.next')} icon="next" onPress={() => (stop(), props.onNext?.())} /> : null}
            <View style={{ flexDirection: 'row', gap: SP(3) }}>
              <Button kind="rewind" icon="share" title={t('round.share')} style={{ flex: 1 }} busy={busy} onPress={share} />
              {props.onSave ? (
                <Button kind="quiet" icon="save" title={t('round.save')} style={{ flex: 1 }} disabled={props.saveDisabled} onPress={() => props.onSave?.({ score, originalUri: orig.uri, copyUri: copy.uri })} />
              ) : null}
            </View>
            {props.onShareResult ? <Button kind="quiet" small icon="grid" title={props.shareLabel ?? t('round.shareDaily')} onPress={() => props.onShareResult?.(score.score)} /> : null}
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

/**
 * The record button: one flat disc of pink ink with the level meter printed above it. Idle shows a dot, recording
 * shows a stop square inside an ink ring. No glow and no pulse: the live level meter is the feedback.
 */
function RecordArea({ phase, count, seconds, levels, busy, hold, onStart, onStop }: {
  phase: string; count: number; seconds: number; levels: number[]; busy: boolean; hold: boolean; onStart: () => void; onStop: () => void;
}) {
  const { t, theme } = useApp();
  const live = phase === 'recording';
  const label = busy ? t('round.processing') : phase === 'countdown' ? t('round.countdown') : live ? (hold ? t('round.recording', { s: seconds }) : t('round.stop')) : hold ? t('round.hold') : t('round.tap');
  const bars = levels.length ? [...new Array(Math.max(0, 40 - levels.length)).fill(0.04), ...levels.slice(-40)] : new Array(40).fill(0.04);
  const size = 148;
  return (
    <View style={{ alignItems: 'center', marginTop: SP(10) }}>
      <View style={{ width: '100%', marginBottom: SP(8) }}>
        <Wave peaks={bars} color={theme.rec} dim={theme.line} height={44} gap={3} />
      </View>
      <Press
        label={label}
        hint={hold ? t('round.hold') : t('round.tap')}
        disabled={busy}
        onPressIn={hold ? () => phase === 'idle' && onStart() : undefined}
        onPressOut={hold ? onStop : undefined}
        onPress={hold ? undefined : () => (phase === 'idle' ? onStart() : onStop())}
        style={{ width: size + 16, height: size + 16, borderRadius: (size + 16) / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: live ? theme.ink : 'transparent' }}
      >
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.rec, alignItems: 'center', justifyContent: 'center' }}>
          {phase === 'countdown' ? (
            <T kind="num" style={{ fontSize: 64, lineHeight: 68 }} color={theme.recInk}>{count}</T>
          ) : live ? (
            <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: theme.recInk }} />
          ) : (
            <Icon name="mic" size={52} color={theme.recInk} stroke={2.4} />
          )}
        </View>
      </Press>
      <T kind="bodyB" style={{ marginTop: SP(5) }} center>
        {label}
      </T>
    </View>
  );
}

/**
 * The flip. The score is stamped, not counted up. Under it, the signature move: your original printed in blue and
 * your flipped copy printed over it in pink. Where they line up, the inks overprint to the match colour; the copy
 * slides into register once, and simply appears under calm motion.
 */
function ScoreCard({ score, quip, calm, line, original, flipped }: { score: ScoreBreakdown; quip: string; calm: boolean; line: string | null; original: number[]; flipped: number[] }) {
  const { t, theme } = useApp();
  const stamp = useRef(new Animated.Value(calm ? 1 : 0)).current;
  const reg = useRef(new Animated.Value(calm ? 0 : 1)).current;
  useEffect(() => {
    if (calm) return;
    Animated.parallel([
      Animated.timing(stamp, { toValue: 1, duration: MOTION.base, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(reg, { toValue: 0, duration: MOTION.reveal, delay: 120, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();
  }, [calm, stamp, reg]);
  const stars = starsFor(score.score);
  const H = 72;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SP(3) }}>
        <Animated.View style={{ opacity: stamp, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }] }}>
          <T kind="num" color={theme.score} style={{ marginBottom: -SP(3) }}>{score.score}</T>
        </Animated.View>
        <View style={{ flex: 1, paddingBottom: SP(1) }}>
          <T kind="small" color={theme.sub}>{t('round.score')}</T>
          <View accessible accessibilityLabel={`${stars} / 5`} style={{ flexDirection: 'row', gap: 2, marginTop: SP(1) }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < stars ? theme.rec : 'transparent', borderWidth: 1.5, borderColor: i < stars ? theme.rec : theme.line }} />
            ))}
          </View>
        </View>
      </View>
      <T kind="title" style={{ marginTop: SP(4) }}>
        {quip}
      </T>
      {line ? (
        <T color={theme.sub} style={{ marginTop: SP(2) }} lines={2}>
          “{line}”
        </T>
      ) : null}

      {/* Overprint: original (blue) under the flipped copy (pink). */}
      <View style={{ height: H, marginTop: SP(6) }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
          <Wave peaks={original} color={theme.rew} dim={theme.rew} height={H} />
        </View>
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, mixBlendMode: theme.blend, transform: [{ translateX: reg.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }] }}>
          <Wave peaks={flipped} color={theme.rec} dim={theme.rec} height={H} />
        </Animated.View>
      </View>

      <View style={{ flexDirection: 'row', gap: SP(6), marginTop: SP(4) }}>
        {(
          [
            ['round.sound', score.sound],
            ['round.rhythm', score.rhythm],
            ['round.length', score.length],
          ] as const
        ).map(([k, n]) => (
          <T key={k} kind="small" color={theme.sub}>
            {t(k)} <T kind="small" style={{ fontWeight: '600' }}>{n}</T>
          </T>
        ))}
      </View>
    </View>
  );
}
