import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { dailyLine, dayKey, liveStreak, titleFor } from '../../src/core/game.ts';
import { PACKS, QUIPS } from '../../src/content/index.ts';
import { LANG_NAMES } from '../../src/i18n/core.ts';
import { useApp } from '../../src/state/app.tsx';
import { Button, Divider, Icon, Press, Screen, T, type IconName } from '../../src/ui/kit.tsx';
import { R, SP } from '../../src/ui/theme.ts';

// Home: the daily line printed big on a pink slip, one pink Quick play button, then the other ways to play as a
// plain list. No tiles, no stat cards.
export default function Home() {
  const { t, theme, stats, freeLeft, lang, langHint, hideLangHint } = useApp();
  const router = useRouter();
  const today = dayKey(new Date());
  const daily = dailyLine(PACKS, today);
  const doneToday = stats.daily[today];
  const streak = liveStreak(stats.streak, today);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T kind="hero">Backspin</T>
          <T kind="small" color={theme.sub} style={{ marginTop: SP(1) }}>
            {t('home.rank', { title: titleFor(QUIPS, stats.rounds, stats.best) })}
          </T>
        </View>
        <Press label={t('settings.title')} onPress={() => router.push('/settings')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -SP(2) }}>
          <Icon name="settings" size={24} color={theme.ink} />
        </Press>
      </View>

      {/* First session only (release standard §1): which language we picked, with a way to change it. */}
      {langHint ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: SP(2) }}>
          <T kind="small" color={theme.sub}>
            {t('home.language', { lang: LANG_NAMES[lang] })}
            {' · '}
          </T>
          <Press
            label={t('home.languageChange')}
            hint={t('settings.language')}
            onPress={() => {
              hideLangHint();
              router.push('/settings');
            }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: SP(1) }}
          >
            <T kind="small" color={theme.recText} style={{ fontWeight: '600' }}>
              {t('home.languageChange')}
            </T>
          </Press>
        </View>
      ) : null}

      {/* Daily: the one featured slip on the screen. */}
      {daily ? (
        <Press
          label={t('home.dailyPlay')}
          onPress={() => router.push({ pathname: '/round', params: { mode: 'daily', line: daily.line.id } })}
          style={{ marginTop: SP(6), backgroundColor: theme.recTint, borderRadius: theme.radius.l, padding: SP(5) }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP(3) }}>
            <T kind="h">{t('home.daily')}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP(1) }}>
              {streak ? <Icon name="flame" size={16} color={theme.ink} /> : null}
              <T kind="small" style={{ fontWeight: '600' }}>
                {streak ? t('home.streak', { n: streak }) : t('home.streakNone')}
              </T>
            </View>
          </View>
          <T kind="line" style={{ marginTop: SP(4) }}>
            {daily.line.t}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP(2), marginTop: SP(5) }}>
            {doneToday != null ? <Icon name="check" size={18} color={theme.good} /> : null}
            <T kind="bodyB" color={doneToday != null ? theme.good : theme.ink}>
              {doneToday != null ? t('home.dailyDone', { score: doneToday }) : t('home.dailyPlay')}
            </T>
            {doneToday == null ? <Icon name="next" size={18} color={theme.ink} /> : null}
          </View>
        </Press>
      ) : null}

      <Button title={t('home.quick')} icon="mic" style={{ marginTop: SP(4) }} onPress={() => router.push({ pathname: '/round', params: { mode: 'quick', seed: String(Date.now()) } })} />

      {freeLeft != null ? (
        <Press label={freeLeft > 0 ? t('home.freeLeft', { n: freeLeft }) : t('home.freeDone')} onPress={() => router.push('/plus')} style={{ marginTop: SP(3), minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: SP(3) }}>
          <T kind="small" color={freeLeft > 0 ? theme.sub : theme.recText} center style={{ fontWeight: '600' }}>
            {freeLeft > 0 ? t('home.freeLeft', { n: freeLeft }) : t('home.freeDone')}
          </T>
        </Press>
      ) : null}

      {/* Other ways to play: a plain list, like a running order. */}
      <View style={{ marginTop: SP(6) }}>
        <Divider />
        <ModeRow icon="takes" title={t('home.free')} sub={t('home.freeSub')} onPress={() => router.push({ pathname: '/round', params: { mode: 'free' } })} />
        <Divider />
        <ModeRow icon="party" title={t('home.friend')} sub={t('home.friendSub')} onPress={() => router.push({ pathname: '/round', params: { mode: 'friend', seed: String(Date.now()) } })} />
        <Divider />
      </View>

      <T kind="h" style={{ marginTop: SP(10) }}>
        {t('home.how')}
      </T>
      <T color={theme.sub} style={{ marginTop: SP(2) }}>
        {t('home.howBody')}
      </T>
      {stats.rounds > 0 ? (
        <T kind="small" color={theme.sub} style={{ marginTop: SP(4) }}>
          {t('home.stats', { rounds: stats.rounds, best: stats.best })}
        </T>
      ) : null}
    </Screen>
  );
}

function ModeRow({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Press label={title} hint={sub} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: SP(4), paddingVertical: SP(4), borderRadius: R.s }}>
      <Icon name={icon} size={24} color={theme.ink} />
      <View style={{ flex: 1 }}>
        <T kind="bodyB">{title}</T>
        <T kind="small" color={theme.sub}>
          {sub}
        </T>
      </View>
      <Icon name="chevron" size={18} color={theme.sub} />
    </Press>
  );
}
