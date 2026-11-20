// Party turns. "Copy it": each player gets a line and plays a normal round; the score is their points.
// "Guess it": the player records a line secretly, everyone hears it backwards (and can copy+flip to decode),
// then the guessers say their guess out loud and the phone owner taps who got it.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { cleanTake, isSilent, reverse, waveformPeaks } from '../src/core/dsp.ts';
import { dareFor, finishTurn, partyLine, partyOver, standings, type Party } from '../src/core/game.ts';
import { PACKS, QUIPS } from '../src/content/index.ts';
import { canReverseHere, play, stop } from '../src/native/audio.ts';
import { haptic } from '../src/native/device.ts';
import { clearScratch, readPcm, writeScratch } from '../src/native/files.ts';
import { useApp } from '../src/state/app.tsx';
import { partyStore } from '../src/state/party.ts';
import { Button, Card, Chip, Disc, Screen, T, Toastish, Wave } from '../src/ui/kit.tsx';
import { RoundEngine } from '../src/ui/RoundEngine.tsx';
import { SP } from '../src/ui/theme.ts';
import { useRecorder } from '../src/ui/useRecorder.ts';

export default function PartyPlay() {
  const { t, theme, recordRound } = useApp();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(partyStore.get());
  const [handoff, setHandoff] = useState(true);
  const [points, setPoints] = useState<number | null>(null);
  const [turnKey, setTurnKey] = useState(0);
  useEffect(() => () => (stop(), void clearScratch()), []);

  if (!party) {
    return (
      <Screen header>
        <Button title={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const save = (p: Party) => {
    partyStore.set(p);
    setParty(p);
  };

  if (partyOver(party)) {
    const st = standings(party);
    const loser = st[st.length - 1];
    return (
      <Screen header>
        <T kind="hero">{t('party.winner', { name: st[0].name })}</T>
        <T kind="h" color={theme.sub} style={{ marginTop: SP(6) }}>
          {t('party.scoreboard')}
        </T>
        <View style={{ gap: SP(2), marginTop: SP(3) }}>
          {st.map((p, i) => (
            <Card key={p.name + i} selected={i === 0} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(4) }}>
              <T kind="title" color={i === 0 ? theme.ink : theme.sub} style={{ width: 28 }}>
                {i + 1}
              </T>
              <T kind="bodyB" style={{ flex: 1 }}>
                {p.name}
              </T>
              <T kind="bodyB">{t('party.points', { n: p.score })}</T>
            </Card>
          ))}
        </View>
        {st.length > 1 ? (
          <View style={{ marginTop: SP(8) }}>
            <T kind="h">{t('party.dare', { name: loser.name })}</T>
            <T kind="title" color={theme.recText} style={{ marginTop: SP(2) }}>
              {dareFor(QUIPS, party.seed)}
            </T>
          </View>
        ) : null}
        <Button
          title={t('party.again')}
          icon="loop"
          style={{ marginTop: SP(6) }}
          onPress={() => {
            save({ ...party, players: party.players.map((p) => ({ ...p, score: 0, rounds: 0 })), round: 1, turn: 0, seed: party.seed + 101 });
            setHandoff(true);
          }}
        />
        <Button kind="ghost" title={t('party.end')} style={{ marginTop: SP(3) }} onPress={() => (partyStore.set(null), router.back())} />
      </Screen>
    );
  }

  const player = party.players[party.turn];
  // A party that started inside the free goes always finishes, even if it uses them up.
  const pick = partyLine(PACKS, party, true);
  const next = () => {
    save(finishTurn(party, points ?? 0));
    setPoints(null);
    setHandoff(true);
    setTurnKey((k) => k + 1);
  };

  return (
    <Screen header>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP(3) }}>
        <T kind="small" color={theme.sub} style={{ fontWeight: '600' }}>
          {t('party.roundOf', { round: party.round, rounds: party.rounds })}
        </T>
        <T kind="small" color={theme.sub} style={{ flex: 1, textAlign: 'right' }} lines={2}>
          {party.players.map((p) => `${p.name} ${p.score}`).join(' · ')}
        </T>
      </View>

      {handoff ? (
        <View style={{ marginTop: SP(12), alignItems: 'center' }}>
          <Disc size={160} />
          <T kind="hero" center style={{ marginTop: SP(8) }}>
            {t('party.handTo', { name: player.name })}
          </T>
          <Button title={t('party.ready')} icon="check" style={{ marginTop: SP(6), alignSelf: 'stretch' }} onPress={() => (haptic.press(), setHandoff(false))} />
        </View>
      ) : party.mode === 'copy' ? (
        <View style={{ marginTop: SP(3) }}>
          <RoundEngine
            key={turnKey}
            line={pick?.line.t ?? null}
            heading={t('party.turn', { name: player.name })}
            onScored={(r) => {
              setPoints(r.score.score);
              recordRound(r.score.score);
            }}
            onNext={next}
            nextLabel={party.turn + 1 >= party.players.length && party.round >= party.rounds ? t('party.scoreboard') : t('round.next')}
          />
        </View>
      ) : (
        <GuessTurn
          key={turnKey}
          party={party}
          line={pick?.line.t ?? ''}
          onDone={(guesserIdx) => {
            // A correct guess: +100 to the guesser, +50 to the recorder for a decodable line.
            let p = party;
            if (guesserIdx != null) {
              p = { ...p, players: p.players.map((pl, i) => (i === guesserIdx ? { ...pl, score: pl.score + 100 } : pl)) };
            }
            save(finishTurn(p, guesserIdx != null ? 50 : 0));
            setHandoff(true);
            setTurnKey((k) => k + 1);
          }}
        />
      )}
    </Screen>
  );
}

