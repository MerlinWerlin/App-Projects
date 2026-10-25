import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { dailyLine, dayKey, liveStreak, titleFor } from '../../src/core/game.ts';
import { PACKS, QUIPS } from '../../src/content/index.ts';
import { useApp } from '../../src/state/app.tsx';
import { Card, Disc, Emoji, Press, Screen, T } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';

export default function Home() {
  const { t, theme, stats, freeLeft } = useApp();
  const router = useRouter();
  const today = dayKey(new Date());
  const daily = dailyLine(PACKS, today);
  const doneToday = stats.daily[today];
  const streak = liveStreak(stats.streak, today);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T kind="hero">Backspin</T>
          <T kind="small" color={theme.sub}>
            {t('home.rank', { title: titleFor(QUIPS, stats.rounds, stats.best) })}
          </T>
        </View>
        <Press label={t('settings.title')} onPress={() => router.push('/settings')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
          <T>⚙︎</T>
        </Press>
      </View>

      {freeLeft != null ? (
        <Press label={freeLeft > 0 ? t('home.freeLeft', { n: freeLeft }) : t('home.freeDone')} onPress={() => router.push('/plus')} style={{ marginTop: SP(4), alignSelf: 'flex-start', backgroundColor: freeLeft > 0 ? theme.cardHi : theme.rec, borderRadius: R.pill, paddingHorizontal: SP(4), paddingVertical: SP(2) }}>
          <T kind="small" color={freeLeft > 0 ? theme.ink : theme.recInk} style={{ fontWeight: '800' }}>
            {freeLeft > 0 ? `🎟 ${t('home.freeLeft', { n: freeLeft })}` : `🔓 ${t('home.freeDone')}`}
          </T>
        </Press>
      ) : null}

      {/* Daily */}
      {daily ? (
        <Card
          hi
          style={{ marginTop: SP(5), padding: SP(5) }}
          label={t('home.dailyPlay')}
          onPress={() => router.push({ pathname: '/round', params: { mode: 'daily', line: daily.line.id } })}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T kind="small" color={theme.sub}>
              {t('home.daily')}
            </T>
            <View style={{ backgroundColor: streak ? theme.rec : theme.line, borderRadius: R.pill, paddingHorizontal: SP(3), paddingVertical: SP(1) }}>
              <T kind="small" color={streak ? theme.recInk : theme.sub} style={{ fontWeight: '800' }}>
                {streak ? `🔥 ${t('home.streak', { n: streak })}` : t('home.streakNone')}
              </T>
            </View>
          </View>
          <T kind="line" style={{ marginTop: SP(3) }}>
            {daily.line.t}
          </T>
          <T kind="bodyB" color={doneToday != null ? theme.good : theme.rec} style={{ marginTop: SP(3) }}>
            {doneToday != null ? `✓ ${t('home.dailyDone', { score: doneToday })}` : `${t('home.dailyPlay')} ➜`}
          </T>
        </Card>
      ) : null}

      {/* Quick play */}
      <Card style={{ marginTop: SP(4), flexDirection: 'row', alignItems: 'center', gap: SP(4), padding: SP(5) }} label={t('home.quick')} onPress={() => router.push({ pathname: '/round', params: { mode: 'quick', seed: String(Date.now()) } })}>
        <Disc size={72} spin={0} />
        <View style={{ flex: 1 }}>
          <T kind="title">{t('home.quick')}</T>
          <T kind="small" color={theme.sub}>
            {t('home.quickSub')}
          </T>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: SP(3), marginTop: SP(3) }}>
        <Card style={{ flex: 1, padding: SP(4) }} label={t('home.free')} onPress={() => router.push({ pathname: '/round', params: { mode: 'free' } })}>
          <Emoji size={28}>🗣</Emoji>
          <T kind="bodyB" style={{ marginTop: SP(2) }}>
            {t('home.free')}
          </T>
          <T kind="small" color={theme.sub}>
            {t('home.freeSub')}
          </T>
        </Card>
        <Card style={{ flex: 1, padding: SP(4) }} label={t('home.friend')} onPress={() => router.push({ pathname: '/round', params: { mode: 'friend', seed: String(Date.now()) } })}>
          <Emoji size={28}>🤝</Emoji>
          <T kind="bodyB" style={{ marginTop: SP(2) }}>
            {t('home.friend')}
          </T>
          <T kind="small" color={theme.sub}>
            {t('home.friendSub')}
          </T>
        </Card>
      </View>

      <Card style={{ marginTop: SP(6) }}>
        <T kind="bodyB">{t('home.how')}</T>
        <T color={theme.sub} style={{ marginTop: SP(2) }}>
          {t('home.howBody')}
        </T>
        {stats.rounds > 0 ? (
          <T kind="small" color={theme.faint} style={{ marginTop: SP(3) }}>
            {t('home.stats', { rounds: stats.rounds, best: stats.best })}
          </T>
        ) : null}
      </Card>
    </Screen>
  );
}
