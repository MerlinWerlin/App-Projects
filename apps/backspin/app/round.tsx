// A round from anywhere: quick play, a pack line, freestyle, the daily, or challenge-a-friend.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { canSaveMore, dailyShareText, dayKey, FREE_SAVES, findLine, liveStreak, randomLine } from '../src/core/game.ts';
import { PACKS } from '../src/content/index.ts';
import type { Key } from '../src/i18n/en.ts';
import { shareText } from '../src/native/device.ts';
import { clearScratch, saveTakeFiles } from '../src/native/files.ts';
import { useApp } from '../src/state/app.tsx';
import { Button, Screen } from '../src/ui/kit.tsx';
import { RoundEngine, type RoundResult } from '../src/ui/RoundEngine.tsx';
import { SP } from '../src/ui/theme.ts';

export default function Round() {
  const { mode = 'quick', line: lineId, seed: seedParam } = useLocalSearchParams<{ mode?: string; line?: string; seed?: string }>();
  const { t, plus, takes, addTake, recordRound, stats } = useApp();
  const router = useRouter();
  const [seed, setSeed] = useState(Number(seedParam) || Date.now());
  const [key, setKey] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const today = dayKey(new Date());

  useEffect(() => () => void clearScratch(), []);

  const pick = useMemo(() => {
    if (mode === 'free') return null;
    if (lineId) {
      const f = findLine(PACKS, lineId);
      if (f) return { pack: f.pack.id, line: f.line, locked: !plus && f.pack.free !== true && !(typeof f.pack.free === 'number' && f.index < f.pack.free) && mode !== 'daily' };
    }
    const r = randomLine(PACKS, plus, seed);
    return r ? { ...r, locked: false } : null;
  }, [mode, lineId, seed, plus]);

  if (pick?.locked) {
    return (
      <Screen>
        <Button title={t('round.locked')} icon="🔒" onPress={() => router.replace('/plus')} />
      </Screen>
    );
  }

  const heading =
    mode === 'daily' ? t('round.daily') : mode === 'free' ? t('round.freestyle') : mode === 'friend' ? t('home.friend') : pick ? t(`pack.${pick.pack}` as Key) : '';

  const onScored = (r: RoundResult) => {
    setResult(r);
    setSaved(null);
    const { newBest } = recordRound(r.score.score, mode === 'daily' ? today : undefined);
    if (newBest) setSaved(`🏆 ${t('round.newBest')}`);
  };

  const onSave = async (r: RoundResult) => {
    if (!canSaveMore(takes.length, plus)) return setSaved(t('round.saveLimit', { n: FREE_SAVES }));
    const id = `${Date.now().toString(36)}`;
    try {
      const files = await saveTakeFiles(id, r.originalUri, r.copyUri);
      addTake({ id, at: Date.now(), line: pick?.line.t ?? t('round.freestyle'), pack: pick?.pack ?? null, score: r.score.score, ...files });
      setSaved(`✓ ${t('round.saved')}`);
    } catch (e) {
      setSaved(t('share.error', { detail: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <Screen>
      <RoundEngine
        key={key}
        line={pick?.line.t ?? null}
        note={pick?.pack === 'songs' || pick?.pack === 'aussie' ? pick.line.n : undefined}
        heading={heading}
        friend={mode === 'friend'}
        onScored={onScored}
        onSave={onSave}
        saveDisabled={!result}
        savedNote={saved}
        onNext={
          mode === 'daily'
            ? undefined
            : () => {
                setSeed((s) => s + 1);
                setResult(null);
                setSaved(null);
                setKey((k) => k + 1);
              }
        }
        nextLabel={mode === 'free' ? t('round.again') : t('round.next')}
        onShareResult={mode === 'daily' ? (score) => shareText(dailyShareText(today, score, Math.max(1, liveStreak(stats.streak, today)))) : undefined}
      />
      {mode === 'daily' ? <Button kind="ghost" small title={t('common.done')} style={{ marginTop: SP(4) }} onPress={() => router.back()} /> : null}
    </Screen>
  );
}