function GuessTurn({ party, line, onDone }: { party: Party; line: string; onDone: (guesser: number | null) => void }) {
  const { t, theme, prefs } = useApp();
  const rec = useRecorder(15, false);
  const [stage, setStage] = useState<'secret' | 'listen' | 'reveal'>('secret');
  const [revUri, setRevUri] = useState<string | null>(null);
  const [origUri, setOrigUri] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const player = party.players[party.turn];

  const recordSecret = async () => {
    const r = await rec.start();
    if (!r.uri) return r.error === 'short' ? setMsg(t('round.tooShort')) : r.denied ? setMsg(t('mic.denied')) : undefined;
    try {
      const pcm = cleanTake(await readPcm(r.uri));
      if (isSilent(pcm)) return setMsg(t('round.tooQuiet'));
      setOrigUri(await writeScratch(pcm, 'secret'));
      setRevUri(await writeScratch(reverse(pcm), 'secret-rev'));
      setPeaks(waveformPeaks(pcm.samples, 48).reverse());
      setStage('listen');
      setMsg(null);
    } catch (e) {
      setMsg(t('round.notPlayable', { detail: e instanceof Error ? e.message : String(e) }));
    }
  };
  const playIt = async (uri: string | null) => {
    if (!uri) return;
    setPlaying(true);
    await play(uri);
    setPlaying(false);
  };

  if (!canReverseHere) return <T color={theme.sub}>{t('round.notPlayable', { detail: 'Android' })}</T>;

  return (
    <View style={{ marginTop: SP(4) }}>
      <T kind="title">{t('party.turn', { name: player.name })}</T>
      {stage === 'secret' && (
        <>
          <View style={{ marginTop: SP(5) }}>
            <T color={theme.sub}>{t('party.secret', { name: player.name })}</T>
            <T kind="line" style={{ marginTop: SP(2) }}>
              {line}
            </T>
          </View>
          <Button
            title={rec.phase === 'recording' ? t('round.stop') : t('round.tap')}
            icon={rec.phase === 'recording' ? 'stop' : 'mic'}
            style={{ marginTop: SP(6) }}
            onPress={() => (rec.phase === 'recording' ? rec.finish() : recordSecret())}
          />
          {rec.phase === 'recording' ? <T kind="small" color={theme.recText} center style={{ marginTop: SP(2) }}>{t('round.recording', { s: rec.seconds })}</T> : null}
        </>
      )}
      {stage === 'listen' && (
        <>
          <View style={{ marginTop: SP(8) }}>
            <Disc size={150} spin={playing ? -1 : 0} />
          </View>
          <View style={{ marginTop: SP(6) }}>
            <Wave peaks={peaks} color={theme.rew} dim={theme.line} height={48} />
          </View>
          <T kind="bodyB" center style={{ marginTop: SP(3) }}>
            {t('party.guessPrompt')}
          </T>
          <Button kind="rewind" icon="play" title={t('round.playReversed')} style={{ marginTop: SP(4) }} onPress={() => playIt(revUri)} />
          <Button title={t('party.checkGuess')} style={{ marginTop: SP(3) }} onPress={() => (stop(), setStage('reveal'), prefs.autoplay && playIt(origUri))} />
        </>
      )}
      {stage === 'reveal' && (
        <>
          <View style={{ marginTop: SP(5) }}>
            <T kind="line">{line}</T>
            <Button kind="quiet" small icon="play" title={t('round.playOriginal')} style={{ marginTop: SP(4), alignSelf: 'flex-start' }} onPress={() => playIt(origUri)} />
          </View>
          <T kind="h" style={{ marginTop: SP(8) }}>
            {t('party.whoGuessed')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP(2), marginTop: SP(3) }}>
            {party.players.map((p, i) => (i === party.turn ? null : <Chip key={i} label={p.name} onPress={() => (haptic.success(), onDone(i))} />))}
            <Chip label={t('party.nobody')} onPress={() => onDone(null)} />
          </View>
        </>
      )}
      <Toastish text={msg} />
    </View>
  );
}
